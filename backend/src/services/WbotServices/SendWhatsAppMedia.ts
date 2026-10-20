import { WAMessage, AnyMessageContent } from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import fs from "fs";
import { exec } from "child_process";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import { Op } from "sequelize";
import mime from "mime-types";

import ffmpegPath from "ffmpeg-static";
import formatBody from "../../helpers/Mustache";
import EvolutionApiService from "../EvolutionApiServices/EvolutionApiService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { getDestinationJid } from "../../helpers/ResolveLidHelper";
import { buildCleanQuotedMessage } from "../../helpers/BuildQuotedMessage";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  companyId?: number;
  body?: string;
  isForwarded?: boolean;
  quotedMsg?: Message;
}

ffmpeg.setFfmpegPath(ffmpegPath);

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

const processAudio = async (audio: string, companyId: string): Promise<string> => {
  const outputAudio = `${publicFolder}/company${companyId}/${new Date().getTime()}.ogg`;
  return new Promise((resolve, reject) => {
    exec(
      `${ffmpegPath} -i ${audio} -vn -c:a libopus -b:a 128k ${outputAudio} -y`,
      (error, _stdout, _stderr) => {
        if (error) reject(error);
        fs.unlinkSync(audio);
        resolve(outputAudio);
      }
    );
  });
};

const processAudioFile = async (audio: string, companyId: string): Promise<string> => {
  const outputAudio = `${publicFolder}/company${companyId}/${new Date().getTime()}.mp3`;
  return new Promise((resolve, reject) => {
    exec(
      `${ffmpegPath} -i ${audio} -vn -ar 44100 -ac 2 -b:a 192k ${outputAudio}`,
      (error, _stdout, _stderr) => {
        if (error) reject(error);
        fs.unlinkSync(audio);
        resolve(outputAudio);
      }
    );
  });
};

export const isFileNameOnly = (text?: string, refName?: string): boolean => {
  if (!text || typeof text !== "string") return true;
  const trimmed = text.trim();
  if (!trimmed || trimmed === "-") return true;
  if (refName) {
    const cleanRef = refName.trim().toLowerCase();
    const cleanText = trimmed.toLowerCase();
    if (cleanText === cleanRef || cleanText === decodeURIComponent(cleanRef)) {
      return true;
    }
    const refWithoutExt = cleanRef.substring(0, cleanRef.lastIndexOf('.'));
    if (refWithoutExt && cleanText === refWithoutExt) {
      return true;
    }
  }
  return /^[^\n\r]+\.(png|jpe?g|webp|gif|bmp|svg|mp4|mov|avi|mkv|ogg|mp3|wav|m4a|opus|bin|pdf|docx?|xlsx?|pptx?|txt|zip|rar)$/i.test(trimmed);
};

export const getMessageOptions = async (
  fileName: string,
  pathMedia: string,
  companyId?: string,
  body: string = ""
): Promise<any> => {
  const mimeType = mime.lookup(pathMedia);
  const typeMessage = mimeType.split("/")[0];

  try {
    if (!mimeType) {
      throw new Error("Invalid mimetype");
    }
    let options: AnyMessageContent;
    const hasValidCaption = !isFileNameOnly(body, fileName);
    const captionToSend = hasValidCaption ? body.trim() : null;

    if (typeMessage === "video") {
      options = {
        video: fs.readFileSync(pathMedia),
        caption: captionToSend,
        fileName: fileName
      };
    } else if (typeMessage === "audio") {
      const typeAudio = true;
      const convert = await processAudio(pathMedia, companyId);
      if (typeAudio) {
        options = {
          audio: fs.readFileSync(convert),
          mimetype: "audio/ogg; codecs=opus",
          ptt: true,
        };
      } else {
        options = {
          audio: fs.readFileSync(convert),
          mimetype: typeAudio ? "audio/mp4" : mimeType,
          ptt: true
        };
      }
    } else if (typeMessage === "document" || fileName.endsWith('.psd')) {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: captionToSend,
        fileName: fileName,
        mimetype: mimeType
      };
    } else if (typeMessage === "application") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: captionToSend,
        fileName: fileName,
        mimetype: mimeType
      };
    } else {
      options = {
        image: fs.readFileSync(pathMedia),
        caption: captionToSend,
      };
    }

    return options;
  } catch (e) {
    Sentry.captureException(e);
    console.log("❌ ERROR (SWAM): ", e);
    return null;
  }
};

const SendWhatsAppMedia = async ({
  media,
  ticket,
  body,
  isForwarded = false,
  quotedMsg
}: Request): Promise<WAMessage> => {
  try {
    if (!ticket.whatsapp) {
      await ticket.$get("whatsapp");
    }

    const evolutionConfig = await EvolutionApiService.getConfig(ticket.companyId);
    const isEvolution = ticket.whatsapp?.type === "evolution" ||
      ticket.whatsapp?.connectionType === "evolution" ||
      (evolutionConfig.enabled && ticket.whatsapp?.connectionType !== "baileys" && ticket.whatsapp?.type !== "baileys");

    if (isEvolution && ticket.whatsapp) {
      const destination = await getDestinationJid(ticket);
      const fileBuffer = fs.readFileSync(media.path);
      const base64Media = fileBuffer.toString("base64");
      const typeMsg = media.mimetype.split("/")[0];
      const mediaType = typeMsg === "audio" ? "audio" : typeMsg === "video" ? "video" : typeMsg === "image" ? "image" : "document";

      let evoMime = media.mimetype;
      if (evoMime === "image/jpg" || evoMime === "image/pjpeg" || media.originalname?.toLowerCase().endsWith(".jpg") || media.originalname?.toLowerCase().endsWith(".jpeg")) {
        evoMime = "image/jpeg";
      }

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
          console.warn("[Evolution] Error construyendo payload de cita en media:", eQuoted);
        }
      }

      const isFileBody = isFileNameOnly(body, media.originalname);
      const evoCaption = isFileBody ? "" : (formatBody(body, ticket.contact) || "");
      const isSticker = media.mimetype === "image/webp" ||
        media.originalname?.toLowerCase().endsWith(".webp") ||
        body?.toLowerCase().trim() === "sticker";

      let sentRes: any;
      if (isSticker) {
        try {
          sentRes = await EvolutionApiService.sendSticker(
            ticket.whatsapp,
            destination,
            { sticker: base64Media },
            { quoted: quotedPayload, quotedMessageId: quotedMsgIdToSave }
          );
        } catch (evoStickerErr: any) {
          if (quotedPayload || quotedMsgIdToSave) {
            console.warn(`[Evolution] Falló envío de sticker con cita (${evoStickerErr?.message}), reintentando sin cita...`);
            sentRes = await EvolutionApiService.sendSticker(
              ticket.whatsapp,
              destination,
              { sticker: base64Media }
            );
          } else {
            throw evoStickerErr;
          }
        }
      } else {
        try {
          sentRes = await EvolutionApiService.sendMediaMessage(
            ticket.whatsapp,
            destination,
            {
              media: base64Media,
              mediaType: mediaType as any,
              caption: evoCaption,
              fileName: media.originalname,
              mimetype: evoMime
            },
            {
              quoted: quotedPayload,
              quotedMessageId: quotedMsgIdToSave
            }
          );
        } catch (evoMediaErr: any) {
          if (quotedPayload || quotedMsgIdToSave) {
            console.warn(`[Evolution] Falló envío de media con cita (${evoMediaErr?.message}), reintentando sin cita...`);
            sentRes = await EvolutionApiService.sendMediaMessage(
              ticket.whatsapp,
              destination,
              {
                media: base64Media,
                mediaType: mediaType as any,
                caption: evoCaption,
                fileName: media.originalname,
                mimetype: evoMime
              }
            );
          } else {
            throw evoMediaErr;
          }
        }
      }

      const messageId = sentRes?.key?.id || sentRes?.id || `evo_media_${Date.now()}`;
      try {
        await CreateMessageService({
          messageData: {
            id: messageId,
            ticketId: ticket.id,
            body: isSticker ? "sticker" : (isFileBody ? "" : (formatBody(body, ticket.contact) || "")),
            fromMe: true,
            read: true,
            mediaUrl: media.filename,
            mediaType: isSticker ? "sticker" : mediaType,
            ack: 1,
            queueId: ticket.queueId,
            quotedMsgId: quotedMsg?.id
          },
          companyId: ticket.companyId
        });
      } catch (err) {
        console.error("[Evolution] Error guardando media saliente en BD:", err);
      }

      const evoLastMsg = isSticker ? "💟 Sticker" : (isFileBody
        ? (mediaType === "image" ? "📷 Imagen" : mediaType === "video" ? "📹 Video" : mediaType === "audio" ? "🎵 Audio" : "📄 Archivo")
        : (formatBody(body, ticket.contact) || "📷 Archivo"));
      await ticket.update({ lastMessage: evoLastMsg });
      return sentRes as any;
    }

    const wbot = await GetTicketWbot(ticket);
    const companyId = ticket.companyId.toString();

    const pathMedia = media.path;
    const rawMimeType = media.mimetype || "";
    let mimeType = rawMimeType;
    const fileName = media.originalname.replace('/', '-');
    const bodyMessage = formatBody(body, ticket.contact);

    // Normalizar MIME types para imágenes JPEG/JPG
    if (
      mimeType === "image/jpg" ||
      mimeType === "image/pjpeg" ||
      fileName.toLowerCase().endsWith(".jpg") ||
      fileName.toLowerCase().endsWith(".jpeg")
    ) {
      mimeType = "image/jpeg";
    }

    const typeMessage = mimeType.split("/")[0];

    // Lista de tipos MIME de vídeo comuns
    const videoMimeTypes = [
      'video/mp4',
      'video/3gpp',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-ms-wmv',
      'video/x-matroska',
      'video/webm',
      'video/ogg'
    ];

    // Lista de extensões que devem ser tratadas como documento
    const documentExtensions = ['.psd', '.ai', '.eps', '.indd', '.xd', '.sketch', '.svg', '.tif', '.tiff', '.bmp'];

    // Verifica se é um arquivo que deve ser tratado como documento
    const shouldBeDocument = documentExtensions.some(ext => fileName.toLowerCase().endsWith(ext));

    // Formatos de imagen estándar que WhatsApp soporta nativamente como foto
    const standardImageMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const isStandardImage = standardImageMimes.includes(mimeType);

    const isFileText = isFileNameOnly(body, fileName) || isFileNameOnly(body, media.originalname);
    const captionToSend = isFileText ? undefined : (bodyMessage && bodyMessage.trim() ? bodyMessage.trim() : undefined);
    const isSticker = mimeType === "image/webp" ||
      fileName.toLowerCase().endsWith(".webp") ||
      media.originalname?.toLowerCase().endsWith(".webp") ||
      body?.toLowerCase().trim() === "sticker";

    let options: AnyMessageContent;

    if (isSticker) {
      options = {
        sticker: fs.readFileSync(pathMedia),
        mimetype: "image/webp"
      };
    } else if (shouldBeDocument) {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: captionToSend,
        fileName: fileName,
        mimetype: mimeType
      };
    } else if (typeMessage === "video" || videoMimeTypes.includes(mimeType)) {
      options = {
        video: fs.readFileSync(pathMedia),
        caption: captionToSend,
        fileName: fileName,
        mimetype: mimeType
      };
    } else if (typeMessage === "audio") {
      if (mimeType === "audio/ogg") {
        options = {
          audio: fs.readFileSync(pathMedia),
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        };
      } else {
        const convert = await processAudio(pathMedia, companyId);
        options = {
          audio: fs.readFileSync(convert),
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        };
      }
    } else if (typeMessage === "image" && isStandardImage) {
      options = {
        image: fs.readFileSync(pathMedia),
        caption: captionToSend,
        mimetype: mimeType
      };
    } else if (typeMessage === "image" && !isStandardImage) {
      // Si es un formato de imagen no estándar (SVG, BMP, TIFF, etc.), se envía como documento
      // para asegurar que el receptor lo reciba intacto y sin errores
      options = {
        document: fs.readFileSync(pathMedia),
        caption: captionToSend,
        fileName: fileName,
        mimetype: mimeType
      };
    } else if (typeMessage === "document" || mimeType === "application/pdf") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: captionToSend,
        fileName: fileName,
        mimetype: mimeType
      };
    } else {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: captionToSend,
        fileName: fileName,
        mimetype: mimeType || "application/octet-stream"
      };
    }

    const finalJid = await getDestinationJid(ticket, wbot);

    let quotedOptions: any = undefined;
    if (quotedMsg) {
      try {
        const chatMessages = await Message.findOne({ where: { id: quotedMsg.id } });
        if (chatMessages) {
          let msgFound: any = null;
          if (chatMessages.dataJson) {
            try {
              msgFound = JSON.parse(chatMessages.dataJson);
            } catch (e) {
              msgFound = null;
            }
          }

          const isGroup = ticket.isGroup || (chatMessages.remoteJid && chatMessages.remoteJid.includes("@g.us"));
          const quotedRemoteJid = isGroup ? (chatMessages.remoteJid || finalJid) : finalJid;

          const quotedKey = {
            remoteJid: quotedRemoteJid,
            fromMe: msgFound?.key?.fromMe ?? chatMessages.fromMe,
            id: chatMessages.id,
            participant: isGroup ? (msgFound?.key?.participant || chatMessages.participant) : undefined
          };

          // Extraer o generar el content del mensaje citado sanitizado
          const quotedContent = buildCleanQuotedMessage(chatMessages, msgFound);

          const ephemeralExpiration = msgFound?.message?.imageMessage?.contextInfo?.expiration ||
            msgFound?.message?.extendedTextMessage?.contextInfo?.expiration ||
            msgFound?.message?.videoMessage?.contextInfo?.expiration ||
            msgFound?.message?.conversation?.contextInfo?.expiration;

          quotedOptions = {
            quoted: {
              key: quotedKey,
              message: quotedContent
            },
            ...(ephemeralExpiration ? { ephemeralExpiration } : {})
          };
        }
      } catch (errQ) {
        console.warn("[SendWhatsAppMedia] Error preparando cita:", errQ);
      }
    }

    let sentMessage: WAMessage;
    try {
      sentMessage = await wbot.sendMessage(
        finalJid,
        {
          ...options
        },
        quotedOptions
      );
    } catch (sendMediaErr: any) {
      if (quotedOptions) {
        console.warn(`[SendWhatsAppMedia] Falló envío de media con cita (${sendMediaErr?.message}), reintentando sin cita...`);
        sentMessage = await wbot.sendMessage(
          finalJid,
          {
            ...options
          }
        );
      } else {
        throw sendMediaErr;
      }
    }

    const detectedMediaType = isSticker
      ? "sticker"
      : (typeMessage === "image" && isStandardImage)
      ? "image"
      : typeMessage === "video"
      ? "video"
      : typeMessage === "audio"
      ? "audio"
      : "document";

    try {
      await CreateMessageService({
        messageData: {
          id: sentMessage?.key?.id || `media_${Date.now()}`,
          ticketId: ticket.id,
          contactId: undefined,
          body: isSticker ? "sticker" : (isFileText ? "" : (bodyMessage || "")),
          fromMe: true,
          read: true,
          mediaUrl: media.filename,
          mediaType: detectedMediaType,
          ack: 1,
          queueId: ticket.queueId,
          quotedMsgId: quotedMsg?.id
        },
        companyId: ticket.companyId
      });
    } catch (saveErr) {
      console.error("[SendWhatsAppMedia] Error al guardar media saliente en BD:", saveErr);
    }

    const baileysLastMsg = isSticker ? "💟 Sticker" : (isFileText
      ? (detectedMediaType === "image" ? "📷 Imagen" : detectedMediaType === "video" ? "📹 Video" : detectedMediaType === "audio" ? "🎵 Audio" : "📄 Archivo")
      : (bodyMessage || "📷 Archivo"));
    await ticket.update({ lastMessage: baileysLastMsg });

    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log("ERROR:: ", err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;