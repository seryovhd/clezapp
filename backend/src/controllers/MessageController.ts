import { Request, Response } from "express";
import AppError from "../errors/AppError";
import formatBody from "../helpers/Mustache";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import { getIO } from "../libs/socket";
import Ticket from "../models/Ticket";
import Message from "../models/Message";
import Queue from "../models/Queue";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import SendWhatsAppReaction from "../services/WbotServices/SendWhatsAppReaction";
import ListMessagesService from "../services/MessageServices/ListMessagesService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import CheckContactNumber from "../services/WbotServices/CheckNumber";
import DeleteWhatsAppMessage from "../services/WbotServices/DeleteWhatsAppMessage";
import GetProfilePicUrl from "../services/WbotServices/GetProfilePicUrl";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import EditWhatsAppMessage from "../services/WbotServices/EditWhatsAppMessage";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";
import { NotificationService } from "../services/NotificationService";
import crypto from "crypto";

type IndexQuery = {
  pageNumber?: string;
  beforeId?: string;
  beforeCreatedAt?: string;
};

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
  number?: string;
  closeTicket?: true;
  isPrivate?: boolean;
  mediaUrl?: string;
  mediaType?: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { pageNumber, beforeId, beforeCreatedAt } = req.query as IndexQuery;
  const { companyId, profile } = req.user;
  const queues: number[] = [];

  if (profile !== "admin") {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: Queue, as: "queues" }]
    });
    user.queues.forEach(queue => {
      queues.push(queue.id);
    });
  }

  const { count, messages, ticket, hasMore } = await ListMessagesService({
    pageNumber,
    beforeId,
    beforeCreatedAt,
    ticketId,
    companyId,
    queues
  });

  SetTicketMessagesAsRead(ticket);

  return res.json({ count, messages, ticket, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { body, quotedMsg, isPrivate, mediaUrl, mediaType }: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];
  const { companyId, id: userId } = req.user;

  try {
    const ticket = await ShowTicketService(ticketId, companyId);

    SetTicketMessagesAsRead(ticket);

    switch (ticket.whatsapp?.type) {
      case "facebook_messenger":
        throw new AppError("ERR_FACEBOOK_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición", 501);
        break;

      case "whatsapp_business":
        throw new AppError("ERR_BUSINESS_API_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición", 501);
        break;

      case "whatsapp":
      default:
        await handleWhatsAppMessage(
          ticket,
          body,
          quotedMsg,
          medias,
          isPrivate,
          companyId,
          parseInt(userId, 10)
        );
        break;
    }

    return res.send();

  } catch (err: any) {
    console.log("❌ ERROR EN CONTROLADOR:", err);

    if (err.message?.includes("BUSINESS_ACCOUNT_LOCKED") ||
      err.message?.includes("131031") ||
      err.message?.includes("ERR_BUSINESS_API")) {
      await NotificationService.sendBusinessAPIError(companyId, {
        code: err.message,
        message: err.message
      });
    }

    if (Object.keys(err).length === 0) {
      throw new AppError(
        "No fue posible enviar el mensaje, intenta nuevamente en unos instantes"
      );
    } else {
      throw new AppError(err.message);
    }
  }
};

/**
 * Maneja mensajes de Facebook Messenger
 */
const handleFacebookMessage = async (
  ticket: Ticket,
  body: string,
  quotedMsg: Message | undefined,
  medias: Express.Multer.File[],
  mediaUrl: string | undefined,
  mediaType: string | undefined,
  companyId: number,
  userId: number,
  isPrivate?: boolean
): Promise<void> => {
  if (isPrivate) {
    await sendPrivateMessage(ticket, body, quotedMsg, companyId);
    return;
  }

  if (medias && medias.length > 0) {
    await Promise.all(
      medias.map(async (media: Express.Multer.File) => {
        const fileMediaUrl = `${process.env.BACKEND_URL}/public/company${companyId}/${media.filename}`;
        const fileMediaType = getMediaTypeFromFile(media.mimetype);
        throw new AppError("ERR_FACEBOOK_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición", 501);
      })
    );
  } else if (mediaUrl && mediaType) {
    throw new AppError("ERR_FACEBOOK_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición", 501);
  } else {
    throw new AppError("ERR_FACEBOOK_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición", 501);
  }
};

/**
 * Maneja mensajes de WhatsApp Web (Baileys)
 */
const handleWhatsAppMessage = async (
  ticket: Ticket,
  body: string,
  quotedMsg: Message | undefined,
  medias: Express.Multer.File[],
  isPrivate?: boolean,
  companyId?: number,
  userId?: number
): Promise<void> => {
  if (isPrivate) {
    await sendPrivateMessage(ticket, body, quotedMsg, companyId);
    return;
  }

  if (medias) {
    await Promise.all(
      medias.map(async (media: Express.Multer.File, index) => {
        const messageBody = Array.isArray(body) ? body[index] : body;
        await SendWhatsAppMedia({ 
          media, 
          ticket, 
          body: messageBody,
          quotedMsg
        });
      })
    );
  } else {
    await SendWhatsAppMessage({ body, ticket, quotedMsg });
  }
};

/**
 * Envía mensaje privado (común para todos los tipos)
 */
const sendPrivateMessage = async (
  ticket: Ticket, 
  body: string, 
  quotedMsg?: Message, 
  companyId?: number
): Promise<void> => {
  const id = crypto.randomBytes(11).toString("hex").toUpperCase();
  
  await Message.create({
    id,
    body,
    fromMe: true,
    read: true,
    quotedMsgId: quotedMsg?.id,
    ticketId: ticket.id,
    isPrivate: true,
    companyId: ticket.companyId,
    queueId: ticket.queueId
  });

  const io = getIO();
  const msg = await Message.findByPk(id, {
    include: ["contact", "quotedMsg", "ticket"]
  });

  io.to(String(ticket.id)).emit(`company-${companyId}-appMessage`, {
    action: "create",
    message: msg,
    ticket: ticket
  });
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { messageId } = req.params;
  const { companyId } = req.user;

  const message = await DeleteWhatsAppMessage(messageId);

  const io = getIO();
  const fullTicket = await ShowTicketService(message.ticketId, companyId);

  io.to(String(message.ticketId)).emit(`company-${companyId}-appMessage`, {
    action: "update",
    message,
    ticket: fullTicket
  });

  return res.send();
};

export const send = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params as unknown as { whatsappId: number };
  const messageData: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];
  const { companyId, id: userId } = req.user;

  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);

    if (!whatsapp) {
      throw new Error("No fue posible realizar la operación");
    }

    if (messageData.number === undefined) {
      throw new Error("El número es obligatorio");
    }

    const numberToTest = messageData.number;
    const body = messageData.body;

    const companyIdNum = companyId;

    if (whatsapp.type === "facebook_messenger") {
      const contact = await CreateOrUpdateContactService({
        name: numberToTest,
        number: numberToTest,
        isGroup: false,
        companyId: companyIdNum
      });

      const ticket = await FindOrCreateTicketService(contact, whatsapp.id!, 0, companyIdNum);

      if (medias && medias.length > 0) {
        await Promise.all(
          medias.map(async (media: Express.Multer.File) => {
            const mediaUrl = `${process.env.BACKEND_URL}/public/company${companyIdNum}/${media.filename}`;
            const mediaType = getMediaTypeFromFile(media.mimetype);
            throw new AppError("ERR_FACEBOOK_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición", 501);
          })
        );
      } else {
        throw new AppError("ERR_FACEBOOK_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición", 501);
      }

      await ticket.update({
        lastMessage: body
      });

      SetTicketMessagesAsRead(ticket);

      return res.send({ mensagem: "Mensaje enviado" });
    } else {
      const CheckValidNumber = await CheckContactNumber(numberToTest, companyIdNum);
      const number = CheckValidNumber.jid.replace(/\D/g, "");
      const profilePicUrl = await GetProfilePicUrl(number, companyIdNum);

      const contactData = {
        name: `${number}`,
        number,
        profilePicUrl,
        isGroup: false,
        companyId: companyIdNum
      };

      const contact = await CreateOrUpdateContactService(contactData);

      const ticket = await FindOrCreateTicketService(contact, whatsapp.id!, 0, companyIdNum);

      if (medias) {
        await Promise.all(
          medias.map(async (media: Express.Multer.File) => {
            if (whatsapp.type === "whatsapp_business") {
              throw new AppError("ERR_BUSINESS_API_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición", 501);
            } else {
              await req.app.get("queues").messageQueue.add(
                "SendMessage",
                {
                  whatsappId,
                  data: {
                    number,
                    body: body ? formatBody(body, contact) : media.originalname,
                    mediaPath: media.path,
                    fileName: media.originalname
                  }
                },
                { removeOnComplete: true, attempts: 3 }
              );
            }
          })
        );
      } else {
        if (whatsapp.type === "whatsapp_business") {
          throw new AppError("ERR_BUSINESS_API_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición", 501);
        } else {
          await SendWhatsAppMessage({ body: formatBody(body, contact), ticket });
        }

        await ticket.update({
          lastMessage: body
        });
      }

      if (messageData.closeTicket) {
        setTimeout(async () => {
          await UpdateTicketService({
            ticketId: ticket.id,
            ticketData: { status: "closed" },
            companyId: companyIdNum
          });
        }, 1000);
      }

      SetTicketMessagesAsRead(ticket);

      return res.send({ mensagem: "Mensaje enviado" });
    }
  } catch (err: any) {
    if (Object.keys(err).length === 0) {
      throw new AppError(
        "No fue posible enviar el mensaje, intenta nuevamente en unos instantes"
      );
    } else {
      throw new AppError(err.message);
    }
  }
};

export const addReaction = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { messageId } = req.params;
    const { type } = req.body;
    const { companyId, id } = req.user;

    const message = await Message.findByPk(messageId);

    const ticket = await Ticket.findByPk(message.ticketId, {
      include: ["contact"]
    });

    if (!message) {
      return res.status(404).send({ message: "Mensagem não encontrada" });
    }

    const reactionResult = await SendWhatsAppReaction({
      messageId: messageId,
      ticket: ticket,
      reactionType: type
    });

    await message.update({
      reactions: [...message.reactions, { type: type, userId: parseInt(id, 10) }]
    });

    const updatedMessage = await Message.findByPk(message.id, {
      include: ["contact", "quotedMsg", "ticket"]
    });

    const io = getIO();
    io.to(message.ticketId.toString()).emit(`company-${companyId}-appMessage`, {
      action: "update",
      message: updatedMessage,
      ticket: updatedMessage.ticket
    });

    return res.status(200).send({
      message: 'Reação adicionada com suceso!',
      reactionResult,
      reactions: updatedMessage.reactions
    });
  } catch (error) {
    console.error('Erro ao adicionar reação:', error);
    if (error instanceof AppError) {
      return res.status(400).send({ message: error.message });
    }
    return res.status(500).send({ message: 'Erro ao adicionar reação', error: error.message });
  }
};

export const sendMessageFlow = async (
  whatsappId: number,
  body: any,
  req: Request,
  files?: Express.Multer.File[]
): Promise<String> => {
  const messageData = body;
  const medias = files;

  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);

    if (!whatsapp) {
      throw new Error("No fue posible realizar la operación");
    }

    if (messageData.number === undefined) {
      throw new Error("El número es obligatorio");
    }

    const numberToTest = messageData.number;
    const bodyText = messageData.body;

    const companyId = messageData.companyId;

    if (whatsapp.type === "facebook_messenger") {
      const contact = await CreateOrUpdateContactService({
        name: numberToTest,
        number: numberToTest,
        isGroup: false,
        companyId
      });

      const ticket = await FindOrCreateTicketService(contact, whatsapp.id!, 0, companyId);

      if (medias && medias.length > 0) {
        await Promise.all(
          medias.map(async (media: Express.Multer.File) => {
            const mediaUrl = `${process.env.BACKEND_URL}/public/company${companyId}/${media.filename}`;
            const mediaType = getMediaTypeFromFile(media.mimetype);
            throw new AppError("ERR_FACEBOOK_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición", 501);
          })
        );
      } else {
        throw new AppError("ERR_FACEBOOK_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición", 501);
      }

      return "Mensaje enviado";
    } else {
      const CheckValidNumber = await CheckContactNumber(numberToTest, companyId);
      const number = numberToTest.replace(/\D/g, "");

      if (medias) {
        await Promise.all(
          medias.map(async (media: Express.Multer.File) => {
            if (whatsapp.type === "whatsapp_business") {
              const contact = await CreateOrUpdateContactService({
                name: number,
                number,
                isGroup: false,
                companyId
              });

              const ticket = await FindOrCreateTicketService(contact, whatsapp.id!, 0, companyId);
              throw new AppError("ERR_BUSINESS_API_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición", 501);
            } else {
              await req.app.get("queues").messageQueue.add(
                "SendMessage",
                {
                  whatsappId,
                  data: {
                    number,
                    body: media.originalname,
                    mediaPath: media.path
                  }
                },
                { removeOnComplete: true, attempts: 3 }
              );
            }
          })
        );
      } else {
        if (whatsapp.type === "whatsapp_business") {
          const contact = await CreateOrUpdateContactService({
            name: number,
            number,
            isGroup: false,
            companyId
          });

          const ticket = await FindOrCreateTicketService(contact, whatsapp.id!, 0, companyId);
          throw new AppError("ERR_BUSINESS_API_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición", 501);
        } else {
          req.app.get("queues").messageQueue.add(
            "SendMessage",
            {
              whatsappId,
              data: {
                number,
                body: bodyText
              }
            },
            { removeOnComplete: false, attempts: 3 }
          );
        }
      }

      return "Mensaje enviado";
    }
  } catch (err: any) {
    if (Object.keys(err).length === 0) {
      throw new AppError(
        "No fue posible enviar el mensaje, intenta nuevamente en unos instantes"
      );
    } else {
      throw new AppError(err.message);
    }
  }
};

export const edit = async (req: Request, res: Response): Promise<Response> => {
  const { messageId } = req.params;
  const { companyId } = req.user;
  const { body }: MessageData = req.body;

  try {
    const { ticket, message } = await EditWhatsAppMessage({ messageId, body });

    const io = getIO();
    io.to(String(ticket.id))
      .to(`company-${companyId}-${ticket.status}`)
      .to(`company-${companyId}-notification`)
      .emit(`company-${companyId}-appMessage`, {
        action: "update",
        message,
        ticket: ticket,
        contact: ticket.contact,
      });

    return res.send();
  } catch (err: any) {
    console.error("❌ ERROR EDIT MESSAGE:", err);
    throw new AppError(err.message || "ERR_EDITING_WAPP_MSG", 400);
  }
};

function getMediaTypeFromFile(mimetype: string): string {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'file';
}