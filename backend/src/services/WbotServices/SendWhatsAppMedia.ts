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

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  companyId?: number;
  body?: string;
  isForwarded?: boolean;  
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

export const getMessageOptions = async (
  fileName: string,
  pathMedia: string,
  companyId?: string,
  body: string = " "
): Promise<any> => {
  const mimeType = mime.lookup(pathMedia);
  const typeMessage = mimeType.split("/")[0];

  try {
    if (!mimeType) {
      throw new Error("Invalid mimetype");
    }
    let options: AnyMessageContent;

    if (typeMessage === "video") {
      options = {
        video: fs.readFileSync(pathMedia),
        caption: body ? body : null,
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
        caption: body ? body : null,
        fileName: fileName,
        mimetype: mimeType
      };
    } else if (typeMessage === "application") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: body ? body : null,
        fileName: fileName,
        mimetype: mimeType
      };
    } else {
      options = {
        image: fs.readFileSync(pathMedia),
        caption: body ? body : null,
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
  isForwarded = false
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
      let destination = ticket.contact.number;
      if (ticket.isGroup) {
        destination = destination.includes("@g.us") ? destination : `${destination}@g.us`;
      } else {
        destination = destination.replace(/@.*$/, "").replace(/\D/g, "");
      }
      const fileBuffer = fs.readFileSync(media.path);
      const base64Media = fileBuffer.toString("base64");
      const typeMsg = media.mimetype.split("/")[0];
      const mediaType = typeMsg === "audio" ? "audio" : typeMsg === "video" ? "video" : typeMsg === "image" ? "image" : "document";

      let evoMime = media.mimetype;
      if (evoMime === "image/jpg" || evoMime === "image/pjpeg" || media.originalname?.toLowerCase().endsWith(".jpg") || media.originalname?.toLowerCase().endsWith(".jpeg")) {
        evoMime = "image/jpeg";
      }

      const sentRes = await EvolutionApiService.sendMediaMessage(
        ticket.whatsapp,
        destination,
        {
          media: base64Media,
          mediaType: mediaType as any,
          caption: formatBody(body, ticket.contact),
          fileName: media.originalname,
          mimetype: evoMime
        }
      );

      const messageId = sentRes?.key?.id || sentRes?.id || `evo_media_${Date.now()}`;
      try {
        await CreateMessageService({
          messageData: {
            id: messageId,
            ticketId: ticket.id,
            body: formatBody(body, ticket.contact) || media.originalname,
            fromMe: true,
            read: true,
            mediaUrl: media.filename,
            mediaType: mediaType,
            ack: 1,
            queueId: ticket.queueId
          },
          companyId: ticket.companyId
        });
      } catch (err) {
        console.error("[Evolution] Error guardando media saliente en BD:", err);
      }

      await ticket.update({ lastMessage: formatBody(body, ticket.contact) || media.originalname });
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

    let options: AnyMessageContent;

    if (shouldBeDocument) {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: bodyMessage,
        fileName: fileName,
        mimetype: mimeType
      };
    } else if (typeMessage === "video" || videoMimeTypes.includes(mimeType)) {
      options = {
        video: fs.readFileSync(pathMedia),
        caption: bodyMessage,
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
        caption: bodyMessage,
        mimetype: mimeType,
        fileName: fileName
      };
    } else if (typeMessage === "image" && !isStandardImage) {
      // Si es un formato de imagen no estándar (SVG, BMP, TIFF, etc.), se envía como documento
      // para asegurar que el receptor lo reciba intacto y sin errores
      options = {
        document: fs.readFileSync(pathMedia),
        caption: bodyMessage,
        fileName: fileName,
        mimetype: mimeType
      };
    } else if (typeMessage === "document" || mimeType === "application/pdf") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: bodyMessage,
        fileName: fileName,
        mimetype: mimeType
      };
    } else {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: bodyMessage,
        fileName: fileName,
        mimetype: mimeType || "application/octet-stream"
      };
    }

    const cleanLid = ticket.contact.lid ? ticket.contact.lid.replace(/\D/g, "") : "";
    const cleanDestNumber = ticket.contact.number.replace(/@.*$/, "").replace(/\D/g, "");
    const isLid = !ticket.isGroup && (cleanDestNumber.length >= 15 || ticket.contact.number.endsWith("@lid") || !!cleanLid);
    const finalJid = ticket.isGroup
      ? (ticket.contact.number.includes("@g.us") ? ticket.contact.number : `${ticket.contact.number}@g.us`)
      : (isLid ? `${cleanLid || cleanDestNumber}@lid` : `${cleanDestNumber}@s.whatsapp.net`);

    const sentMessage = await wbot.sendMessage(
      finalJid,
      {
        ...options
      }
    );

    const detectedMediaType = (typeMessage === "image" && isStandardImage)
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
          body: bodyMessage || fileName,
          fromMe: true,
          read: true,
          mediaUrl: media.filename,
          mediaType: detectedMediaType,
          ack: 1,
          queueId: ticket.queueId
        },
        companyId: ticket.companyId
      });
    } catch (saveErr) {
      console.error("[SendWhatsAppMedia] Error al guardar media saliente en BD:", saveErr);
    }

    await ticket.update({ lastMessage: bodyMessage || fileName });

    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log("ERROR:: ", err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;