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
    console.log("🔍 DIAGNÓSTICO COMPLETO DEL TICKET:");
    console.log("Ticket ID:", ticket.id);
    console.log("WhatsApp ID:", ticket.whatsappId);
    console.log("message body:", body);
    console.log("WhatsApp encontrado:", !!ticket.whatsapp);

    if (!ticket.whatsappId) {
      throw new AppError("ERR_TICKET_NO_WHATSAPP_ID");
    }

    if (!ticket.whatsapp) {
      await ticket.$get("whatsapp");
    }

    if (!ticket.whatsapp) {
      throw new AppError("ERR_WHATSAPP_NOT_FOUND");
    }

    console.log("Connection Type:", ticket.whatsapp.type);
    console.log("WhatsApp Status:", ticket.whatsapp.status);
    console.log("WhatsApp Name:", ticket.whatsapp.name);

    const freshWhatsapp = await Whatsapp.findByPk(ticket.whatsappId);

    if (freshWhatsapp) {
      ticket.whatsapp = freshWhatsapp;
      console.log("🔍 WHATSAPP ACTUALIZADO:");
      console.log("PhoneNumberId:", freshWhatsapp.phoneNumberId);
      console.log("BusinessAccountId:", freshWhatsapp.businessAccountId);
      console.log("Token exists:", !!freshWhatsapp.businessAccessToken);
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
      const sentRes = await EvolutionApiService.sendTextMessage(
        ticket.whatsapp,
        destination,
        formattedText,
        { quotedMessageId: quotedMsg?.id }
      );

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
            remoteJid: destination.includes("@") ? destination : `${destination}@s.whatsapp.net`
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

    let options = {};
    const wbot = await GetTicketWbot(ticket);
    const number = await getDestinationJid(ticket, wbot);

    console.log("🔢 BOT PARA NÚMERO", number);

    if (quotedMsg) {
      const chatMessages = await Message.findOne({
        where: {
          id: quotedMsg.id
        }
      });

      if (chatMessages) {
        const msgFound = JSON.parse(chatMessages.dataJson);
        options = {
          quoted: {
            key: msgFound.key,
            message: {
              extendedTextMessage: msgFound.message.extendedTextMessage
            }
          }
        };
      }
    }

    const formattedText = formatBody(body, ticket.contact);

    const sentMessage = await wbot.sendMessage(number, {
      text: formattedText,
      contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded ? true : false }
    }, options);

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
          remoteJid: number
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