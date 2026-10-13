import { WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import EvolutionApiService from "../EvolutionApiServices/EvolutionApiService";

const DeleteWhatsAppMessage = async (messageId: string): Promise<Message> => {
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
    throw new AppError("No message found with this ID.", 404);
  }

  // Si es un mensaje interno/privado, solo se marca como eliminado en BD
  if (message.isPrivate) {
    await message.update({ isDeleted: true });
    return message;
  }

  const { ticket } = message;

  // Intentar eliminar el mensaje en WhatsApp (vía Evolution API o Baileys)
  try {
    let whatsapp = ticket?.whatsapp;
    if (!whatsapp && ticket?.whatsappId) {
      whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
    }

    const isEvolution =
      whatsapp &&
      (whatsapp.type === "evolution" ||
        whatsapp.connectionType === "evolution" ||
        (process.env.EVOLUTION_API_ENABLED === "true" && whatsapp.instanceName));

    if (isEvolution && whatsapp) {
      // 1. Eliminar vía Evolution API v2
      await EvolutionApiService.deleteMessage(whatsapp, message);
    } else if (ticket) {
      // 2. Eliminar vía Baileys si la sesión está disponible
      try {
        const wbot = await GetTicketWbot(ticket);
        const remoteJid =
          message.remoteJid ||
          (ticket.isGroup
            ? `${ticket.contact?.number}@g.us`
            : `${ticket.contact?.number}@s.whatsapp.net`);

        if (wbot && remoteJid) {
          await (wbot as WASocket).sendMessage(remoteJid, {
            delete: {
              id: message.id,
              remoteJid,
              participant: message.participant,
              fromMe: message.fromMe
            }
          });
        }
      } catch (baileysErr: any) {
        console.warn(
          `[DeleteWhatsAppMessage] No se pudo revocar en Baileys (${baileysErr?.message || "Sesión no disponible"}), pero se marcará como eliminado en Chasap.`
        );
      }
    }
  } catch (err: any) {
    console.warn(
      `[DeleteWhatsAppMessage] Error al intentar revocar mensaje en WhatsApp: ${err?.message || err}. Se procederá a marcar como eliminado en Chasap.`
    );
  }

  // Preservar el contenido original del mensaje (NO poner body: null) y marcar como eliminado
  await message.update({ isDeleted: true });

  await message.reload({
    include: [
      "contact",
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      },
      {
        model: Ticket,
        as: "ticket",
        include: ["contact", "whatsapp"]
      }
    ]
  });

  return message;
};

export default DeleteWhatsAppMessage;
