import Whatsapp from "../../models/Whatsapp";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import EvolutionApiService from "./EvolutionApiService";
import Message from "../../models/Message";
import { handleMessage } from "../WbotServices/wbotMessageListener";
import { WAMessage } from "@whiskeysockets/baileys";

class EvolutionMonitorService {
  private timer: NodeJS.Timeout | null = null;
  private isChecking = false;
  private lastPolledTimestamp: number = Math.floor(Date.now() / 1000) - 300;
  private processedMessageIds: Set<string> = new Set();
  private deletedMessageIds: Set<string> = new Set();

  public markMessagesAsDeleted(ids: string[]) {
    ids.forEach(id => {
      this.deletedMessageIds.add(id);
      this.processedMessageIds.add(id);
    });
  }

  public start() {
    if (this.timer) return;
    logger.info("🚀 [Evolution Monitor] Servicio de monitoreo y sincronización iniciado");
    // Ejecutar cada 3 segundos
    this.timer = setInterval(() => {
      this.checkAllInstances().catch(err => {
        logger.error("[Evolution Monitor] Error en ciclo de verificación:", err?.message || err);
      });
    }, 3000);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async checkAllInstances() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      // Buscar todos los WhatsApps configurados con Evolution API
      const whatsapps = await Whatsapp.findAll({
        where: {
          type: "evolution"
        }
      });

      if (!whatsapps || whatsapps.length === 0) {
        this.isChecking = false;
        return;
      }

      for (const whatsapp of whatsapps) {
        await this.checkInstance(whatsapp);
      }
    } catch (err: any) {
      logger.error("[Evolution Monitor] Error al buscar whatsapps:", err?.message || err);
    } finally {
      this.isChecking = false;
    }
  }

  public async checkInstance(whatsapp: Whatsapp) {
    try {
      const companyId = whatsapp.companyId;
      const io = getIO();
      const instanceName = EvolutionApiService.getInstanceName(whatsapp);

      // 1. Obtener estado de la instancia en Evolution API
      let instanceData: any = null;
      try {
        const instances = await EvolutionApiService.request(companyId, "/instance/fetchInstances", "GET");
        if (Array.isArray(instances)) {
          instanceData = instances.find((i: any) => i.name === instanceName);
        }
      } catch (err: any) {
        // Servidor no disponible temporalmente
        return;
      }

      if (!instanceData) {
        // La instancia aún no existe en el servidor Evolution
        return;
      }

      const connectionStatus = (instanceData.connectionStatus || "").toLowerCase();
      const rawNumber = instanceData.ownerJid || "";
      const cleanNumber = rawNumber ? rawNumber.replace(/[^0-9]/g, "") : whatsapp.number;

      // SI LA CONEXIÓN ESTÁ ABIERTA (CONECTADO)
      if (connectionStatus === "open") {
        const shouldUpdate =
          whatsapp.status !== "CONNECTED" ||
          whatsapp.qrcode !== "" ||
          (cleanNumber && whatsapp.number !== cleanNumber);

        if (shouldUpdate) {
          logger.info(`✅ [Evolution Monitor] WhatsApp ID ${whatsapp.id} (${whatsapp.name}) CONECTADO con número: ${cleanNumber}`);

          await whatsapp.update({
            status: "CONNECTED",
            qrcode: "",
            number: cleanNumber || whatsapp.number,
            retries: 0
          });

          // Notificar vía socket para cerrar el modal del QR y actualizar la tarjeta
          io.emit(`company-${companyId}-whatsappSession`, {
            action: "update",
            session: whatsapp
          });

          io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-whatsapp`, {
            action: "update",
            whatsapp
          });
        }

        // 2. SINCRONIZACIÓN DE MENSAJES RECIENTES (Útil para entorno local donde el webhook no puede llegar directamente)
        await this.syncRecentMessages(whatsapp);

      } else if (connectionStatus === "close" || connectionStatus === "disconnected") {
        if (whatsapp.status === "CONNECTED") {
          logger.warn(`⚠️ [Evolution Monitor] WhatsApp ID ${whatsapp.id} (${whatsapp.name}) DESCONECTADO en Evolution`);

          await whatsapp.update({
            status: "DISCONNECTED",
            qrcode: ""
          });

          io.emit(`company-${companyId}-whatsappSession`, {
            action: "update",
            session: whatsapp
          });

          io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-whatsapp`, {
            action: "update",
            whatsapp
          });
        }
      }
    } catch (err: any) {
      logger.error(`[Evolution Monitor] Error al verificar instancia de ${whatsapp.name}:`, err?.message || err);
    }
  }

  /**
   * Sincroniza mensajes recientes directamente desde Evolution API
   */
  private async syncRecentMessages(whatsapp: Whatsapp) {
    try {
      const instanceName = EvolutionApiService.getInstanceName(whatsapp);
      const companyId = whatsapp.companyId;

      const res = await EvolutionApiService.request(
        companyId,
        `/chat/findMessages/${encodeURIComponent(instanceName)}`,
        "POST",
        {
          where: {},
          take: 50,
          order: {
            messageTimestamp: "desc"
          }
        }
      );

      const records = res?.messages?.records || res?.records || [];
      if (!Array.isArray(records) || records.length === 0) return;

      const fakeSession: any = {
        id: whatsapp.id,
        type: "evolution",
        sendMessage: async (jid: string, content: any, options: any) => {
          if (content.text) {
            return await EvolutionApiService.sendTextMessage(whatsapp, jid, content.text, {
              quotedMessageId: options?.quoted?.key?.id
            });
          } else if (content.image || content.video || content.audio || content.document) {
            const mediaType = content.image ? "image" : content.video ? "video" : content.audio ? "audio" : "document";
            let media: any;
            if (Buffer.isBuffer(content.image)) {
              media = content.image.toString("base64");
            } else if (Buffer.isBuffer(content.video)) {
              media = content.video.toString("base64");
            } else if (Buffer.isBuffer(content.audio)) {
              media = content.audio.toString("base64");
            } else if (Buffer.isBuffer(content.document)) {
              media = content.document.toString("base64");
            } else {
              media = content.image?.url || content.video?.url || content.audio?.url || content.document?.url || content.image || content.video || content.audio || content.document;
            }
            return await EvolutionApiService.sendMediaMessage(whatsapp, jid, {
              media,
              mediaType: mediaType as any,
              caption: content.caption,
              mimetype: content.mimetype,
              fileName: content.fileName
            });
          }
        }
      };

      // Ordenar cronológicamente (los más antiguos primero para procesamiento secuencial)
      const sortedRecords = [...records].reverse();

      for (const item of sortedRecords) {
        if (!item || !item.key || !item.key.id) continue;

        const messageId = item.key.id;

        // Determinar ack reportado por Evolution considerando todo el historial de actualizaciones
        let calculatedAck = item.key.fromMe ? 1 : 0;
        if (Array.isArray(item.MessageUpdate)) {
          for (const u of item.MessageUpdate) {
            const st = (u.status || "").toString().toUpperCase();
            if (st.includes("READ")) calculatedAck = Math.max(calculatedAck, 3);
            else if (st.includes("DELIVERY") || st.includes("DELIVERED")) calculatedAck = Math.max(calculatedAck, 2);
            else if (st.includes("SERVER") || st.includes("SENT")) calculatedAck = Math.max(calculatedAck, 1);
            else if (st.includes("PLAYED")) calculatedAck = Math.max(calculatedAck, 4);
          }
        }

        const directStatus = (item.status || "").toString().toUpperCase();
        if (directStatus.includes("READ")) calculatedAck = Math.max(calculatedAck, 3);
        else if (directStatus.includes("DELIVERY") || directStatus.includes("DELIVERED")) calculatedAck = Math.max(calculatedAck, 2);
        else if (directStatus.includes("PLAYED")) calculatedAck = Math.max(calculatedAck, 4);

        const existingMsg = await Message.findOne({
          where: { id: messageId, companyId }
        });

        if (existingMsg) {
          if (existingMsg.ack < calculatedAck) {
            await existingMsg.update({ ack: calculatedAck });
            const io = getIO();
            io.to(existingMsg.ticketId.toString()).emit(`company-${companyId}-appMessage`, {
              action: "update",
              message: existingMsg
            });
          }
          this.processedMessageIds.add(messageId);
          continue;
        }

        // Si el mensaje fue explícitamente eliminado por el usuario o ya fue procesado, NUNCA recrearlo
        if (this.deletedMessageIds.has(messageId) || this.processedMessageIds.has(messageId)) {
          continue;
        }

        // Solo procesar como nuevo si es un mensaje entrante (!fromMe) y su fecha es reciente (>= lastPolledTimestamp)
        const msgTimestamp = item.messageTimestamp || 0;
        if (!item.key.fromMe && msgTimestamp >= this.lastPolledTimestamp) {
          this.processedMessageIds.add(messageId);
          item.status = calculatedAck;
          logger.info(`[Evolution Monitor] Nuevo mensaje entrante ID ${messageId} desde ${item.key.remoteJid}: "${item.message?.conversation || item.message?.extendedTextMessage?.text || 'media'}"`);
          await handleMessage(item as WAMessage, fakeSession, companyId);
        } else {
          // Es un mensaje histórico antiguo o saliente: marcarlo para no reevaluarlo
          this.processedMessageIds.add(messageId);
        }
      }
    } catch (err: any) {
      // Ignorar errores temporales de sincronización
    }
  }
}

export const EvolutionMonitor = new EvolutionMonitorService();
export default EvolutionMonitor;
