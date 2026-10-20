import Whatsapp from "../../models/Whatsapp";
import Ticket from "../../models/Ticket";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import EvolutionApiService from "./EvolutionApiService";
import Message from "../../models/Message";
import { handleMessage } from "../WbotServices/wbotMessageListener";
import { WAMessage } from "@whiskeysockets/baileys";
import { resolveLidToPhone } from "../../helpers/ResolveLidHelper";

class EvolutionMonitorService {
  private timer: NodeJS.Timeout | null = null;
  private isChecking = false;
  private lastPolledTimestamp: number = Math.floor(Date.now() / 1000) - 5;
  private processedMessageIds: Set<string> = new Set();
  private deletedMessageIds: Set<string> = new Set();

  public markMessagesAsDeleted(ids: string[]) {
    ids.forEach(id => {
      this.deletedMessageIds.add(id);
      this.processedMessageIds.add(id);
    });
    this.pruneMemory();
  }

  private pruneMemory() {
    if (this.processedMessageIds.size > 5000) {
      const arr = Array.from(this.processedMessageIds);
      this.processedMessageIds = new Set(arr.slice(-2000));
    }
    if (this.deletedMessageIds.size > 2000) {
      const arr = Array.from(this.deletedMessageIds);
      this.deletedMessageIds = new Set(arr.slice(-1000));
    }
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

      // Usar adaptador WASocket unificado para Evolution API
      const fakeSession = EvolutionApiService.buildEvolutionSession(whatsapp);

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

        // Verificar si Evolution API reporta el mensaje como eliminado (deleted: true, message: null o status DELETED)
        const isDeletedInEvolution =
          item.key?.deleted === true ||
          item.message === null ||
          (item.status || "").toString().toUpperCase() === "DELETED" ||
          (Array.isArray(item.MessageUpdate) &&
            item.MessageUpdate.some(
              (u: any) => (u.status || "").toString().toUpperCase() === "DELETED"
            ));

        if (existingMsg) {
          if (isDeletedInEvolution && !existingMsg.isDeleted) {
            if (!existingMsg.contactId && existingMsg.ticketId) {
              const t = await Ticket.findByPk(existingMsg.ticketId);
              if (t?.contactId) {
                await existingMsg.update({ contactId: t.contactId });
              }
            }
            await existingMsg.update({ isDeleted: true });
            await existingMsg.reload({
              include: [
                "contact",
                {
                  model: Message,
                  as: "quotedMsg",
                  include: ["contact"]
                }
              ]
            });
            if (!existingMsg.contact && existingMsg.ticketId) {
              const t = await Ticket.findByPk(existingMsg.ticketId, { include: ["contact"] });
              if (t?.contact) {
                (existingMsg as any).contact = t.contact;
              }
            }
            const io = getIO();
            io.to(existingMsg.ticketId.toString()).emit(`company-${companyId}-appMessage`, {
              action: "update",
              message: existingMsg
            });
            logger.info(`[Evolution Monitor] Mensaje ${messageId} detectado como eliminado en WhatsApp. Actualizado en Clezapp.`);
          } else if (existingMsg.ack < calculatedAck) {
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

        // Si el mensaje es un ProtocolMessage de tipo REVOKE recibido desde el receptor
        const protocolType = item.message?.protocolMessage?.type;
        const targetDeletedId = item.message?.protocolMessage?.key?.id;
        const isRevokeType = protocolType === 0 || protocolType === "REVOKE" || protocolType === "revoke" || item.messageStubType === 1;

        if (targetDeletedId && isRevokeType) {
          const targetMsg = await Message.findOne({
            where: { id: targetDeletedId, companyId },
            include: [
              "contact",
              {
                model: Message,
                as: "quotedMsg",
                include: ["contact"]
              }
            ]
          });

          if (targetMsg && !targetMsg.isDeleted) {
            if (!targetMsg.contactId && targetMsg.ticketId) {
              const t = await Ticket.findByPk(targetMsg.ticketId);
              if (t?.contactId) {
                await targetMsg.update({ contactId: t.contactId });
              }
            }
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
            if (!targetMsg.contact && targetMsg.ticketId) {
              const t = await Ticket.findByPk(targetMsg.ticketId, { include: ["contact"] });
              if (t?.contact) {
                (targetMsg as any).contact = t.contact;
              }
            }
            const io = getIO();
            io.to(targetMsg.ticketId.toString()).emit(`company-${companyId}-appMessage`, {
              action: "update",
              message: targetMsg
            });
            logger.info(`[Evolution Monitor] Mensaje ${targetDeletedId} revocado por el contacto. Notificado al frontend.`);
          }
          this.processedMessageIds.add(messageId);
          continue;
        }

        if (isDeletedInEvolution) {
          this.processedMessageIds.add(messageId);
          continue;
        }

        // Si el mensaje fue explícitamente eliminado por el usuario o ya fue procesado, NUNCA recrearlo
        if (this.deletedMessageIds.has(messageId) || this.processedMessageIds.has(messageId)) {
          continue;
        }

        // Procesar tanto mensajes entrantes como salientes (enviados desde el móvil o WhatsApp Web)
        const msgTimestamp = item.messageTimestamp || 0;
        if (msgTimestamp >= this.lastPolledTimestamp) {
          this.processedMessageIds.add(messageId);
          item.status = calculatedAck;

          // Normalizar JID si viene con LID
          const itemAny = item as any;
          if (item.key?.remoteJid?.endsWith('@lid') || (item.key?.remoteJid?.replace(/\D/g, "").length >= 14 && !item.key.remoteJid.includes('@s.whatsapp.net') && !item.key.remoteJid.includes('@g.us'))) {
            if (itemAny.key?.remoteJidAlt && !itemAny.key.remoteJidAlt.endsWith('@lid')) {
              item.key.remoteJid = itemAny.key.remoteJidAlt;
            } else if (itemAny.senderPn && !itemAny.senderPn.endsWith('@lid')) {
              item.key.remoteJid = itemAny.senderPn.includes('@') ? itemAny.senderPn : `${itemAny.senderPn}@s.whatsapp.net`;
            } else {
              const cleanLid = item.key.remoteJid.replace('@lid', '').replace(/\D/g, '');
              const resolvedPhone = await resolveLidToPhone(cleanLid, undefined, companyId);
              if (resolvedPhone) {
                logger.info(`🔍 [Evolution Monitor] Resuelto LID ${cleanLid} -> ${resolvedPhone}@s.whatsapp.net`);
                item.key.remoteJid = `${resolvedPhone}@s.whatsapp.net`;
              }
            }
          }

          const direction = item.key.fromMe ? "saliente (móvil/web)" : "entrante";
          logger.info(`[Evolution Monitor] Nuevo mensaje ${direction} ID ${messageId} en ${item.key.remoteJid}: "${item.message?.conversation || item.message?.extendedTextMessage?.text || 'media'}"`);
          await handleMessage(item as WAMessage, fakeSession, companyId);
        } else {
          // Es un mensaje histórico antiguo: marcarlo para no reevaluarlo
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
