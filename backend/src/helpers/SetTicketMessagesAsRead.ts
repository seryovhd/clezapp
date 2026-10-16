import { proto, WASocket } from "@whiskeysockets/baileys";
import { cacheLayer } from "../libs/cache";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";
import EvolutionApiService from "../services/EvolutionApiServices/EvolutionApiService";
import { getDestinationJid } from "./ResolveLidHelper";

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {
  await ticket.update({ unreadMessages: 0 });
  await cacheLayer.set(`contacts:${ticket.contactId}:unreads`, "0");

  try {
    if (!ticket.whatsapp) {
      await ticket.$get("whatsapp");
    }

    if (!ticket.contact) {
      await ticket.$get("contact");
    }

    // Buscar todos los mensajes entrantes aún no leídos para este ticket
    const unreadMessages = await Message.findAll({
      where: {
        ticketId: ticket.id,
        fromMe: false,
        read: false
      },
      order: [["createdAt", "DESC"]]
    });

    const evolutionConfig = await EvolutionApiService.getConfig(ticket.companyId);
    const isEvolution = ticket.whatsapp?.type === "evolution" ||
      ticket.whatsapp?.connectionType === "evolution" ||
      (evolutionConfig.enabled && ticket.whatsapp?.connectionType !== "baileys" && ticket.whatsapp?.type !== "baileys");

    // ==========================================
    // 1. CASO EVOLUTION API v2
    // ==========================================
    if (isEvolution && ticket.whatsapp) {
      if (unreadMessages.length > 0) {
        const destination = await getDestinationJid(ticket);
        const readPayload = unreadMessages.map(m => ({
          id: m.id,
          fromMe: false,
          remoteJid: m.remoteJid || destination
        }));

        await EvolutionApiService.markMessagesAsRead(ticket.whatsapp, readPayload);
      }
    } 
    // ==========================================
    // 2. CASO BAILEYS (WHATSAPP WEB PROTOCOL)
    // ==========================================
    else if (ticket.whatsapp?.type !== "facebook_messenger" && ticket.whatsapp?.type !== "whatsapp_business") {
      try {
        const wbot = await GetTicketWbot(ticket);
        if (wbot) {
          const destination = await getDestinationJid(ticket, wbot);

          if (unreadMessages.length > 0) {
            const keys: proto.IMessageKey[] = [];

            for (const msg of unreadMessages) {
              let parsedKey: any = null;
              if (msg.dataJson) {
                try {
                  const parsed = typeof msg.dataJson === "string" ? JSON.parse(msg.dataJson) : msg.dataJson;
                  parsedKey = parsed?.key;
                } catch (e) {}
              }

              keys.push({
                remoteJid: parsedKey?.remoteJid || msg.remoteJid || destination,
                id: msg.id,
                fromMe: false,
                participant: parsedKey?.participant || msg.participant || undefined
              });
            }

            // A) Enviar recibos de lectura a WhatsApp (doble check azul y sync a companion devices)
            try {
              await (wbot as WASocket).readMessages(keys);
            } catch (eRead) {
              logger.warn(`[Baileys] Error enviando readMessages: ${eRead}`);
            }

            // B) Modificar el contador de no leídos a 0 en WhatsApp Web y Móvil (syncd state)
            try {
              const lastKey = keys[0];
              await (wbot as WASocket).chatModify(
                {
                  markRead: true,
                  lastMessages: [{ key: lastKey }]
                },
                destination
              );
            } catch (eModify) {
              logger.warn(`[Baileys] Error en chatModify markRead: ${eModify}`);
            }
          }
        }
      } catch (errWbot: any) {
        if (!errWbot?.message?.includes("ERR_WAPP_NOT_INITIALIZED")) {
          logger.warn(`[Baileys] No se pudo obtener wbot para marcar leído: ${errWbot}`);
        }
      }
    }

    // Actualizar todos los mensajes pendientes en la BD local a leído
    await Message.update(
      { read: true },
      {
        where: {
          ticketId: ticket.id,
          read: false
        }
      }
    );
  } catch (err: any) {
    if (
      err.message?.includes("ERR_BUSINESS_API_NO_WBOT") ||
      err.message?.includes("ERR_FACEBOOK_NO_WBOT")
    ) {
      return;
    }
    logger.warn(`⚠️ Error marcando mensajes como leídos en WhatsApp: ${err?.message || err}`);
  }

  const io = getIO();
  io.to(`company-${ticket.companyId}-mainchannel`).emit(`company-${ticket.companyId}-ticket`, {
    action: "updateUnread",
    ticketId: ticket.id
  });
};

export default SetTicketMessagesAsRead;