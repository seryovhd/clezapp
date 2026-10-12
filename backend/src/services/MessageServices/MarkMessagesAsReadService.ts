import Message from "../../models/Message";
import { getIO } from "../../libs/socket";

interface Request {
  ticketId: number;
  companyId: number;
  phoneNumberId: string;
  accessToken: string;
}

const MarkMessagesAsReadService = async ({
  ticketId,
  companyId,
  phoneNumberId,
  accessToken
}: Request): Promise<void> => {
  try {
    const unreadMessages = await Message.findAll({
      where: {
        ticketId,
        fromMe: false,
        read: false,
        companyId
      }
    });

    if (unreadMessages.length === 0) return;

    const messageIds = unreadMessages.map(msg => msg.id);
    await Message.update(
      { read: true },
      {
        where: {
          id: messageIds,
          companyId
        }
      }
    );

    const updatedMessages = await Message.findAll({
      where: { id: messageIds },
      include: ["contact", "ticket"]
    });

    const io = getIO();
    updatedMessages.forEach(message => {
      io.to(ticketId.toString()).emit(`company-${companyId}-appMessage`, {
        action: "update",
        message
      });
    });

    console.log(`✅ ${unreadMessages.length} mensajes marcados como leídos`);
  } catch (error) {
    console.log("❌ Error marcando mensajes como leídos:", error);
  }
};

export default MarkMessagesAsReadService;