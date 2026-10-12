import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import { downloadFiles } from "../../helpers/downloadHubFiles";
import CreateMessageService from "./CreateHubMessageService";
import FindOrCreateContactService from "./FindOrCreateHubContactService";
import { UpdateMessageAck } from "./UpdateMessageHubAck";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import { getIO } from "../../libs/socket";
import Message from "../../models/Message";

export interface HubInMessage {
  type: "MESSAGE";
  id: string;
  timestamp: string;
  subscriptionId: string;
  channel: "telegram" | "whatsapp" | "facebook" | "instagram" | "sms" | "email" | "webchat";
  direction: "IN";
  message: {
    id: string;
    from: string;
    to: string;
    direction: "IN";
    channel: "telegram" | "whatsapp" | "facebook" | "instagram" | "sms" | "email" | "webchat";
    visitor: {
      name: string;
      firstName: string;
      lastName: string;
      picture: string;
    };
    contents: IContent[];
    timestamp: string;
  };
}

export interface IContent {
  type: "text" | "image" | "audio" | "video" | "file" | "location";
  text?: string;
  url?: string;
  fileUrl?: string;
  latitude?: number;
  longitude?: number;
  filename?: string;
  fileSize?: number;
  fileMimeType?: string;
}

export interface HubConfirmationSentMessage {
  type: "MESSAGE_STATUS";
  timestamp: string;
  subscriptionId: string;
  channel: "telegram" | "whatsapp" | "facebook" | "instagram" | "sms" | "email" | "webchat";
  messageId: string;
  contentIndex: number;
  messageStatus: {
    timestamp: string;
    code: "SENT" | "REJECTED";
    description: string;
  };
}

const verifySentMessageStatus = (message: HubConfirmationSentMessage): boolean => {
  return message.messageStatus.code === "SENT";
};

const HubMessageListener = async (
  message: any | HubInMessage | HubConfirmationSentMessage,
  whatsapp: Whatsapp,
  medias: Express.Multer.File[]
): Promise<void> => {
  // MUESTRA MENSAJES DEL HUB
  //console.log("📡 HubMessageListener:: ", message); // HUB DEPURACIÓN
  //console.log("📑 CONTENIDOS:: ", message.message?.contents); // HUB DEPURACIÓN  

  // Ignorar si el mensaje es de salida
  if (message.direction === "OUT") return;

  // Si es un mensaje enviado por mí
  if (message.type === "MESSAGE_STATUS") {
    const isMessageSent = verifySentMessageStatus(message as HubConfirmationSentMessage);
    if (isMessageSent) {
      console.log("📤 HubMessageListener:: MENSAJE ENVIADO");
      UpdateMessageAck(message.messageId);
    } /* else {
      console.log("❌ HubMessageListener:: MENSAJE NO ENVIADO (", message.messageStatus.code, " - ", message.messageStatus.description, ")"); // // HUB DEPURACIÓN
    }  */   
    return;
  }

  // Verificar que el mensaje tenga contenido antes de procesarlo
  if (!message.message || !message.message.contents || message.message.contents.length === 0) {
    console.warn("Mensaje inválido o sin contenido:", message);
    return;
  }

  const { id, from, channel, contents, visitor } = message.message;

  try {
    // Obtener o crear contacto
    console.log("📡 HubMessageListener:: DE: ", from);
    const contact = await FindOrCreateContactService({
      ...visitor,
      number: from, // <-- agregas esta línea
      from,
      whatsapp,
      channel,
      companyId: whatsapp.companyId
    });

    // Obtener o crear ticket
    const ticket = await FindOrCreateTicketService(
      contact,
      whatsapp.id!, 
      1,  // Mensajes no leídos
      contact.companyId || whatsapp.companyId
    );

    const companyId = contact.companyId || whatsapp.companyId || ticket.companyId;

    if (!companyId) {
      console.error("Error: companyId no encontrado.");
      throw new Error("Error: companyId no encontrado.");
    }

    // Procesar contenido del mensaje
    const content = contents[0];
    console.log("📡 HubMessageListener:: PRUEBA: ", contact.id);
    if (content?.type === "text") {
      const existingMessage = await Message.findOne({ where: { id } });
      if (existingMessage) {
        console.log("⚠️ Mensaje duplicado (texto) ignorado:", id);
        return;
      }
      await CreateMessageService({
        id,
        contactId: contact.id,
        body: (content.text || "").slice(0, 255),
        ticketId: ticket.id,
        fromMe: false,
        companyId
      });

      await Ticket.update({ lastMessage: (content.text || "").slice(0, 255) }, { where: { id: ticket.id } });

      // Emitir evento de actualización de ticket
      const io = getIO();
      const updatedTicket = await Ticket.findByPk(ticket.id, { include: ["contact"] });

      if (updatedTicket) {
        io.to(updatedTicket.status)
          .to(ticket.id.toString())
          .emit(`company-${companyId}-ticket`, {
            action: "update",
            ticket: updatedTicket
          });
          console.log("📩 EVENTO 'TICKET' EMITIDO PARA MENSAJE DE TEXTO:", updatedTicket);
      }
    } else if (content?.fileUrl) {
      const media = await downloadFiles(content.fileUrl, companyId, content.type);

      if (typeof media.mimeType === "string") {
        await CreateMessageService({
          id,
          contactId: contact.id,
          body: content.text || "",
          ticketId: ticket.id,
          fromMe: false,
          companyId,
          fileName: media.filename,
          mediaType: media.mimeType.split("/")[0],
          originalName: media.originalname
        });
        
        await Ticket.update({ lastMessage: content.text || media.originalname }, { where: { id: ticket.id } });        

        // Emitir evento de actualización de ticket con archivo
        const io = getIO();
        const updatedTicket = await Ticket.findByPk(ticket.id, { include: ["contact"] });

        if (updatedTicket) {
          io.to(updatedTicket.status)
            .to(ticket.id.toString())
            .emit(`company-${companyId}-ticket`, {
              action: "update",
              ticket: updatedTicket
            });

            console.log("📁 EVENTO 'TICKET' EMITIDO PARA MENSAJE CON ARCHIVO:", updatedTicket);
        }
      }
    } else {
      console.log("❌ CONTENIDO NO SOPORTADO O NO ENCONTRADO:", content);
    }
  } catch (error: any) {
    console.error("⚠️ ERROR EN HubMessageListener:", error.message || error);
  }
};

export default HubMessageListener;
