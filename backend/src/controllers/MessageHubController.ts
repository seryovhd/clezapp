import { Request, Response } from "express";
import User from "../models/User";
import { getIO } from "../libs/socket";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import { SendMediaMessageService } from "../services/HubServices/SendMediaMessageHubService";
import { SendTextMessageService } from "../services/HubServices/SendTextMessageHubService";
import CreateHubTicketService from "../services/HubServices/CreateHubTicketService";
import { NotificationService } from "../services/NotificationService";

interface TicketData {
  contactId: number;
  status: string;
  queueId: number;
  userId: number;
  channel: string;
  companyId: number;
}

export const send = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  console.log("🏢 COMPANY ID DEL USUARIO AUTENTICADO:", companyId);

  const { body: message } = req.body;
  const { ticketId } = req.params;
  const medias = req.files as Express.Multer.File[];

  if (!ticketId || ticketId === "undefined" || ticketId === "null" || isNaN(Number(ticketId))) {
    return res.status(400).json({ error: "Ticket no válido o aún no cargado" });
  }

  console.log("🖼️ ARCHIVOS RECIBIDOS:", medias);
  console.log("🌀 ENVIANDO MENSAJE AL HUB EN EL CONTROLADOR");

  const ticket = await Ticket.findOne({
    where: { id: Number(ticketId), companyId },
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "number", "messengerId", "instagramId", "canal"]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "qrcode", "type", "companyId"]
      }
    ]
  });

  if (!ticket) {
    return res.status(404).json({ message: "Ticket no encontrado" });
  }

  console.log("🔍 DATOS DEL TICKET:", {
    ticketId: ticket.id,
    hasWhatsapp: !!ticket.whatsapp,
    whatsappId: ticket.whatsapp?.id,
    whatsappType: ticket.whatsapp?.type,
    contactData: ticket.contact
  });

  if (!ticket.whatsapp) {
    console.log("❌ EL TICKET NO TIENE CONEXIÓN ASIGNADA");

    let channelType = "unknown";
    if (ticket.contact?.canal) {
      channelType = ticket.contact.canal;
    }

    await NotificationService.sendBusinessAPIError(companyId, {
      code: "CONNECTION_DELETED",
      message: "No se puede enviar el mensaje. La conexión asociada a este ticket fue eliminada. Por favor, vincule una nueva conexión al ticket."
    }, channelType);

    // Retornar éxito para evitar el "An error occurred" del frontend
    return res.status(200).json({
      success: false,
      message: "Notificación de error enviada",
      code: "CONNECTION_DELETED"
    });
  }

  const connection = ticket.whatsapp;
  const channelType = connection.type;

  console.log("✅ CONEXIÓN DEL TICKET:", {
    connectionId: connection.id,
    channelType: channelType,
    hasQrcode: !!connection.qrcode
  });

  try {
    if (medias && medias.length > 0) {
      console.log("ENVIAMOS ARCHIVOS RECIBIDOS:: ", medias);
      await Promise.all(
        medias.map(async (media: Express.Multer.File) => {
          await SendMediaMessageService(
            media,
            message,
            ticket.id,
            ticket.contact,
            connection,
            companyId,
            channelType
          );
        })
      );
    } else {
      await SendTextMessageService(
        message,
        ticket.id,
        ticket.contact,
        connection,
        companyId,
        channelType
      );
    }

    return res.status(200).json({ 
      message: "Mensaje enviado correctamente",
      connectionType: channelType
    });
  } catch (error) {
    console.error("⚠️ ERROR AL ENVIAR MENSAJE:", error);
    await NotificationService.sendBusinessAPIError(companyId, {
      code: "WEBHOOK_ERROR",
      message: error.message
    });
    return res.status(400).json({ 
      message: error.body?.message || error.message || error
    });
  }
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { contactId, status, userId, channel }: TicketData = req.body;

  const { companyId } = req.user;

  const ticket = await CreateHubTicketService({
    contactId,
    status,
    userId,
    channel,
    companyId
  });

  const io = getIO();
  io.to(ticket.status).emit("ticket", {
    action: "update",
    ticket
  });

  return res.status(200).json(ticket);
};
