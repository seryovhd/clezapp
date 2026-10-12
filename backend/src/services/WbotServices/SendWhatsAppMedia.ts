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
      if (!destination.includes("@")) {
        const lastMsg = await Message.findOne({
          where: { ticketId: ticket.id },
          order: [["createdAt", "DESC"]]
        });
        if (lastMsg?.remoteJid?.endsWith("@lid") || lastMsg?.remoteJid?.includes("@")) {
          destination = lastMsg.remoteJid;
        } else if (destination.length > 13) {
          const lidMsg = await Message.findOne({
            where: {
              ticketId: ticket.id,
              remoteJid: { [Op.like]: "%@lid%" }
            }
          });
          if (lidMsg?.remoteJid) {
            destination = lidMsg.remoteJid;
          }
        }
      }

      const fileBuffer = fs.readFileSync(media.path);
      const base64Media = fileBuffer.toString("base64");
      const typeMsg = media.mimetype.split("/")[0];
      const mediaType = typeMsg === "audio" ? "audio" : typeMsg === "video" ? "video" : typeMsg === "image" ? "image" : "document";

      const sentRes = await EvolutionApiService.sendMediaMessage(
        ticket.whatsapp,
        destination,
        {
          media: base64Media,
          mediaType: mediaType as any,
          caption: formatBody(body, ticket.contact),
          fileName: media.originalname,
          mimetype: media.mimetype
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
    const mimeType = media.mimetype;
    const typeMessage = mimeType.split("/")[0];
    const fileName = media.originalname.replace('/', '-');
    let options: AnyMessageContent;
    const bodyMessage = formatBody(body, ticket.contact);

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
    const documentExtensions = ['.psd', '.ai', '.eps', '.indd', '.xd', '.sketch'];

    // Verifica se é um arquivo PSD ou similar (deve ser tratado como documento)
    const shouldBeDocument = documentExtensions.some(ext => fileName.toLowerCase().endsWith(ext));

    if (shouldBeDocument) {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: bodyMessage,
        fileName: fileName,
        mimetype: mimeType
      };
    }
    // Verifica se é um vídeo (incluindo vários formatos)
    else if (typeMessage === "video" || videoMimeTypes.includes(mimeType)) {
      options = {
        video: fs.readFileSync(pathMedia),
        caption: bodyMessage,
        fileName: fileName,
        mimetype: mimeType
      };
    } else if (typeMessage === "audio") {
      // Verifica se o arquivo já é OGG
      if (mimeType === "audio/ogg") {
        options = {
          audio: fs.readFileSync(pathMedia),
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        };
      } else {
        // Converte para OGG se não for
        const convert = await processAudio(pathMedia, companyId);
        options = {
          audio: fs.readFileSync(convert),
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        };
      }
    } else if (typeMessage === "document" || mimeType === "application/pdf") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: bodyMessage,
        fileName: fileName,
        mimetype: mimeType
      };
    } else if (typeMessage === "image") {
      options = {
        image: fs.readFileSync(pathMedia),
        caption: bodyMessage
      };
    } else {
      // Caso o tipo de mídia não seja reconhecido, trata como documento
      options = {
        document: fs.readFileSync(pathMedia),
        caption: bodyMessage,
        fileName: fileName,
        mimetype: mimeType
      };
    }

    const sentMessage = await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        ...options
      }
    );

    await ticket.update({ lastMessage: bodyMessage });

    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log("ERROR:: ", err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;