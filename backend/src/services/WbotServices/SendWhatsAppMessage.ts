import * as Sentry from "@sentry/node";
import { WAMessage } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import { Op } from "sequelize";
import formatBody from "../../helpers/Mustache";
import EvolutionApiService from "../EvolutionApiServices/EvolutionApiService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { getDestinationJid } from "../../helpers/ResolveLidHelper";
import { buildCleanQuotedMessage } from "../../helpers/BuildQuotedMessage";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
  isForwarded?: boolean;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg,
  isForwarded = false
}: Request): Promise<WAMessage> => {
  try {
    if (!ticket.whatsappId) {
      throw new AppError("ERR_TICKET_NO_WHATSAPP_ID");
    }

    if (!ticket.whatsapp) {
      const w = await Whatsapp.findByPk(ticket.whatsappId);
      if (!w) {
        throw new AppError("ERR_WHATSAPP_NOT_FOUND");
      }
      ticket.whatsapp = w;
    }

    if (ticket.whatsapp.type === "whatsapp_business") {
      await Whatsapp.update(
        {
          status: "DISCONNECTED"
        },
        { where: { id: ticket.whatsapp.id } }
      );
      throw new AppError("ERR_BUSINESS_API_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición");
    }

    const evolutionConfig = await EvolutionApiService.getConfig(ticket.companyId);
    const isEvolution = ticket.whatsapp.type === "evolution" ||
      ticket.whatsapp.connectionType === "evolution" ||
      (evolutionConfig.enabled && ticket.whatsapp.connectionType !== "baileys" && ticket.whatsapp.type !== "baileys");

    if (isEvolution) {
      const destination = await getDestinationJid(ticket);

      console.log("🚀 [Evolution API] Enviando mensaje de texto al destino:", destination);
      const formattedText = formatBody(body, ticket.contact);

      let quotedPayload: any = undefined;
      const quotedMsgIdToSave = quotedMsg?.id;

      if (quotedMsg) {
        try {
          const quotedChatMsg = await Message.findOne({ where: { id: quotedMsg.id } });
          if (quotedChatMsg) {
            let msgFound: any = null;
            if (quotedChatMsg.dataJson) {
              try {
                msgFound = JSON.parse(quotedChatMsg.dataJson);
              } catch (e) {}
            }

            const quotedContent = buildCleanQuotedMessage(quotedChatMsg, msgFound, { isForHttp: true });

            quotedPayload = {
              key: {
                id: quotedChatMsg.id,
                fromMe: quotedChatMsg.fromMe,
                remoteJid: quotedChatMsg.remoteJid || destination
              },
              message: quotedContent
            };
            if (quotedChatMsg.participant) {
              quotedPayload.key.participant = quotedChatMsg.participant;
            }
          }
        } catch (eQuoted) {
          logger.warn("[Evolution] Error construyendo payload de cita:", eQuoted);
        }
      }

      let sentRes: any;
      try {
        sentRes = await EvolutionApiService.sendTextMessage(
          ticket.whatsapp,
          destination,
          formattedText,
          {
            quoted: quotedPayload,
            quotedMessageId: quotedMsgIdToSave
          }
        );
      } catch (evoSendErr: any) {
        if (quotedPayload || quotedMsgIdToSave) {
          logger.warn(`[Evolution] Falló envío con cita (${evoSendErr?.message}), reintentando sin cita para asegurar entrega...`);
          sentRes = await EvolutionApiService.sendTextMessage(
            ticket.whatsapp,
            destination,
            formattedText
          );
        } else {
          throw evoSendErr;
        }
      }

      const messageId = sentRes?.key?.id || sentRes?.id || `evo_${Date.now()}`;
      try {
        await CreateMessageService({
          messageData: {
            id: messageId,
            ticketId: ticket.id,
            body: formattedText,
            fromMe: true,
            read: true,
            mediaType: "chat",
            ack: 1,
            queueId: ticket.queueId,
            remoteJid: destination.includes("@") ? destination : `${destination}@s.whatsapp.net`,
            quotedMsgId: quotedMsgIdToSave
          },
          companyId: ticket.companyId
        });
      } catch (err) {
        logger.warn("[Evolution] Error guardando mensaje saliente en BD:", err);
      }

      await ticket.update({ lastMessage: formattedText });
      logger.info(`[Evolution] Mensaje enviado al ticket ${ticket.id} - ${ticket.contact.number}`);
      return sentRes as any;
    }

    let options: any = undefined;
    let quotedMsgIdToSave: string | undefined = undefined;
    const wbot = await GetTicketWbot(ticket);
    const number = await getDestinationJid(ticket, wbot);

    console.log("🔢 BOT PARA NÚMERO", number);

    if (quotedMsg) {
      quotedMsgIdToSave = quotedMsg.id;
      try {
        const chatMessages = await Message.findOne({
          where: {
            id: quotedMsg.id
          }
        });

        if (chatMessages) {
          let msgFound: any = null;
          if (chatMessages.dataJson) {
            try {
              msgFound = JSON.parse(chatMessages.dataJson);
            } catch (e) {
              msgFound = null;
            }
          }

          // Si es chat 1 a 1 (no grupo), normalizamos el remoteJid del quoted al número de destino
          // para que Baileys no interprete la cita como proveniente de otro chat diferente
          // (especialmente cuando uno tiene @lid y el otro @s.whatsapp.net).
          const isGroup = ticket.isGroup || (chatMessages.remoteJid && chatMessages.remoteJid.includes("@g.us"));
          const quotedRemoteJid = isGroup
            ? (chatMessages.remoteJid || number)
            : number;

          const quotedKey = {
            remoteJid: quotedRemoteJid,
            fromMe: msgFound?.key?.fromMe ?? chatMessages.fromMe,
            id: chatMessages.id,
            participant: isGroup ? (msgFound?.key?.participant || chatMessages.participant) : undefined
          };

          // Extraer o generar el content del mensaje citado sanitizado (respetando stickers, fotos, videos, audios y textos)
          // asegurando que jpegThumbnail sea un Buffer binario real para que WhatsApp Web no descarte el mensaje
          const quotedContent = buildCleanQuotedMessage(chatMessages, msgFound);

          // Si el mensaje citado o el chat tienen expiración de mensajes temporales, propagarla
          const ephemeralExpiration = msgFound?.message?.imageMessage?.contextInfo?.expiration ||
            msgFound?.message?.extendedTextMessage?.contextInfo?.expiration ||
            msgFound?.message?.videoMessage?.contextInfo?.expiration ||
            msgFound?.message?.conversation?.contextInfo?.expiration;

          options = {
            quoted: {
              key: quotedKey,
              message: quotedContent
            },
            ...(ephemeralExpiration ? { ephemeralExpiration } : {})
          };
        }
      } catch (errQuote) {
        logger.warn("[Baileys] Error procesando mensaje a citar:", errQuote);
      }
    }

    const formattedText = formatBody(body, ticket.contact);

    let sentMessage: WAMessage;
    try {
      sentMessage = await wbot.sendMessage(
        number,
        {
          text: formattedText,
          contextInfo: {
            forwardingScore: isForwarded ? 2 : 0,
            isForwarded: isForwarded ? true : false
          }
        },
        options
      );
    } catch (sendErr: any) {
      if (options) {
        logger.warn(`[Baileys] Error enviando mensaje con cita al ticket ${ticket.id} (${sendErr?.message}), reintentando sin cita para asegurar entrega...`);
        sentMessage = await wbot.sendMessage(
          number,
          {
            text: formattedText,
            contextInfo: {
              forwardingScore: isForwarded ? 2 : 0,
              isForwarded: isForwarded ? true : false
            }
          }
        );
      } else {
        throw sendErr;
      }
    }

    const messageId = sentMessage?.key?.id || `wbot_${Date.now()}`;

    try {
      await CreateMessageService({
        messageData: {
          id: messageId,
          ticketId: ticket.id,
          body: formattedText,
          fromMe: true,
          read: true,
          mediaType: "chat",
          ack: 1,
          queueId: ticket.queueId,
          dataJson: JSON.stringify(sentMessage),
          remoteJid: number,
          quotedMsgId: quotedMsgIdToSave
        },
        companyId: ticket.companyId
      });
    } catch (saveErr) {
      logger.warn("[Baileys] Error guardando mensaje saliente en BD:", saveErr);
    }

    await ticket.update({ lastMessage: formattedText });

    const botResponse = sentMessage.message?.conversation ||
      sentMessage.message?.extendedTextMessage?.text ||
      formattedText;

    logger.info(`BOT RESPONDIO AL TICKET ${ticket.id} - NUMERO: ${ticket.contact.number}`);

    return sentMessage;

  } catch (err: any) {
    Sentry.captureException(err);
    console.log("❌ ERROR (SendWhatsAppMessage): ", err);

    if (err.message?.includes("ERR_BUSINESS_API_TOKEN_EXPIRED")) {
      throw new AppError("ERR_BUSINESS_API_TOKEN_EXPIRED", 400);
    }

    if (err.message?.includes("ERR_BUSINESS_API_NO_WBOT")) {
      throw new AppError("ERR_BUSINESS_API_NO_WBOT", 400);
    }

    if (err.message?.includes("ERR_BUSINESS_API_NOT_CONFIGURED")) {
      throw new AppError("ERR_BUSINESS_API_NOT_CONFIGURED", 400);
    }

    if (err.response?.data?.error?.code === 131031) {
      throw new AppError("BUSINESS_ACCOUNT_LOCKED", 400);
    }

    if (err.response?.data?.error) {
      const whatsappError = err.response.data.error;
      throw new AppError(
        `WHATSAPP_API_${whatsappError.code}_${whatsappError.type}`,
        400,
        {
          code: whatsappError.code,
          message: whatsappError.message,
          details: whatsappError.error_data?.details
        }
      );
    }

    throw new AppError("ERR_SENDING_WAPP_MSG", 400);
  }
};

export default SendWhatsAppMessage;