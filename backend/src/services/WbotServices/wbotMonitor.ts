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

type Session = WASocket & {
  id?: number;
  store?: Store;
};

interface IContact {
  contacts: BContact[];
}

/**
 * Extrae el número real de un contacto LID buscando en todos los campos disponibles
 */
const extractRealNumberFromCall = async (
  node: BinaryNode,
  content: any,
  wbot: Session,
  companyId: number
): Promise<{ realNumber: string; contactName: string }> => {
  const { from } = node.attrs;
  let realNumber = from;
  let contactName = node.attrs['notify'] || 'Contacto WhatsApp';

  // Si es un LID, intentar obtener el número real
  if (from?.endsWith('@lid')) {
    // 1. Buscar en caller_pn (prioridad alta - este campo suele tener el número real)
    if (content?.attrs?.['caller_pn']) {
      const callerPn = content.attrs['caller_pn'].replace('@s.whatsapp.net', '');
      if (!callerPn.endsWith('@lid') && callerPn.length > 0) {
        realNumber = callerPn;
      }
    }

    // 2. Buscar en call-creator (puede tener el número real del creador de la llamada)
    if (content?.attrs?.['call-creator'] && (realNumber.endsWith('@lid') || realNumber === from)) {
      const callCreator = content.attrs['call-creator'].replace('@s.whatsapp.net', '').replace('@lid', '');
      if (!callCreator.endsWith('@lid') && callCreator.length > 0 && callCreator !== from.replace('@lid', '')) {
        realNumber = callCreator;
      }
    }

    // 3. Buscar en node.attrs por campos alternativos (similar a remoteJidAlt)
    const nodeWithAny = node as any;
    if (nodeWithAny.attrs?.['remoteJidAlt']) {
      const remoteJidAlt = nodeWithAny.attrs['remoteJidAlt'].replace('@s.whatsapp.net', '');
      if (!remoteJidAlt.endsWith('@lid')) {
        realNumber = remoteJidAlt;
      }
    }

    // 4. Buscar en content.attrs por senderPn
    if (content?.attrs?.['senderPn']) {
      const senderPn = content.attrs['senderPn'].replace('@s.whatsapp.net', '');
      if (!senderPn.endsWith('@lid')) {
        realNumber = senderPn;
      }
    }

    // 5. Intentar obtener el número real consultando el contacto en WhatsApp
    if (realNumber.endsWith('@lid') || realNumber === from) {
      try {
        const [contactInfo] = await wbot.onWhatsApp(from);
        if (contactInfo && contactInfo.exists) {
          const jid = contactInfo.jid;
          if (jid && !jid.endsWith('@lid')) {
            realNumber = jid.replace('@s.whatsapp.net', '');
          }
        }
      } catch (error) {
        // Silenciar error
      }
    }

    // 6. Si aún es LID, buscar en la base de datos si existe un contacto con ese número
    if (realNumber.endsWith('@lid') || realNumber === from) {
      try {
        const lidNumber = from.replace('@lid', '').replace(/\D/g, '');
        const existingContact = await Contact.findOne({
          where: {
            number: lidNumber,
            companyId: companyId
          },
          order: [['updatedAt', 'DESC']]
        });

        if (existingContact) {
          realNumber = existingContact.number;
          contactName = existingContact.name;
        }
      } catch (error) {
        // Silenciar error
      }
    }

    // Si después de todo sigue siendo LID, usar el número sin @lid
    if (realNumber.endsWith('@lid')) {
      realNumber = realNumber.replace('@lid', '').replace(/\D/g, '');
      contactName = contactName === 'Contacto WhatsApp' ? 'Contacto LID' : contactName;
    }
  } else {
    // Si no es LID, limpiar el número normalmente
    realNumber = realNumber.replace('@s.whatsapp.net', '').replace(/\D/g, '');
  }

  return { realNumber, contactName };
};

const wbotMonitor = async (
  wbot: Session,
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  try {
    let pendingCalls = new Map();

    wbot.ws.on("CB:call", async (node: BinaryNode) => {
      const content = node.content[0] as any;
      const { from, id } = node.attrs;

      if (content.tag === "offer") {
        // Usar la función mejorada para extraer el número real
        const { realNumber, contactName } = await extractRealNumberFromCall(node, content, wbot, companyId);

        // Limpiar números para mostrar
        const originalNumber = from.replace('@s.whatsapp.net', '').replace('@lid', '');
        const detectedNumber = realNumber.replace('@s.whatsapp.net', '').replace('@lid', '');

        console.log("============ LLAMADA ENTRANTE ============");
        console.log(`📞 Llamada entrante - Original: ${originalNumber} | Detectado: ${detectedNumber} | Nombre: ${contactName}`);
        console.log("==========================================");        
        const internalCallId = content.attrs['call-id'];
        pendingCalls.set(internalCallId, {
          from,
          externalId: id,
          realNumber,
          contactName,
          timestamp: new Date(),
          callCreator: content.attrs['call-creator']
        });
      }

      if (content.tag === "terminate") {
        const internalCallId = content.attrs['call-id'];
        const callData = pendingCalls.get(internalCallId);

        if (callData) {
          pendingCalls.delete(internalCallId);
          await processMissedCall(callData, wbot, companyId);
        } else {
          // Usar la función mejorada para extraer el número real
          const { realNumber, contactName } = await extractRealNumberFromCall(node, content, wbot, companyId);

          await processMissedCall({
            from,
            externalId: id,
            realNumber,
            contactName,
            callCreator: content.attrs['call-creator']
          }, wbot, companyId);
        }
      }

      if (content.tag === "accept" || content.tag === "reject") {
        const internalCallId = content.attrs['call-id'];
        if (internalCallId) {
          pendingCalls.delete(internalCallId);
        }
      }
    });

    async function processMissedCall(callData: any, wbot: Session, companyId: number) {
      try {
        const { from, externalId, realNumber, contactName, callCreator } = callData;

        //logger.info(`🔍 Procesando llamada perdida de: ${contactName} (${realNumber})`);

        // PRIMERO: Crear/actualizar el contacto con el número real
        // Esto también actualizará cualquier contacto existente con el LID
        const contact = await findOrCreateContact(realNumber, contactName, companyId, from);
        if (!contact) {
          logger.error(`❌ No se pudo crear contacto para ${realNumber}`);
          return;
        }

        // SEGUNDO: Crear el ticket
        const ticket = await findOrCreateTicket(contact.id, wbot.id, companyId);
        if (!ticket) {
          logger.error(`❌ No se pudo crear ticket para contacto ${contact.id}`);
          return;
        }

        // TERCERO: Crear el mensaje de llamada perdida
        await createMissedCallMessage(ticket, contact, externalId, realNumber, contactName, companyId);

        // CUARTO: Enviar mensaje automático (después de crear todo)
        // Usar el número real si está disponible, sino usar el from original
        const messageTo = realNumber.includes('@') ? realNumber : `${realNumber}@s.whatsapp.net`;
        await sendAutoMessageIfNeeded(messageTo, wbot, companyId);

      } catch (error) {
        logger.error(`❌ Error procesando llamada perdida:`, error);
        Sentry.captureException(error);
      }
    }

    async function findOrCreateContact(number: string, name: string, companyId: number, originalFrom?: string) {
      try {
        const cleanNumber = number.replace('@s.whatsapp.net', '').replace(/\D/g, '');

        //logger.info(`🔍 Buscando/creando contacto: ${name} (${cleanNumber})`);

        // PRIMERO: Buscar contacto con el número real
        let contact = await Contact.findOne({
          where: { number: cleanNumber, companyId }
        });

        // SEGUNDO: Si no se encuentra y el from original es un LID, buscar y actualizar contacto con el LID
        if (!contact && originalFrom?.endsWith('@lid')) {
          const lidNumber = originalFrom.replace('@lid', '').replace(/\D/g, '');
          
          // Buscar TODOS los contactos con el LID (puede haber múltiples)
          const lidContacts = await Contact.findAll({
            where: { number: lidNumber, companyId }
          });

          if (lidContacts.length > 0) {
            // Usar el primer contacto encontrado y actualizarlo
            contact = lidContacts[0];
            
            // Actualizar el contacto LID para que use el número real
            await contact.update({
              number: cleanNumber,
              name: name !== 'Contacto WhatsApp' && name !== 'Contacto LinkedIn' ? name : contact.name
            });
            
            logger.info(`✅ Contacto LID actualizado con número real: ${lidNumber} -> ${cleanNumber}`);
            
            // Si hay múltiples contactos con el LID, actualizar todos o eliminarlos
            if (lidContacts.length > 1) {
              // Actualizar los demás contactos también
              for (let i = 1; i < lidContacts.length; i++) {
                const duplicateContact = lidContacts[i];
                // Actualizar tickets relacionados para que apunten al contacto principal
                await Ticket.update(
                  { contactId: contact.id },
                  { where: { contactId: duplicateContact.id, companyId } }
                );
                // Eliminar el contacto duplicado
                await duplicateContact.destroy();
                logger.info(`✅ Contacto duplicado eliminado: ${duplicateContact.id}`);
              }
            }
          }
        }

        // TERCERO: Si aún no hay contacto, crear uno nuevo
        if (!contact) {
          contact = await Contact.create({
            number: cleanNumber,
            name: name,
            companyId: companyId,
            isGroup: false
          });
          logger.info(`✅ Nuevo contacto creado: ${name} (${cleanNumber})`);
        } else {
          //logger.info(`✅ Contacto encontrado: ${contact.name} (${contact.number})`);

          if (name !== 'Contacto WhatsApp' && name !== 'Contacto LinkedIn' && name !== contact.name) {
            await contact.update({ name });
            logger.info(`✅ Nombre actualizado: ${name}`);
          }
        }

        return contact;
      } catch (error) {
        logger.error(`❌ Error con contacto ${number}:`, error);
        return await getGenericCallContact(companyId);
      }
    }

    async function getGenericCallContact(companyId: number) {
      try {
        const callNumber = "0000000000";
        let contact = await Contact.findOne({
          where: { number: callNumber, companyId }
        });

        if (!contact) {
          contact = await Contact.create({
            number: callNumber,
            name: "Llamadas Entrantes",
            companyId: companyId,
            isGroup: false
          });
          logger.info(`✅ Contacto genérico creado`);
        }
        return contact;
      } catch (error) {
        logger.error(`❌ Error con contacto genérico:`, error);
        return null;
      }
    }

    async function findOrCreateTicket(contactId: number, whatsappId: number, companyId: number) {
      try {
        let ticket = await Ticket.findOne({
          where: {
            contactId,
            whatsappId,
            companyId,
            status: { [Op.not]: "closed" }
          },
          order: [["updatedAt", "DESC"]]
        });

        if (!ticket) {
          ticket = await Ticket.findOne({
            where: {
              contactId,
              whatsappId,
              companyId
            },
            order: [["updatedAt", "DESC"]]
          });
        }

        if (!ticket) {
          ticket = await Ticket.create({
            contactId,
            whatsappId,
            companyId,
            status: "pending",
            isGroup: false,
            unreadMessages: 1
          });
          logger.info(`✅ Nuevo ticket creado: ${ticket.id}`);
        } else {
          logger.info(`✅ Ticket existente encontrado: ${ticket.id}`);
        }

        return ticket;
      } catch (error) {
        logger.error(`❌ Error con ticket:`, error);
        return null;
      }
    }

    async function sendAutoMessageIfNeeded(from: string, wbot: Session, companyId: number) {
      try {
        const sendMsgCall = await Setting.findOne({
          where: { key: "call", companyId }
        });

        if (sendMsgCall?.value === "disabled") {
          await wbot.sendMessage(from, {
            text: "*Mensaje Automático:*\n\nLas llamadas de voz y video están deshabilitadas para este WhatsApp, por favor envíe un mensaje de texto. Gracias"
          });
          //logger.info(`✅ Mensaje automático enviado a ${from}`);
        }
      } catch (error) {
        logger.error(`❌ Error enviando mensaje automático:`, error);
      }
    }

    async function createMissedCallMessage(
      ticket: Ticket,
      contact: Contact,
      callId: string,
      realNumber: string,
      contactName: string,
      companyId: number
    ) {
      try {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');

        const body = `📞 Llamada de voz/vídeo perdida de ${contactName} (${realNumber}) a las ${hours}:${minutes}`;

        const messageData = {
          id: `call-${callId}-${now.getTime()}`,
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
          companyId: companyId
        });

        logger.info(`🎉 ✅ LLAMADA PERDIDA REGISTRADA - Contacto: ${contactName} - Ticket: ${ticket.id}`);

      } catch (error) {
        logger.error(`❌ Error creando mensaje:`, error);
        Sentry.captureException(error);
      }
    }

    setInterval(() => {
      const now = new Date();
      const timeout = 5 * 60 * 1000;

      for (const [internalCallId, callData] of pendingCalls.entries()) {
        if (now.getTime() - callData.timestamp.getTime() > timeout) {
          pendingCalls.delete(internalCallId);
          logger.info(`🧹 Llamada pendiente ${internalCallId} limpiada por timeout`);
        }
      }
    }, 60 * 1000);

    const allowupserts = await Setting.findOne({
      where: { key: "allowupserts", companyId: 1 }
    });

    if (allowupserts && allowupserts.value === "enabled") {
      wbot.ev.on("contacts.upsert", async (contacts: BContact[]) => {
        await addContactsUpdateJob(whatsapp?.id, contacts);
      });
    }

    //logger.info("✅ Monitor de llamadas inicializado - Con correlación por ID interno");

  } catch (err) {
    Sentry.captureException(err);
    logger.error("❌ Error en wbotMonitor:", err);
  }
};

export default wbotMonitor;