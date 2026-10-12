require("dotenv").config();
const { Client, TextContent, FileContent } = require("notificamehubsdk");
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import CreateMessageService from "./CreateHubMessageService";
import { showHubToken } from "../../helpers/showHubToken";
import { getIO } from "../../libs/socket";
import { NotificationService } from "../../services/NotificationService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";

// Conexiones que usan el Hub externo
const HUB_CHANNELS = ['webchat', 'facebook', 'instagram', 'whatsapp'];
// Conexiones propias (no usan Hub)
const OWN_CHANNELS = ['whatsapp_business', 'facebook_messenger', 'baileys', 'evolution'];

const selectChannelAndContactNumber = (contact: Contact, client: typeof Client, channelType: string) => {
  let channelClient;
  let contactNumber;

  console.log("🔍 DEBUG - Seleccionando canal:", {
    channelType,
    isHubChannel: HUB_CHANNELS.includes(channelType),
    isOwnChannel: OWN_CHANNELS.includes(channelType)
  });

  // Si es conexión propia, no usar el Hub
  if (OWN_CHANNELS.includes(channelType)) {
    console.log("✅ CONEXIÓN PROPIA - No requiere Hub");
    return { channelClient: null, contactNumber: contact.number };
  }

  // Mapear tipos para el Hub
  let sdkChannelType = channelType;
  if (channelType === "baileys") {
    sdkChannelType = "whatsapp";
  }

  if (sdkChannelType && HUB_CHANNELS.includes(sdkChannelType)) {
    switch (sdkChannelType) {
      case "facebook":
        contactNumber = contact.messengerId;
        break;
      case "instagram":
        contactNumber = contact.instagramId;
        break;
      case "webchat":
        contactNumber = contact.number;
        break;
      case "whatsapp":
        contactNumber = contact.number;
        break;
    }
  }

  // Fallback para Hub
  if (!contactNumber) {
    if (contact.messengerId && (!contact.instagramId || contact.canal === "Facebook")) {
      contactNumber = contact.messengerId;
      sdkChannelType = "facebook";
    } else if (contact.instagramId || contact.canal === "Instagram") {
      contactNumber = contact.instagramId;
      sdkChannelType = "instagram";
    } else if (contact.canal === "webchat") {
      contactNumber = contact.number;
      sdkChannelType = "webchat";
    } else if (contact.number) {
      contactNumber = contact.number;
      sdkChannelType = "whatsapp";
    }
  }

  if (sdkChannelType && contactNumber) {
    try {
      channelClient = client.setChannel(sdkChannelType);
      console.log("✅ CANAL HUB CONFIGURADO:", sdkChannelType, "CONTACTO:", contactNumber);
    } catch (error) {
      console.log("❌ ERROR AL CONFIGURAR CANAL HUB:", error.message);
    }
  }

  return { channelClient, contactNumber };
};

export const SendTextMessageService = async (
  message: string,
  ticketId: number,
  contact: Contact,
  connection: any,
  companyIdOld: number,
  channelType: string
) => {
  try {
    console.log("🔍 DEBUG - Tipo de conexión:", {
      channelType,
      isHubChannel: HUB_CHANNELS.includes(channelType),
      isOwnChannel: OWN_CHANNELS.includes(channelType),
      connectionExists: !!connection,
      hasQrcode: !!connection?.qrcode
    });

    const ticket = await Ticket.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new Error(`Ticket con ID ${ticketId} no encontrado`);
    }

    const { companyId } = ticket;

    if (!connection) {
      const errorMessage = `No se puede enviar el mensaje. La conexión de ${channelType} no existe.`;
      await NotificationService.sendBusinessAPIError(companyId, {
        code: `ERR_CONNECTION_MISSING`,
        message: errorMessage
      });
      throw new Error(errorMessage);
    }

    // CONEXIONES PROPIAS - No usan Hub
    if (OWN_CHANNELS.includes(channelType)) {
      console.log("🚀 ENVIANDO POR CONEXIÓN PROPIA:", channelType);

      if (channelType === "evolution" || channelType === "baileys" || channelType === "whatsapp") {
        return await SendWhatsAppMessage({ body: message, ticket });
      }

      // Para conexiones propias, generar un ID único de tipo string
      const tempMessageId = `own_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log("✅ MENSAJE ENVIADO POR CONEXIÓN PROPIA");
      
      const newMessage = await CreateMessageService({
        id: tempMessageId, // ID temporal como string
        contactId: contact.id,
        companyId,
        body: message,
        ticketId,
        fromMe: true
      });

      await Ticket.update({ lastMessage: message }, { where: { id: ticketId } });

      const io = getIO();
      const updatedTicket = await Ticket.findByPk(ticketId, { include: ["contact"] });

      if (updatedTicket) {
        io.to(updatedTicket.status)
          .to(ticketId.toString())
          .emit("message", {
            action: "create",
            message: newMessage,
            ticket: updatedTicket
          });

        io.to(updatedTicket.status)
          .to(ticketId.toString())
          .emit(`company-${companyId}-ticket`, {
            action: "update",
            ticket: updatedTicket
          });
      }

      return newMessage;
    }

    // CONEXIONES DEL HUB - Usan el Hub externo
    if (HUB_CHANNELS.includes(channelType)) {
      console.log("🚀 ENVIANDO POR HUB EXTERNO:", channelType);

      if (!connection.qrcode) {
        throw new Error(`La conexión del Hub no tiene token configurado.`);
      }

      let notificameHubToken;
      try {
        notificameHubToken = await showHubToken(companyId);
        console.log("✅ TOKEN HUB OBTENIDO");
      } catch (err) {
        throw new Error("Error al obtener el token de NotificameHub: " + err.message);
      }

      const client = new Client(notificameHubToken);
      const { channelClient, contactNumber } = selectChannelAndContactNumber(contact, client, channelType);

      if (!channelClient || !contactNumber) {
        throw new Error(`No se pudo configurar el canal del Hub.`);
      }

      message = message.replace(/\n/g, " ");
      const content = new TextContent(message);

      console.log("📤 ENVIANDO MENSAJE POR HUB:", {
        channelType,
        contactNumber,
        messageLength: message.length
      });

      const response = await channelClient.sendMessage(connection.qrcode, contactNumber, content);

      let data: any;
      try {
        if (typeof response === "string") {
          const jsonStart = response.indexOf("{");
          const jsonResponse = response.substring(jsonStart);
          data = JSON.parse(jsonResponse);
        } else if (typeof response === "object") {
          data = response;
        } else {
          throw new Error("La respuesta no es ni un objeto ni una cadena válida.");
        }
      } catch (error) {
        console.error("Error al parsear la respuesta:", error);
        throw new Error("La respuesta del servidor no es válida.");
      }

      const newMessage = await CreateMessageService({
        id: data.id ? data.id.toString() : `hub_${Date.now()}`,
        contactId: contact.id,
        companyId,
        body: message,
        ticketId,
        fromMe: true
      });

      await Ticket.update({ lastMessage: message }, { where: { id: ticketId } });

      const io = getIO();
      const updatedTicket = await Ticket.findByPk(ticketId, { include: ["contact"] });

      if (updatedTicket) {
        io.to(updatedTicket.status)
          .to(ticketId.toString())
          .emit("message", {
            action: "create",
            message: newMessage,
            ticket: updatedTicket
          });

        io.to(updatedTicket.status)
          .to(ticketId.toString())
          .emit(`company-${companyId}-ticket`, {
            action: "update",
            ticket: updatedTicket
          });
      }

      return newMessage;
    }

    throw new Error(`Tipo de canal no soportado: ${channelType}`);

  } catch (error) {
    const errorMessage = error.message || "Error al enviar mensaje";
    console.error("ERROR ENVÍO MENSAJE:", errorMessage);
    
    try {
      await NotificationService.sendBusinessAPIError(companyIdOld, {
        code: "ERR_MESSAGE_SEND_FAILED",
        message: errorMessage
      });
    } catch (notificationError) {
      console.error("⚠️ Error al enviar notificación:", notificationError);
    }
    throw error;
  }
};