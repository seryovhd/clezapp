import { Op } from "sequelize";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import CreateMessageService from "../MessageServices/CreateMessageService";
import ShowTicketService from "./ShowTicketService";
import Whatsapp from "../../models/Whatsapp";
import { getIO } from "../../libs/socket";

const CreateLogService = async ({ ticketId, type }: { ticketId: number; type: string }) => {
  console.log(`📝 Log creado para ticket ${ticketId}, tipo: ${type}`);
};

interface Request {
  message: any;
  whatsapp: Whatsapp;
}

interface MessageData {
  id: string;
  timestamp: number;
  type: string;
  from: string;
  body?: string;
  media?: any;
}

export const processBusinessMessage = async ({
  message,
  whatsapp
}: Request): Promise<void> => {
  try {
    console.log("🔄 Procesando mensaje Business API para ticket:", message.id);

    const messageData: MessageData = {
      id: message.id,
      timestamp: message.timestamp,
      type: message.type,
      from: message.from
    };

    if (message.type === "text" && message.text) {
      messageData.body = message.text.body;
    } else if (message.type === "interactive" && message.interactive) {
      messageData.body = message.interactive.button_reply?.title ||
        message.interactive.list_reply?.title ||
        "Mensaje interactivo";
    } else if (message.type === "image" && message.image) {
      messageData.body = message.image.caption || "📷 Imagen";
      messageData.media = message.image;
    } else if (message.type === "document" && message.document) {
      messageData.body = message.document.caption || "📄 Documento";
      messageData.media = message.document;
    } else if (message.type === "audio" && message.audio) {
      messageData.body = "🎧 Audio";
      messageData.media = message.audio;
    } else if (message.type === "video" && message.video) {
      messageData.body = message.video.caption || "🎬 Video";
      messageData.media = message.video;
    } else {
      messageData.body = `Mensaje tipo: ${message.type}`;
    }

    let contact = await Contact.findOne({
      where: { number: message.from, companyId: whatsapp.companyId }
    });

    if (!contact) {
      contact = await Contact.create({
        number: message.from,
        name: message.from,
        companyId: whatsapp.companyId
      });
      console.log("✅ Contacto creado:", contact.id);
    }
    if (!contact.canal) {
      await contact.update({
        canal: "whatsapp_business"
      });
      console.log("✅ Canal actualizado para Business API");
    }
    let ticket = await Ticket.findOne({
      where: {
        contactId: contact.id,
        companyId: whatsapp.companyId,
        status: { [Op.in]: ["open", "pending"] }
      },
      include: [{ model: Whatsapp, as: "whatsapp", where: { id: whatsapp.id } }]
    });

    if (!ticket) {
      ticket = await Ticket.create({
        contactId: contact.id,
        companyId: whatsapp.companyId,
        whatsappId: whatsapp.id,
        status: "pending",
        isGroup: false,
        unreadMessages: 1,
        lastMessage: messageData.body
      });
      console.log("✅ Ticket creado:", ticket.id);

      await CreateLogService({
        ticketId: ticket.id,
        type: "create"
      });
    } else {
      await ticket.update({
        unreadMessages: (ticket.unreadMessages || 0) + 1,
        lastMessage: messageData.body
      });
    }

    const existingMessage = await Message.findOne({
      where: { id: messageData.id }
    });

    if (!existingMessage) {
      await CreateMessageService({
        messageData: {
          id: messageData.id,
          ticketId: ticket.id,
          body: messageData.body || "",
          contactId: contact.id,
          fromMe: false,
          mediaType: messageData.type,
          mediaUrl: messageData.media ? JSON.stringify(messageData.media) : null
        },
        companyId: whatsapp.companyId
      });
      console.log("✅ Mensaje guardado en BD:", messageData.id);
    } else {
      console.log("ℹ️ Mensaje ya existe:", messageData.id);
    }

    const ticketWithRelation = await ShowTicketService(ticket.id, whatsapp.companyId);
    const io = getIO();
    io.to(`company-${whatsapp.companyId}-mainchannel`).emit(`company-${whatsapp.companyId}-ticket`, {
      action: "update",
      ticket: ticketWithRelation
    });
    console.log("✅ Procesamiento completado para mensaje:", messageData.id);

  } catch (error) {
    console.error("❌ Error en processBusinessMessage:", error);
    throw error;
  }
};