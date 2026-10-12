import { Request, Response } from "express";
import Whatsapp from "../models/Whatsapp";
import { getIO } from "../libs/socket";
import { logger } from "../utils/logger";
import EvolutionApiService from "../services/EvolutionApiServices/EvolutionApiService";
import { handleMessage, handleMsgAck } from "../services/WbotServices/wbotMessageListener";
import { WAMessage } from "@whiskeysockets/baileys";
import Message from "../models/Message";

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

      // Crear objeto de sesión simulada para compatibilidad con los servicios de Chasap
      const fakeSession: any = {
        id: whatsapp.id,
        type: "evolution",
        sendMessage: async (jid: string, content: any, options: any) => {
          if (content.text) {
            return await EvolutionApiService.sendTextMessage(whatsapp!, jid, content.text, {
              quotedMessageId: options?.quoted?.key?.id
            });
          } else if (content.image || content.video || content.audio || content.document) {
            const mediaType = content.image ? "image" : content.video ? "video" : content.audio ? "audio" : "document";
            const media = content.image?.url || content.video?.url || content.audio?.url || content.document?.url;
            return await EvolutionApiService.sendMediaMessage(whatsapp!, jid, {
              media,
              mediaType,
              caption: content.caption
            });
          }
        }
      };

      for (const item of rawMessages) {
        if (!item || !item.key) continue;

        try {
          const messageId = item.key.id;
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
