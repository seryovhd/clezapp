import { proto, WASocket } from "@whiskeysockets/baileys";
import WALegacySocket from "@whiskeysockets/baileys"
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import GetWbotMessage from "../../helpers/GetWbotMessage";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

const DeleteWhatsAppMessage = async (messageId: string): Promise<Message> => {
  /* console.log("🚨 Entró a DeleteWhatsAppMessage:", messageId); */
  const message = await Message.findByPk(messageId, {
    include: [
      {
        model: Ticket,
        as: "ticket",
        include: ["contact"]
      }
    ]
  });

  if (!message) {
    throw new AppError("No message found with this ID.");
  }
/* console.log("✅ Mensaje encontrado:", {
  id: message.id,
  body: message.body,
  fromMe: message.fromMe,
  isDeleted: message.isDeleted
}); */

  if (message.isPrivate) {
    console.log("📌 Mensaje privado: se marcará como eliminado en BD.");
    await message.update({ isDeleted: true });
    return message;
  }
  
  const { ticket } = message;

  const messageToDelete = await GetWbotMessage(ticket, messageId);

  try {
    const wbot = await GetTicketWbot(ticket);
    const messageDelete = messageToDelete as proto.WebMessageInfo;

    const menssageDelete = messageToDelete as Message;
/* console.log("✉️ Enviando delete a WhatsApp con:", {
  remoteJid: menssageDelete.remoteJid,
  id: menssageDelete.id,
  participant: menssageDelete.participant,
  fromMe: menssageDelete.fromMe
}); */
    await (wbot as WASocket).sendMessage(menssageDelete.remoteJid, {
      delete: {
        id: menssageDelete.id,
        remoteJid: menssageDelete.remoteJid,
        participant: menssageDelete.participant,
        fromMe: menssageDelete.fromMe
      }
    });

  } catch (err) {
    throw new AppError("ERR_DELETE_WAPP_MSG");
  }
  await message.update({ isDeleted: true, body: null });
  /* console.log("🗑️ Mensaje marcado como eliminado en BD:", message.id); */
  return message;
};

export default DeleteWhatsAppMessage;
