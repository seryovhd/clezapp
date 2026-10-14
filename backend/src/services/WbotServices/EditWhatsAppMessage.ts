import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import EvolutionApiService from "../EvolutionApiServices/EvolutionApiService";
import { logger } from "../../utils/logger";

interface Request {
  messageId: string;
  body: string;
}

const EditWhatsAppMessage = async ({
  messageId,
  body,
}: Request): Promise<{ ticket: Ticket; message: Message }> => {
  const message = await Message.findByPk(messageId, {
    include: [
      {
        model: Ticket,
        as: "ticket",
        include: ["contact", "whatsapp"]
      }
    ]
  });

  if (!message) {
    throw new AppError("No message found with this ID.");
  }

  // Si es privado, solo editar en base de datos y salir
  if (message.isPrivate) {
    await message.update({ body, isEdited: true });
    return { ticket: message.ticket, message };
  }

  const { ticket } = message;

  if (!ticket.whatsapp && ticket.whatsappId) {
    ticket.whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
  }

  const targetJid = message.remoteJid ||
    (ticket.isGroup ? `${ticket.contact.number}@g.us` : `${ticket.contact.number}@s.whatsapp.net`);

  // 1. VERIFICAR SI LA CONEXIÓN ES EVOLUTION API
  const evolutionConfig = await EvolutionApiService.getConfig(ticket.companyId);
  const isEvolution = ticket.whatsapp?.type === "evolution" ||
    ticket.whatsapp?.connectionType === "evolution" ||
    (evolutionConfig.enabled && ticket.whatsapp?.connectionType !== "baileys" && ticket.whatsapp?.type !== "baileys");

  if (isEvolution && ticket.whatsapp) {
    try {
      logger.info(`[Evolution] Editando mensaje ${message.id} para ${ticket.contact.number}`);
      await EvolutionApiService.updateMessage(
        ticket.whatsapp,
        ticket.contact.number,
        message.id,
        body,
        targetJid
      );
    } catch (evoErr: any) {
      logger.warn(`[Evolution] Advertencia al editar en Evolution API: ${evoErr.message}`);
    }

    await message.update({ body, isEdited: true });
    await ticket.update({ lastMessage: body });
    return { ticket: message.ticket, message };
  }

  // 2. CONEXIÓN BAILEYS
  try {
    const wbot = await GetTicketWbot(ticket);

    let msgKey: any = null;
    if (message.dataJson) {
      try {
        const parsed = JSON.parse(message.dataJson);
        msgKey = parsed?.key;
      } catch (e) {
        logger.warn("[Baileys Edit] No se pudo parsear dataJson del mensaje");
      }
    }

    if (!msgKey) {
      msgKey = {
        remoteJid: targetJid,
        fromMe: message.fromMe !== false,
        id: message.id
      };
    }

    logger.info(`[Baileys] Editando mensaje ${message.id} para ${targetJid}`);
    await wbot.sendMessage(targetJid, {
      text: body,
      edit: msgKey,
    });

  } catch (err: any) {
    logger.warn(`[Baileys] Advertencia al despachar edición a WhatsApp: ${err.message}`);
  }

  await message.update({ body, isEdited: true });
  await ticket.update({ lastMessage: body });

  return { ticket: message.ticket, message };
};

export default EditWhatsAppMessage;