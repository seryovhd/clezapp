import { Request, Response } from "express";
import Whatsapp from "../models/Whatsapp";
import { getIO } from "../libs/socket";
import { logger } from "../utils/logger";
import EvolutionApiService from "../services/EvolutionApiServices/EvolutionApiService";
import { handleMessage, handleMsgAck } from "../services/WbotServices/wbotMessageListener";
import { WAMessage } from "@whiskeysockets/baileys";
import Message from "../models/Message";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Setting from "../models/Setting";
import CreateMessageService from "../services/MessageServices/CreateMessageService";
import { Op } from "sequelize";
import { resolveLidToPhone } from "../helpers/ResolveLidHelper";

export const handleWebhook = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId: paramCompanyId, whatsappId: paramWhatsappId } = req.params;
    const body = req.body;

    if (!body) {
      return res.status(200).json({ status: "ignored_empty_body" });
    }

    const event = (body.event || body.type || "").toLowerCase();
    const instanceName = body.instance || body.instanceName;

    // Buscar el WhatsApp correspondiente
    let whatsapp: Whatsapp | null = null;

    if (paramWhatsappId) {
      whatsapp = await Whatsapp.findByPk(paramWhatsappId);
    } else if (instanceName) {
      whatsapp = await Whatsapp.findOne({
        where: { instanceName }
      });

      // Si no coincide por instanceName, intentar buscar por patrón chasap_{companyId}_{whatsappId}
      if (!whatsapp && typeof instanceName === "string" && instanceName.startsWith("chasap_")) {
        const parts = instanceName.split("_");
        if (parts.length >= 3) {
          const wId = parseInt(parts[2], 10);
          if (!isNaN(wId)) {
            whatsapp = await Whatsapp.findByPk(wId);
          }
        }
      }
    }

    if (!whatsapp) {
      logger.warn(`[Evolution Webhook] WhatsApp no encontrado para la instancia: ${instanceName || paramWhatsappId}`);
      return res.status(200).json({ status: "whatsapp_not_found" });
    }

    const companyId = whatsapp.companyId || parseInt(paramCompanyId, 10) || 1;
    const io = getIO();

    logger.info(`[Evolution Webhook] Evento recibido: "${event}" para WhatsApp ID ${whatsapp.id} (${whatsapp.name})`);

    // 1. EVENTO: ACTUALIZACIÓN DE QR CODE
    if (event === "qrcode.updated" || event === "qrcode_updated") {
      const qrcodeData = body.data?.qrcode || body.data;
      const code = typeof qrcodeData === "string" ? qrcodeData : (qrcodeData?.code || qrcodeData?.base64 || "");

      if (code) {
        await whatsapp.update({
          qrcode: code,
          status: "qrcode"
        });

        io.emit(`company-${companyId}-whatsappSession`, {
          action: "update",
          session: whatsapp
        });
      }
      return res.status(200).json({ status: "qrcode_processed" });
    }

    // 2. EVENTO: ACTUALIZACIÓN DE CONEXIÓN
    if (event === "connection.update" || event === "connection_update") {
      const state = (body.data?.state || body.data?.status || "").toLowerCase();

      if (state === "open" || state === "connected") {
        await whatsapp.update({
          status: "CONNECTED",
          qrcode: "",
          retries: 0
        });

        io.emit(`company-${companyId}-whatsappSession`, {
          action: "update",
          session: whatsapp
        });
      } else if (state === "close" || state === "disconnected") {
        await whatsapp.update({
          status: "DISCONNECTED",
          qrcode: ""
        });

        io.emit(`company-${companyId}-whatsappSession`, {
          action: "update",
          session: whatsapp
        });
      } else if (state === "connecting") {
        await whatsapp.update({
          status: "CONNECTING"
        });

        io.emit(`company-${companyId}-whatsappSession`, {
          action: "update",
          session: whatsapp
        });
      }
      return res.status(200).json({ status: "connection_processed" });
    }

    // 3. EVENTO: MENSAJES ENTRANTES (MESSAGES_UPSERT)
    if (event === "messages.upsert" || event === "messages_upsert" || event === "message.upsert") {
      const rawMessages = body.data?.messages || (Array.isArray(body.data) ? body.data : [body.data]);

      if (!rawMessages || rawMessages.length === 0) {
        return res.status(200).json({ status: "no_messages" });
      }

      // Usar adaptador WASocket unificado para Evolution API
      const fakeSession = EvolutionApiService.buildEvolutionSession(whatsapp);

      for (const item of rawMessages) {
        if (!item || !item.key) continue;

        // Normalizar JID si viene con LID
        const itemAny = item as any;
        if (item.key.remoteJid?.endsWith('@lid') || (item.key.remoteJid?.replace(/\D/g, "").length >= 14 && !item.key.remoteJid.includes('@s.whatsapp.net') && !item.key.remoteJid.includes('@g.us'))) {
          if (itemAny.key?.remoteJidAlt && !itemAny.key.remoteJidAlt.endsWith('@lid')) {
            item.key.remoteJid = itemAny.key.remoteJidAlt;
          } else if (itemAny.senderPn && !itemAny.senderPn.endsWith('@lid')) {
            item.key.remoteJid = itemAny.senderPn.includes('@') ? itemAny.senderPn : `${itemAny.senderPn}@s.whatsapp.net`;
          } else {
            const cleanLid = item.key.remoteJid.replace('@lid', '').replace(/\D/g, '');
            const resolvedPhone = await resolveLidToPhone(cleanLid, undefined, companyId);
            if (resolvedPhone) {
              logger.info(`🔍 [Evolution Webhook] Resuelto LID ${cleanLid} -> ${resolvedPhone}@s.whatsapp.net`);
              item.key.remoteJid = `${resolvedPhone}@s.whatsapp.net`;
            }
          }
        }

        try {
          const messageId = item.key.id;

          // Si el mensaje es un ProtocolMessage de tipo REVOKE recibido desde el receptor
          const protocolType = item.message?.protocolMessage?.type;
          const targetDeletedId = item.message?.protocolMessage?.key?.id;
          const isRevokeType = protocolType === 0 || protocolType === "REVOKE" || protocolType === "revoke" || item.messageStubType === 1;

          if (targetDeletedId && isRevokeType) {
            const targetMsg = await Message.findOne({
              where: { id: targetDeletedId, companyId }
            });
            if (targetMsg && !targetMsg.isDeleted) {
              await targetMsg.update({ isDeleted: true });
              await targetMsg.reload({
                include: [
                  "contact",
                  {
                    model: Message,
                    as: "quotedMsg",
                    include: ["contact"]
                  }
                ]
              });
              const io = getIO();
              io.to(targetMsg.ticketId.toString()).emit(`company-${companyId}-appMessage`, {
                action: "update",
                message: targetMsg
              });
              logger.info(`[Evolution Webhook] Mensaje ${targetDeletedId} revocado por el contacto.`);
            }
            continue;
          }

          const messageExists = await Message.count({
            where: { id: messageId, companyId }
          });

          if (!messageExists) {
            logger.info(`[Evolution] Procesando nuevo mensaje ID ${messageId} para JID: ${item.key.remoteJid}`);
            await handleMessage(item as WAMessage, fakeSession, companyId);
          }
        } catch (err) {
          logger.error(`[Evolution] Error al procesar mensaje ${item.key?.id}:`, err);
        }
      }

      return res.status(200).json({ status: "messages_processed" });
    }

    // 4. EVENTO: ACTUALIZACIÓN DE ACKS (MESSAGES_UPDATE)
    if (event === "messages.update" || event === "messages_update") {
      const updates = Array.isArray(body.data) ? body.data : [body.data];

      for (const updateItem of updates) {
        if (!updateItem || !updateItem.key) continue;

        let statusNumber = 1;
        const rawStatus = (updateItem.update?.status || updateItem.status || "").toString();

        if (rawStatus === "READ" || rawStatus === "3" || rawStatus === "read") {
          statusNumber = 3;
        } else if (rawStatus === "DELIVERY_ACK" || rawStatus === "2" || rawStatus === "delivered") {
          statusNumber = 2;
        } else if (rawStatus === "PLAYED" || rawStatus === "4") {
          statusNumber = 4;
        } else if (typeof rawStatus === "number") {
          statusNumber = rawStatus;
        }

        try {
          await handleMsgAck(updateItem as WAMessage, statusNumber);
        } catch (err) {
          logger.error(`[Evolution] Error actualizando ack para ${updateItem.key?.id}:`, err);
        }
      }

      return res.status(200).json({ status: "ack_processed" });
    }

    // 5. EVENTO: ELIMINACIÓN DE MENSAJES (MESSAGES.DELETE / MESSAGES_DELETE / MESSAGE.DELETE)
    if (
      event === "messages.delete" ||
      event === "messages_delete" ||
      event === "message.delete" ||
      event === "chats.delete"
    ) {
      logger.info(`[Evolution Webhook] Procesando evento de eliminación: "${event}" para WhatsApp ID ${whatsapp.id}`);
      const data = body.data;
      const messageIds: string[] = [];

      const extractId = (obj: any): string | null => {
        if (!obj) return null;
        if (typeof obj === "string") return obj;
        return obj.id || obj.key?.id || obj.message?.key?.id || obj.message?.id || null;
      };

      if (Array.isArray(data)) {
        for (const item of data) {
          const id = extractId(item);
          if (id) messageIds.push(id);
        }
      } else if (data) {
        if (Array.isArray(data.keys)) {
          for (const k of data.keys) {
            const id = extractId(k);
            if (id) messageIds.push(id);
          }
        } else if (Array.isArray(data.ids)) {
          for (const id of data.ids) {
            if (typeof id === "string") messageIds.push(id);
          }
        } else {
          const id = extractId(data);
          if (id) messageIds.push(id);
        }
      }

      for (const msgId of messageIds) {
        try {
          const msg = await Message.findOne({
            where: { id: msgId, companyId },
            include: [
              "contact",
              {
                model: Message,
                as: "quotedMsg",
                include: ["contact"]
              }
            ]
          });

          if (msg) {
            // Preservar el contenido original del mensaje (NO borrar el body) y marcar como eliminado
            await msg.update({ isDeleted: true });
            await msg.reload({
              include: [
                "contact",
                {
                  model: Message,
                  as: "quotedMsg",
                  include: ["contact"]
                }
              ]
            });

            const io = getIO();
            io.to(String(msg.ticketId)).emit(`company-${companyId}-appMessage`, {
              action: "update",
              message: msg
            });
            logger.info(`[Evolution Webhook] Mensaje ${msgId} marcado como eliminado (isDeleted: true) preservando el cuerpo.`);
          }
        } catch (delErr) {
          logger.error(`[Evolution Webhook] Error actualizando mensaje eliminado ${msgId}:`, delErr);
        }
      }

      return res.status(200).json({ status: "delete_processed", count: messageIds.length });
    }

    // 6. EVENTO: LLAMADA ENTRANTE (CALL)
    if (event === "call") {
      const callData = body.data;
      if (!callData) {
        return res.status(200).json({ status: "empty_call_data" });
      }

      const callId = callData.id || callData.callId;
      const from = callData.from || callData.callerJid || callData.remoteJid;
      const status = (callData.status || "").toLowerCase();

      if (!from) {
        return res.status(200).json({ status: "call_ignored_no_from" });
      }

      const cleanLidOrPhone = from.replace(/@.*$/, "").replace(/\D/g, "");
      let realPhone = cleanLidOrPhone;
      let isLid = from.endsWith("@lid") || cleanLidOrPhone.length >= 14;

      if (isLid) {
        const resolved = await resolveLidToPhone(cleanLidOrPhone, undefined, companyId);
        if (resolved) {
          realPhone = resolved;
          isLid = false;
        }
      }

      const sendMsgCall = await Setting.findOne({
        where: { key: "call", companyId }
      });
      const callDisabled = sendMsgCall?.value === "disabled";

      // Si está en offer y llamadas deshabilitadas, rechazar en Evolution
      if (status === "offer" && callDisabled && callId) {
        await EvolutionApiService.rejectCall(whatsapp, callId, from);
      }

      // Procesar llamada perdida si se corta, termina o si se rechazó
      if (status === "terminate" || status === "reject" || status === "timeout" || (status === "offer" && callDisabled)) {
        try {
          // 1. Contacto
          let contact = await Contact.findOne({
            where: { number: realPhone, companyId }
          });
          if (!contact) {
            contact = await Contact.create({
              number: realPhone,
              name: callData.name || callData.pushName || "Contacto WhatsApp",
              companyId,
              isGroup: false,
              ...(isLid ? { lid: cleanLidOrPhone } : {})
            });
          }

          // 2. Ticket
          let ticket = await Ticket.findOne({
            where: {
              contactId: contact.id,
              whatsappId: whatsapp.id,
              companyId,
              status: { [Op.not]: "closed" }
            },
            order: [["updatedAt", "DESC"]]
          });
          if (!ticket) {
            ticket = await Ticket.create({
              contactId: contact.id,
              whatsappId: whatsapp.id,
              companyId,
              status: "pending",
              isGroup: false,
              unreadMessages: 1
            });
          }

          // 3. Mensaje de llamada perdida
          const now = new Date();
          const hours = now.getHours().toString().padStart(2, "0");
          const minutes = now.getMinutes().toString().padStart(2, "0");
          const callBody = `📞 Llamada de voz/video perdida de ${contact.name || realPhone} (${realPhone}) a las ${hours}:${minutes}`;

          await CreateMessageService({
            messageData: {
              id: `call_evo_${callId || Date.now()}`,
              ticketId: ticket.id,
              contactId: contact.id,
              body: callBody,
              fromMe: false,
              mediaType: "call_log",
              read: true,
              ack: 1
            },
            companyId
          });
          await ticket.update({ lastMessage: callBody, status: "pending" });

          // 4. Mensaje automático si llamadas deshabilitadas
          if (callDisabled) {
            const autoMsgText = "*Mensaje Automático:*\n\nLas llamadas de voz y video están deshabilitadas para este WhatsApp, por favor envíe un mensaje de texto. Gracias";
            const destination = isLid ? (from.includes("@") ? from : `${cleanLidOrPhone}@lid`) : (realPhone.includes("@") ? realPhone : `${realPhone}@s.whatsapp.net`);

            const sentRes = await EvolutionApiService.sendTextMessage(whatsapp, destination, autoMsgText);
            const msgId = sentRes?.key?.id || sentRes?.id || `auto_call_${Date.now()}`;

            await CreateMessageService({
              messageData: {
                id: msgId,
                ticketId: ticket.id,
                contactId: contact.id,
                body: autoMsgText,
                fromMe: true,
                read: true,
                mediaType: "chat",
                ack: 1,
                remoteJid: destination
              },
              companyId
            });
            await ticket.update({ lastMessage: autoMsgText });
          }
        } catch (callErr) {
          logger.error("[Evolution Webhook] Error procesando llamada:", callErr);
        }
      }

      return res.status(200).json({ status: "call_processed" });
    }

    // 7. EVENTO: PRESENCIA / ESCRIBIENDO / GRABANDO (PRESENCE_UPDATE)
    if (event === "presence.update" || event === "presence_update" || event === "presence") {
      try {
        const presenceData = body.data;
        if (presenceData) {
          const remoteJid = presenceData.id || presenceData.remoteJid || presenceData.participant || "";
          const presenceVal = presenceData.presences?.[remoteJid]?.lastKnownPresence || presenceData.presence || presenceData.presences?.[remoteJid] || "";

          if (remoteJid && presenceVal) {
            const cleanNumber = remoteJid.replace(/\D/g, "");
            const contact = await Contact.findOne({
              where: {
                number: cleanNumber,
                companyId
              }
            });

            if (contact) {
              const ticket = await Ticket.findOne({
                where: {
                  contactId: contact.id,
                  whatsappId: whatsapp.id,
                  status: {
                    [Op.or]: ["open", "pending"]
                  }
                }
              });

              if (ticket) {
                const io = getIO();
                io.to(ticket.id.toString())
                  .to(`company-${companyId}-${ticket.status}`)
                  .to(`queue-${ticket.queueId}-${ticket.status}`)
                  .emit(`company-${companyId}-presence`, {
                    ticketId: ticket.id,
                    presence: presenceVal
                  });
              }
            }
          }
        }
      } catch (err: any) {
        logger.warn(`[Evolution Webhook] Error procesando presence.update: ${err?.message}`);
      }
      return res.status(200).json({ status: "presence_processed" });
    }

    return res.status(200).json({ status: "event_ignored", event });
  } catch (error: any) {
    logger.error("[Evolution Webhook] Error no controlado en webhook:", error);
    return res.status(200).json({ error: error?.message || "Internal Error" });
  }
};

/**
 * Prueba la conexión con el servidor Evolution API desde el panel de Chasap
 */
export const testEvolutionConnection = async (req: Request, res: Response): Promise<Response> => {
  const { url, apiKey } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, message: "La URL de Evolution API es obligatoria" });
  }

  const result = await EvolutionApiService.testConnection(url, apiKey || "");
  return res.status(200).json(result);
};

/**
 * Inicia la conexión o genera el QR a través de Evolution API
 */
export const connectEvolution = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp) {
    return res.status(404).json({ error: "WhatsApp no encontrado" });
  }

  try {
    // 1. Asegurar creación de instancia
    await EvolutionApiService.createInstance(whatsapp);

    // 2. Obtener estado o QR
    const connectResult = await EvolutionApiService.connectInstance(whatsapp);

    const code = connectResult?.code || connectResult?.qrcode?.code || connectResult?.base64 || connectResult?.qrcode?.base64;
    if (code) {
      await whatsapp.update({
        qrcode: code,
        status: "qrcode"
      });

      const io = getIO();
      io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
        action: "update",
        session: whatsapp
      });
    }

    return res.status(200).json({ success: true, data: connectResult });
  } catch (error: any) {
    logger.error(`Error al conectar con Evolution API para WhatsApp ${whatsappId}:`, error);
    return res.status(500).json({ error: error.message || "Error al conectar con Evolution API" });
  }
};

/**
 * Desconecta la sesión en Evolution API
 */
export const disconnectEvolution = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp) {
    return res.status(404).json({ error: "WhatsApp no encontrado" });
  }

  try {
    await EvolutionApiService.logoutInstance(whatsapp);
    await whatsapp.update({
      status: "DISCONNECTED",
      qrcode: ""
    });

    const io = getIO();
    io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
      action: "update",
      session: whatsapp
    });

    return res.status(200).json({ success: true, message: "Sesión cerrada correctamente" });
  } catch (error: any) {
    logger.error(`Error al desconectar Evolution API para WhatsApp ${whatsappId}:`, error);
    return res.status(500).json({ error: error.message || "Error al desconectar Evolution API" });
  }
};
