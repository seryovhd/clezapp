import { proto, WASocket } from "@whiskeysockets/baileys";
import { cacheLayer } from "../libs/cache";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";
import AppError from "../errors/AppError";

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {
  await ticket.update({ unreadMessages: 0 });
  await cacheLayer.set(`contacts:${ticket.contactId}:unreads`, "0");

  try {
    if (!ticket.whatsapp) {
      await ticket.$get("whatsapp");
    }

    // ✅ NO INTENTAR MARCAR COMO LEÍDO CON GetTicketWbot PARA BUSINESS API, FACEBOOK O EVOLUTION API
    if (ticket.whatsapp?.type === "whatsapp_business" || 
        ticket.whatsapp?.type === "facebook_messenger" ||
        ticket.whatsapp?.type === "evolution" ||
        ticket.whatsapp?.connectionType === "evolution") {
      
      await Message.update(
        { read: true },
        {
          where: {
            ticketId: ticket.id,
            read: false
          }
        }
      );
      
      const io = getIO();
      io.to(`company-${ticket.companyId}-mainchannel`).emit(`company-${ticket.companyId}-ticket`, {
        action: "updateUnread",
        ticketId: ticket.id
      });
      
      return;
    }

    // ✅ SOLO WHATSAPP-WEB.JS (BAILEYS) USA GetTicketWbot
    const wbot = await GetTicketWbot(ticket);

    const getJsonMessage = await Message.findAll({
      where: {
        ticketId: ticket.id,
        fromMe: false,
        read: false
      },
      order: [["createdAt", "DESC"]]
    });

    if (getJsonMessage.length > 0) {
      const lastMessages: proto.IWebMessageInfo = JSON.parse(
        JSON.stringify(getJsonMessage[0].dataJson)
      );

      if (lastMessages.key && lastMessages.key.fromMe === false) {
        const minimalMessage = {
          ...lastMessages,
          key: lastMessages.key!
        };

        await (wbot as WASocket).chatModify(
          { markRead: true, lastMessages: [minimalMessage] },
          `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`
        );
      }
    }

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
    // ✅ NO LOGGEAR ERROR PARA BUSINESS API O FACEBOOK
    if (err.message?.includes("ERR_BUSINESS_API_NO_WBOT") || 
        err.message?.includes("ERR_FACEBOOK_NO_WBOT")) {
      return;
    }
    logger.warn(`⚠️ NO SE PUDIERON MARCAR LOS MENSAJES COMO LEÍDOS. ¿QUIZÁ SESIÓN DE WHATSAPP DESCONECTADA? ERR: ${err}`);
  }

  const io = getIO();
  io.to(`company-${ticket.companyId}-mainchannel`).emit(`company-${ticket.companyId}-ticket`, {
    action: "updateUnread",
    ticketId: ticket.id
  });
};

export default SetTicketMessagesAsRead;