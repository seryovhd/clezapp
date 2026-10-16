import {
  WASocket,
  BinaryNode,
  Contact as BContact
} from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import { Op } from "sequelize";
import { Store } from "../../libs/store";
import Contact from "../../models/Contact";
import Setting from "../../models/Setting";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { addContactsUpdateJob } from "./ProcessContactsUpdate";
import { resolveLidToPhone } from "../../helpers/ResolveLidHelper";

type Session = WASocket & {
  id?: number;
  store?: Store;
};

interface ExtractedCallInfo {
  realNumber: string;
  contactName: string;
  isLid: boolean;
  rawFrom: string;
}

/**
 * Extrae el número real y nombre de un llamante sin bloquear el Event Loop.
 * Utiliza memoria authState y base de datos local en lugar de peticiones de red 'onWhatsApp' que causan lag.
 */
const extractRealNumberFromCall = async (
  node: BinaryNode,
  content: any,
  wbot: Session,
  companyId: number
): Promise<ExtractedCallInfo> => {
  const { from } = node.attrs;
  let realNumber = from || "";
  let contactName = node.attrs["notify"] || "Contacto WhatsApp";
  let isLid = false;

  // 1. Revisar si viene de un LID
  if (from?.endsWith("@lid") || (from && from.replace(/\D/g, "").length >= 14 && !from.includes("@s.whatsapp.net"))) {
    isLid = true;
    const cleanLid = from.replace("@lid", "").replace(/\D/g, "");

    // 2. Buscar en caller_pn (WhatsApp suele incluir el número telefónico real aquí)
    if (content?.attrs?.["caller_pn"]) {
      const callerPn = content.attrs["caller_pn"].replace("@s.whatsapp.net", "").replace(/\D/g, "");
      if (callerPn.length >= 8 && callerPn.length <= 13) {
        return { realNumber: callerPn, contactName, isLid: false, rawFrom: from };
      }
    }

    // 3. Buscar en call-creator
    if (content?.attrs?.["call-creator"]) {
      const callCreator = content.attrs["call-creator"].replace("@s.whatsapp.net", "").replace("@lid", "").replace(/\D/g, "");
      if (callCreator.length >= 8 && callCreator.length <= 13) {
        return { realNumber: callCreator, contactName, isLid: false, rawFrom: from };
      }
    }

    // 4. Buscar en atributos alternativos (remoteJidAlt, senderPn)
    const nodeAny = node as any;
    const alt = nodeAny.attrs?.["remoteJidAlt"] || content?.attrs?.["senderPn"];
    if (alt) {
      const cleanAlt = alt.replace("@s.whatsapp.net", "").replace("@lid", "").replace(/\D/g, "");
      if (cleanAlt.length >= 8 && cleanAlt.length <= 13) {
        return { realNumber: cleanAlt, contactName, isLid: false, rawFrom: from };
      }
    }

    // 5. Resolver LID mediante el Signal Store en memoria y base de datos (ResolveLidHelper)
    if (cleanLid) {
      const resolved = await resolveLidToPhone(cleanLid, wbot, companyId);
      if (resolved && resolved.length >= 8 && resolved.length <= 13) {
        return { realNumber: resolved, contactName, isLid: false, rawFrom: from };
      }

      // 6. Buscar en la base de datos si existe contacto previo registrado con ese LID
      try {
        const existingContact = await Contact.findOne({
          where: {
            [Op.or]: [
              { number: cleanLid },
              { lid: cleanLid }
            ],
            companyId
          },
          order: [["updatedAt", "DESC"]]
        });

        if (existingContact) {
          return {
            realNumber: existingContact.number,
            contactName: existingContact.name || contactName,
            isLid: false,
            rawFrom: from
          };
        }
      } catch (e) {}

      // Fallback: Si no se pudo resolver el número real, usar el identificador LID
      realNumber = cleanLid;
      contactName = contactName === "Contacto WhatsApp" ? "Contacto WhatsApp" : contactName;
    }
  } else {
    realNumber = realNumber.replace("@s.whatsapp.net", "").replace(/\D/g, "");
  }

  return { realNumber, contactName, isLid, rawFrom: from };
};

const wbotMonitor = async (
  wbot: Session,
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  try {
    const pendingCalls = new Map<string, any>();
    // Cache para evitar procesar llamadas duplicadas por eventos múltiples de terminate
    const processedCalls = new Set<string>();

    wbot.ws.on("CB:call", async (node: BinaryNode) => {
      try {
        const content = node.content?.[0] as any;
        if (!content) return;

        const { from, id } = node.attrs;
        const internalCallId = content.attrs?.["call-id"] || id;

        // ==========================================
        // 1. LLAMADA ENTRANTE ("offer")
        // ==========================================
        if (content.tag === "offer") {
          const callInfo = await extractRealNumberFromCall(node, content, wbot, companyId);

          const originalNumber = (from || "").replace("@s.whatsapp.net", "").replace("@lid", "");
          logger.info(`📞 [WbotMonitor] Llamada entrante de ${callInfo.contactName} (${callInfo.realNumber}) | Original: ${originalNumber} | CallID: ${internalCallId}`);

          pendingCalls.set(internalCallId, {
            from,
            internalCallId,
            externalId: id,
            realNumber: callInfo.realNumber,
            contactName: callInfo.contactName,
            isLid: callInfo.isLid,
            timestamp: new Date()
          });

          // Verificar si las llamadas están deshabilitadas en Settings
          const sendMsgCall = await Setting.findOne({
            where: { key: "call", companyId }
          });

          // Rechazo inmediato si están deshabilitadas para que el teléfono del llamante no quede timbrando
          if (sendMsgCall?.value === "disabled") {
            try {
              if (typeof (wbot as any).rejectCall === "function") {
                await (wbot as any).rejectCall(internalCallId, from);
                logger.info(`🚫 [WbotMonitor] Llamada ${internalCallId} de ${from} rechazada automáticamente vía rejectCall.`);
              }
            } catch (errReject) {
              logger.warn(`[WbotMonitor] Error ejecutando rejectCall en offer: ${errReject}`);
            }
          }
        }

        // ==========================================
        // 2. LLAMADA TERMINADA ("terminate")
        // ==========================================
        if (content.tag === "terminate") {
          if (!internalCallId) return;

          // Control anti-rebote: si ya fue procesada esta llamada en los últimos 2 minutos, ignorar
          if (processedCalls.has(internalCallId)) {
            return;
          }
          processedCalls.add(internalCallId);
          setTimeout(() => processedCalls.delete(internalCallId), 120 * 1000);

          let callData = pendingCalls.get(internalCallId);
          if (callData) {
            pendingCalls.delete(internalCallId);
          } else {
            const callInfo = await extractRealNumberFromCall(node, content, wbot, companyId);
            callData = {
              from,
              internalCallId,
              externalId: id,
              realNumber: callInfo.realNumber,
              contactName: callInfo.contactName,
              isLid: callInfo.isLid,
              timestamp: new Date()
            };
          }

          await processMissedCall(callData, wbot, whatsapp, companyId);
        }

        // ==========================================
        // 3. LLAMADA ACEPTADA O RECHAZADA EXTERNAMENTE
        // ==========================================
        if (content.tag === "accept" || content.tag === "reject") {
          if (internalCallId) {
            pendingCalls.delete(internalCallId);
          }
        }
      } catch (errCall) {
        logger.error("[WbotMonitor] Error procesando nodo de llamada:", errCall);
      }
    });

    /**
     * Procesa la llamada perdida, crea el contacto, el ticket y envía el mensaje automático de forma segura
     */
    async function processMissedCall(
      callData: any,
      session: Session,
      wapp: Whatsapp,
      compCompanyId: number
    ) {
      try {
        const { from, externalId, realNumber, contactName, isLid } = callData;

        // 1. Obtener o crear contacto de forma segura (sin destruir contactos ni violar FKs)
        const contact = await findOrCreateContactSafe(realNumber, contactName, compCompanyId, from, isLid);
        if (!contact) {
          logger.error(`❌ [WbotMonitor] No se pudo crear contacto para ${realNumber}`);
          return;
        }

        // 2. Obtener o crear ticket
        const ticket = await findOrCreateTicketSafe(contact.id, wapp.id, compCompanyId);
        if (!ticket) {
          logger.error(`❌ [WbotMonitor] No se pudo crear ticket para contacto ${contact.id}`);
          return;
        }

        // 3. Crear mensaje de llamada perdida en el historial del ticket
        await createMissedCallMessage(ticket, contact, externalId, realNumber, contactName, compCompanyId);

        // 4. Enviar mensaje automático si las llamadas están deshabilitadas
        await sendAutoMessageSafe(from, realNumber, isLid, session, ticket, contact, compCompanyId);

      } catch (error) {
        logger.error("❌ [WbotMonitor] Error procesando llamada perdida:", error);
        Sentry.captureException(error);
      }
    }

    /**
     * Busca o crea el contacto sin borrar registros existentes para evitar violaciones de clave foránea
     */
    async function findOrCreateContactSafe(
      number: string,
      name: string,
      compCompanyId: number,
      originalFrom: string,
      isLid: boolean
    ): Promise<Contact | null> {
      try {
        const cleanNumber = number.replace(/\D/g, "");

        let contact = await Contact.findOne({
          where: { number: cleanNumber, companyId: compCompanyId }
        });

        // Si no se encuentra y el origen tiene LID, buscar por LID
        if (!contact && isLid) {
          contact = await Contact.findOne({
            where: {
              [Op.or]: [
                { number: cleanNumber },
                { lid: cleanNumber }
              ],
              companyId: compCompanyId
            }
          });
        }

        if (!contact) {
          contact = await Contact.create({
            number: cleanNumber,
            name: name || "Contacto WhatsApp",
            companyId: compCompanyId,
            isGroup: false,
            ...(isLid ? { lid: cleanNumber } : {})
          });
          logger.info(`✅ [WbotMonitor] Nuevo contacto creado: ${name} (${cleanNumber})`);
        } else {
          // Si el nombre actual es genérico y ahora tenemos uno mejor, actualizarlo
          if (name && name !== "Contacto WhatsApp" && name !== "Contacto LID" && contact.name !== name) {
            await contact.update({ name });
          }
        }

        return contact;
      } catch (err: any) {
        logger.error(`❌ [WbotMonitor] Error en findOrCreateContactSafe para ${number}:`, err);
        return null;
      }
    }

    /**
     * Busca o crea un ticket para el contacto
     */
    async function findOrCreateTicketSafe(
      contactId: number,
      whatsappId: number,
      compCompanyId: number
    ): Promise<Ticket | null> {
      try {
        let ticket = await Ticket.findOne({
          where: {
            contactId,
            whatsappId,
            companyId: compCompanyId,
            status: { [Op.not]: "closed" }
          },
          order: [["updatedAt", "DESC"]]
        });

        if (!ticket) {
          ticket = await Ticket.create({
            contactId,
            whatsappId,
            companyId: compCompanyId,
            status: "pending",
            isGroup: false,
            unreadMessages: 1
          });
          logger.info(`✅ [WbotMonitor] Nuevo ticket creado por llamada: ${ticket.id}`);
        }

        return ticket;
      } catch (err: any) {
        logger.error(`❌ [WbotMonitor] Error creando ticket para contacto ${contactId}:`, err);
        return null;
      }
    }

    /**
     * Registra el mensaje de llamada perdida en la conversación
     */
    async function createMissedCallMessage(
      ticket: Ticket,
      contact: Contact,
      callId: string,
      realNumber: string,
      contactName: string,
      compCompanyId: number
    ) {
      try {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, "0");
        const minutes = now.getMinutes().toString().padStart(2, "0");

        const body = `📞 Llamada de voz/video perdida de ${contactName} (${realNumber}) a las ${hours}:${minutes}`;

        const messageData = {
          id: `call-${callId || Date.now()}-${now.getTime()}`,
          ticketId: ticket.id,
          contactId: contact.id,
          body,
          fromMe: false,
          mediaType: "call_log",
          read: true,
          quotedMsgId: null,
          ack: 1,
          createdAt: now
        };

        await ticket.update({
          lastMessage: body,
          status: "pending",
          updatedAt: now
        });

        await CreateMessageService({
          messageData,
          companyId: compCompanyId
        });

        logger.info(`🎉 [WbotMonitor] Llamada perdida registrada en Ticket ${ticket.id} (${contactName})`);
      } catch (err: any) {
        logger.error("❌ [WbotMonitor] Error creando mensaje de llamada perdida:", err);
      }
    }

    /**
     * Envía el mensaje automático garantizando un JID de destino válido
     */
    async function sendAutoMessageSafe(
      originalFrom: string,
      realNumber: string,
      isLid: boolean,
      session: Session,
      ticket: Ticket,
      contact: Contact,
      compCompanyId: number
    ) {
      try {
        const sendMsgCall = await Setting.findOne({
          where: { key: "call", companyId: compCompanyId }
        });

        if (sendMsgCall?.value === "disabled") {
          const autoMsgText = "*Mensaje Automático:*\n\nLas llamadas de voz y video están deshabilitadas para este WhatsApp, por favor envíe un mensaje de texto. Gracias";

          // Determinar JID de destino válido:
          // Si es número telefónico estándar -> @s.whatsapp.net
          // Si es un LID no resuelto -> @lid original
          let destinationJid: string;
          if (isLid) {
            destinationJid = originalFrom.includes("@") ? originalFrom : `${realNumber}@lid`;
          } else {
            destinationJid = realNumber.includes("@") ? realNumber : `${realNumber}@s.whatsapp.net`;
          }

          logger.info(`🚀 [WbotMonitor] Enviando mensaje automático de llamada deshabilitada a: ${destinationJid}`);
          const sentRes = await session.sendMessage(destinationJid, { text: autoMsgText });

          // Registrar el mensaje automático enviado en el historial del ticket para que el agente lo vea
          const messageId = sentRes?.key?.id || `auto_call_${Date.now()}`;
          try {
            await CreateMessageService({
              messageData: {
                id: messageId,
                ticketId: ticket.id,
                contactId: contact.id,
                body: autoMsgText,
                fromMe: true,
                read: true,
                mediaType: "chat",
                ack: 1,
                remoteJid: destinationJid
              },
              companyId: compCompanyId
            });

            await ticket.update({ lastMessage: autoMsgText });
            logger.info(`✅ [WbotMonitor] Mensaje automático guardado en Ticket ${ticket.id}`);
          } catch (eSave) {
            logger.warn("[WbotMonitor] Error guardando mensaje automático saliente:", eSave);
          }
        }
      } catch (err: any) {
        logger.error("❌ [WbotMonitor] Error enviando mensaje automático de llamada:", err);
      }
    }

    // Limpieza de llamadas pendientes cada minuto
    setInterval(() => {
      const now = new Date();
      const timeout = 3 * 60 * 1000;

      for (const [internalCallId, callData] of pendingCalls.entries()) {
        if (now.getTime() - callData.timestamp.getTime() > timeout) {
          pendingCalls.delete(internalCallId);
        }
      }
    }, 60 * 1000);

    // Monitor de contactos
    const allowupserts = await Setting.findOne({
      where: { key: "allowupserts", companyId: 1 }
    });

    if (allowupserts && allowupserts.value === "enabled") {
      wbot.ev.on("contacts.upsert", async (contacts: BContact[]) => {
        await addContactsUpdateJob(whatsapp?.id, contacts);
      });
    }

  } catch (err) {
    Sentry.captureException(err);
    logger.error("❌ Error en wbotMonitor:", err);
  }
};

export default wbotMonitor;