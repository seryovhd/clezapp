import path, { join } from "path";
import { readFile, writeFile } from "fs";
import * as Sentry from "@sentry/node";
import { isNil, isNull, head } from "lodash";
import { extension as mimeExtension } from "mime-types";

import {
  downloadMediaMessage,
  extractMessageContent,
  getContentType,
  jidNormalizedUser,
  MessageUpsertType,
  proto,
  WAMessage,
  WAMessageStubType,
  WAMessageUpdate,
  WASocket
} from "@whiskeysockets/baileys";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";

import { getIO } from "../../libs/socket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { logger } from "../../utils/logger";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import formatBody from "../../helpers/Mustache";
import { Store } from "../../libs/store";
import TicketTraking from "../../models/TicketTraking";
import UserRating from "../../models/UserRating";
import SendWhatsAppMessage from "./SendWhatsAppMessage";
import moment from "moment";
import Queue from "../../models/Queue";
import QueueOption from "../../models/QueueOption";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import VerifyCurrentSchedule from "../CompanyService/VerifyCurrentSchedule";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import { Op } from "sequelize";
import { campaignQueue, parseToMilliseconds, randomValue } from "../../queues";
import User from "../../models/User";
import Setting from "../../models/Setting";
import { cacheLayer } from "../../libs/cache";
import { provider } from "./providers";
import { debounce } from "../../helpers/Debounce";
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from "openai";
import ffmpeg from "fluent-ffmpeg";
import {
  SpeechConfig,
  SpeechSynthesizer,
  AudioConfig
} from "microsoft-cognitiveservices-speech-sdk";
import typebotListener from "../TypebotServices/typebotListener";
import QueueIntegrations from "../../models/QueueIntegrations";
import ShowQueueIntegrationService from "../QueueIntegrationServices/ShowQueueIntegrationService";

import { FlowBuilderModel } from "../../models/FlowBuilder";
import { FlowDefaultModel } from "../../models/FlowDefault";
import { FlowCampaignModel } from "../../models/FlowCampaign";
import { IOpenAi } from "../../@types/openai";
interface IDeepSeek {
  name: string;
  prompt: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  model: string;
  queueId?: number;
  maxMessages?: number;
  saveResponseTo?: string;
}

interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}
import { IConnections, INodes } from "../WebhookService/DispatchWebHookService";
import { ActionsWebhookService } from "../WebhookService/ActionsWebhookService";
import { WebhookModel } from "../../models/Webhook";

import { differenceInMilliseconds } from "date-fns";
import Whatsapp from "../../models/Whatsapp";

const request = require("request");
const fs = require("fs");

const getAckFromStatus = (status: any, fromMe?: boolean): number => {
  if (typeof status === "number") return status;
  if (!status) return fromMe ? 1 : 0;
  const s = String(status).toUpperCase();
  if (s.includes("READ")) return 3;
  if (s.includes("DELIVERY") || s.includes("DELIVERED")) return 2;
  if (s.includes("SERVER") || s.includes("SENT") || s.includes("RECEIVE")) return 1;
  if (s.includes("PLAYED")) return 4;
  return fromMe ? 1 : 0;
};

type Session = WASocket & {
  id?: number;
  store?: Store;
};

interface SessionOpenAi extends OpenAIApi {
  id?: number;
}
const sessionsOpenAi: SessionOpenAi[] = [];

interface ImessageUpsert {
  messages: proto.IWebMessageInfo[];
  type: MessageUpsertType;
}

interface IMe {
  name: string;
  id: string;
}

interface IMessage {
  messages: WAMessage[];
  isLatest: boolean;
}

export const isNumeric = (value: string) => /^-?\d+$/.test(value);

const writeFileAsync = async (path, data) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, data, err => {
      if (err) reject(err);
      else resolve(null);
    });
  });
};

const normalizeLidJid = (msg: proto.IWebMessageInfo): string => {
  const msgWithAny = msg as any;
  
  if (msg.key.remoteJid?.endsWith('@lid') && msgWithAny.key?.remoteJidAlt) {
    console.log(`Normalizando LID: ${msg.key.remoteJid} -> ${msgWithAny.key.remoteJidAlt}`);
    return msgWithAny.key.remoteJidAlt;
  }
  
  if (msgWithAny.key?.senderPn) {
    console.log(`Usando senderPn: ${msgWithAny.key.senderPn}`);
    return msgWithAny.key.senderPn;
  }
  
  return msg.key.remoteJid;
};

const debugEncryptedMessage = (msg: proto.IWebMessageInfo, functionName: string) => {
  const messageId = msg.key.id || 'sin-id';
  if (msg.message && "enc" in msg.message) {
    console.error(`CIFRADO ENCONTRADO en ${functionName}: ${messageId}`);
    return true;
  }
  return false;
};

const getTypeMessage = (msg: proto.IWebMessageInfo): string => {
  const contentType = getContentType(msg.message);

  if (contentType === "senderKeyDistributionMessage") {
    return "system:senderKey";
  }
  
  if (msg.message && "enc" in msg.message) {
    return "encryptedMessage";
  }

  return contentType;
};

function hasCaption(title: string, fileName: string) {
  if (!title || !fileName) return false;

  const fileNameExtension = fileName.substring(fileName.lastIndexOf('.') + 1);

  return !fileName.includes(`${title}.${fileNameExtension}`)
}

export function validaCpfCnpj(val) {
  if (val.length == 11) {
    var cpf = val.trim();

    cpf = cpf.replace(/\./g, "");
    cpf = cpf.replace("-", "");
    cpf = cpf.split("");

    var v1 = 0;
    var v2 = 0;
    var aux = false;

    for (var i = 1; cpf.length > i; i++) {
      if (cpf[i - 1] != cpf[i]) {
        aux = true;
      }
    }

    if (aux == false) {
      return false;
    }

    for (var i = 0, p = 10; cpf.length - 2 > i; i++, p--) {
      v1 += cpf[i] * p;
    }

    v1 = (v1 * 10) % 11;

    if (v1 == 10) {
      v1 = 0;
    }

    if (v1 != cpf[9]) {
      return false;
    }

    for (var i = 0, p = 11; cpf.length - 1 > i; i++, p--) {
      v2 += cpf[i] * p;
    }

    v2 = (v2 * 10) % 11;

    if (v2 == 10) {
      v2 = 0;
    }

    if (v2 != cpf[10]) {
      return false;
    } else {
      return true;
    }
  } else if (val.length == 14) {
    var cnpj = val.trim();

    cnpj = cnpj.replace(/\./g, "");
    cnpj = cnpj.replace("-", "");
    cnpj = cnpj.replace("/", "");
    cnpj = cnpj.split("");

    var v1 = 0;
    var v2 = 0;
    var aux = false;

    for (var i = 1; cnpj.length > i; i++) {
      if (cnpj[i - 1] != cnpj[i]) {
        aux = true;
      }
    }

    if (aux == false) {
      return false;
    }

    for (var i = 0, p1 = 5, p2 = 13; cnpj.length - 2 > i; i++, p1--, p2--) {
      if (p1 >= 2) {
        v1 += cnpj[i] * p1;
      } else {
        v1 += cnpj[i] * p2;
      }
    }

    v1 = v1 % 11;

    if (v1 < 2) {
      v1 = 0;
    } else {
      v1 = 11 - v1;
    }

    if (v1 != cnpj[12]) {
      return false;
    }

    for (var i = 0, p1 = 6, p2 = 14; cnpj.length - 1 > i; i++, p1--, p2--) {
      if (p1 >= 2) {
        v2 += cnpj[i] * p1;
      } else {
        v2 += cnpj[i] * p2;
      }
    }

    v2 = v2 % 11;

    if (v2 < 2) {
      v2 = 0;
    } else {
      v2 = 11 - v2;
    }

    if (v2 != cnpj[13]) {
      return false;
    } else {
      return true;
    }
  } else {
    return false;
  }
}

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function sleep(time) {
  await timeout(time);
}

export const sendMessageImage = async (
  wbot: Session,
  contact,
  ticket: Ticket,
  url: string,
  caption: string
) => {
  let sentMessage;
  try {
    sentMessage = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        image: url
          ? { url }
          : fs.readFileSync(`public/temp/${caption}-${makeid(10)}`),
        fileName: caption,
        caption: caption,
        mimetype: "image/jpeg"
      }
    );
  } catch (error) {
    sentMessage = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        text: formatBody(
          "Não consegui enviar a imagem, tente novamente!",
          contact
        )
      }
    );
  }
  verifyMessage(sentMessage, ticket, contact);
};

export const sendMessageLink = async (
  wbot: Session,
  contact: Contact,
  ticket: Ticket,
  url: string,
  caption: string
) => {
  let sentMessage;
  try {
    sentMessage = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        document: url
          ? { url }
          : fs.readFileSync(`public/temp/${caption}-${makeid(10)}`),
        fileName: caption,
        caption: caption,
        mimetype: "application/pdf"
      }
    );
  } catch (error) {
    sentMessage = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        text: formatBody("Não consegui enviar o PDF, tente novamente!", contact)
      }
    );
  }
  verifyMessage(sentMessage, ticket, contact);
};

const saveMediaFromMessage = async (msg: proto.IWebMessageInfo, companyId: number): Promise<string> => {
  try {
    const media = await downloadMedia(msg);

    if (!media) {
      throw new Error("No se pudo descargar el medio");
    }

    const folder = path.join(__dirname, "..", "..", "..", "public", `company${companyId}`, "flow_media");

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const fileExtension = media.filename.split('.').pop() ||
      media.mimetype.split('/')[1] ||
      'jpg';
    const uniqueFilename = `flow_media_${uniqueSuffix}.${fileExtension}`;

    const fullPath = path.join(folder, uniqueFilename);

    await fs.promises.writeFile(fullPath, media.data, 'base64');

    return `public/company${companyId}/flow_media/${uniqueFilename}`;

  } catch (error) {
    console.error("Error guardando medio:", error);
    throw error;
  }
};

export function makeid(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const getBodyButton = (msg: proto.IWebMessageInfo): string => {
  if (
    msg.key.fromMe &&
    msg?.message?.viewOnceMessage?.message?.buttonsMessage?.contentText
  ) {
    let bodyMessage = `*${msg?.message?.viewOnceMessage?.message?.buttonsMessage?.contentText}*`;

    for (const buton of msg.message?.viewOnceMessage?.message?.buttonsMessage
      ?.buttons) {
      bodyMessage += `\n\n${buton.buttonText?.displayText}`;
    }
    return bodyMessage;
  }

  if (msg.key.fromMe && msg?.message?.viewOnceMessage?.message?.listMessage) {
    let bodyMessage = `*${msg?.message?.viewOnceMessage?.message?.listMessage?.description}*`;
    for (const buton of msg.message?.viewOnceMessage?.message?.listMessage
      ?.sections) {
      for (const rows of buton.rows) {
        bodyMessage += `\n\n${rows.title}`;
      }
    }

    return bodyMessage;
  }
};

const msgLocation = (image, latitude, longitude) => {
  if (image) {
    var b64 = Buffer.from(image).toString("base64");

    let data = `data:image/png;base64, ${b64} | https://maps.google.com/maps?q=${latitude}%2C${longitude}&z=17&hl=pt-BR|${latitude}, ${longitude} `;
    return data;
  }
};

export const getBodyMessage = (msg: proto.IWebMessageInfo): string | null => {
  try {
    if (msg.message && "enc" in msg.message) {
      return "[Mensaje cifrado]";
    }
    let type = getTypeMessage(msg);
    if (!type || type === "system:senderKey") {
      return null;
    }

    const types = {
      conversation: msg?.message?.conversation,
      editedMessage:
        msg?.message?.editedMessage?.message?.protocolMessage?.editedMessage
          ?.conversation,
      imageMessage: msg.message?.imageMessage?.caption,
      videoMessage: msg.message?.videoMessage?.caption,
      extendedTextMessage: msg.message?.extendedTextMessage?.text,
      buttonsResponseMessage:
        msg.message?.buttonsResponseMessage?.selectedButtonId,
      templateButtonReplyMessage:
        msg.message?.templateButtonReplyMessage?.selectedId,
      messageContextInfo:
        msg.message?.buttonsResponseMessage?.selectedButtonId ||
        msg.message?.listResponseMessage?.title,
      buttonsMessage:
        getBodyButton(msg) ||
        msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
      viewOnceMessage:
        getBodyButton(msg) ||
        msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
      stickerMessage: "sticker",
      contactMessage: msg.message?.contactMessage?.vcard,
      contactsArrayMessage: "varios contatos",
      locationMessage: msgLocation(
        msg.message?.locationMessage?.jpegThumbnail,
        msg.message?.locationMessage?.degreesLatitude,
        msg.message?.locationMessage?.degreesLongitude
      ),
      liveLocationMessage: `Latitude: ${msg.message?.liveLocationMessage?.degreesLatitude} - Longitude: ${msg.message?.liveLocationMessage?.degreesLongitude}`,
      documentMessage: msg.message?.documentMessage?.caption,
      documentWithCaptionMessage:
        msg.message?.documentWithCaptionMessage?.message?.documentMessage
          ?.caption,
      audioMessage: "Audio",
      listMessage:
        getBodyButton(msg) || msg.message?.listResponseMessage?.title,
      listResponseMessage:
        msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
      reactionMessage: msg.message?.reactionMessage?.text || "reaction",
      protocolMessage:
        msg.message?.protocolMessage?.type === 14
          ? msg.message.protocolMessage.editedMessage?.conversation ||
          msg.message.protocolMessage.editedMessage?.extendedTextMessage?.text ||
          ""
          : ""
    };

    const objKey = Object.keys(types).find(key => key === type);

    if (!objKey && type !== "protocolMessage" && type !== "system:senderKey") {
      logger.warn(`NO SE ENCONTRÓ EL TIPO: ${type}
${JSON.stringify(msg)}`);
      Sentry.setExtra("MENSAJE", { BodyMsg: msg.message, msg, type });
      Sentry.captureException(
        new Error("NUEVO TIPO DE MENSAJE EN GETTYPEMESSAGE")
      );
    }

    const body = types[type];
    return body || "";
  } catch (error) {
    Sentry.setExtra("Error getTypeMessage", { msg, BodyMsg: msg.message });
    Sentry.captureException(error);
    return "";
  }
};

export const getQuotedMessage = (msg: proto.IWebMessageInfo): any => {
  const body =
    msg.message.imageMessage.contextInfo ||
    msg.message.videoMessage.contextInfo ||
    msg.message?.documentMessage ||
    msg.message.extendedTextMessage.contextInfo ||
    msg.message.buttonsResponseMessage.contextInfo ||
    msg.message.listResponseMessage.contextInfo ||
    msg.message.templateButtonReplyMessage.contextInfo ||
    msg.message.buttonsResponseMessage?.contextInfo ||
    msg?.message?.buttonsResponseMessage?.selectedButtonId ||
    msg.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg?.message?.listResponseMessage?.singleSelectReply.selectedRowId ||
    msg.message.listResponseMessage?.contextInfo;
  msg.message.senderKeyDistributionMessage;

  return extractMessageContent(body[Object.keys(body).values().next().value]);
};

export const getQuotedMessageId = (msg: proto.IWebMessageInfo) => {
  const body = extractMessageContent(msg.message)[
    Object.keys(msg?.message).values().next().value
  ];

  return body?.contextInfo?.stanzaId;
};

const getMeSocket = (wbot: Session): IMe => {
  return {
    id: jidNormalizedUser((wbot as WASocket).user.id),
    name: (wbot as WASocket).user.name
  };
};

const getSenderMessage = (
  msg: proto.IWebMessageInfo,
  wbot: Session
): string => {
  const me = getMeSocket(wbot);
  if (msg.key.fromMe) return me.id;

  const msgWithAny = msg as any;
  const normalizedJid = normalizeLidJid(msg);
  
  let senderId = msg.participant || msg.key.participant || normalizedJid || undefined;

  if (msgWithAny.key?.senderPn) {
    senderId = msgWithAny.key.senderPn;
    console.log(`Normalizando senderId con senderPn: ${senderId}`);
  }

  return senderId && jidNormalizedUser(senderId);
};

const getContactMessage = async (msg: proto.IWebMessageInfo, wbot: Session) => {
  const normalizedJid = normalizeLidJid(msg);
  const isGroup = normalizedJid.includes("g.us");
  
  const msgWithAny = msg as any;
  let senderId = msg.participant || msg.key.participant || normalizedJid || undefined;

  if (msgWithAny.key?.senderPn) {
    senderId = msgWithAny.key.senderPn;
    console.log(`Normalizando senderId con senderPn: ${senderId}`);
  }

  const rawNumber = normalizedJid.replace(/\D/g, "");

  return isGroup
    ? {
      id: getSenderMessage(msg, wbot),
      name: msg.pushName
    }
    : {
      id: normalizedJid,
      name: msg.key.fromMe ? rawNumber : msg.pushName
    };
};

const downloadMedia = async (msg: proto.IWebMessageInfo) => {
  let buffer;
  try {
    buffer = await downloadMediaMessage(msg as any, "buffer", {});
  } catch (err) {
    console.error("Erro ao baixar mídia:", err);
  }

  let filename = msg.message?.documentMessage?.fileName || "";

  const mineType =
    msg.message?.imageMessage ||
    msg.message?.audioMessage ||
    msg.message?.videoMessage ||
    msg.message?.stickerMessage ||
    msg.message?.documentMessage ||
    msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
      ?.imageMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

  if (!mineType) console.log("mine:: ", msg);

  if (!filename) {
    const ext = mimeExtension(mineType.mimetype);
    filename = `${new Date().getTime()}.${ext}`;
  } else {
    filename = `${new Date().getTime()}_${filename}`;
  }

  const media = {
    data: buffer,
    mimetype: mineType.mimetype,
    filename
  };

  return media;
};

const verifyContact = async (
  msgContact: IMe,
  wbot: Session,
  companyId: number
): Promise<Contact> => {
  let profilePicUrl: string;
  
  const cleanNumber = msgContact.id.endsWith('@lid') 
    ? msgContact.id.replace('@lid', '') 
    : msgContact.id;

  try {
    profilePicUrl = await wbot.profilePictureUrl(msgContact.id);
  } catch (e) {
    Sentry.captureException(e);
    profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
  }

  const contactData = {
    name: msgContact?.name || cleanNumber.replace(/\D/g, ""),
    number: cleanNumber.replace(/\D/g, ""),
    profilePicUrl,
    isGroup: msgContact.id.includes("g.us"),
    companyId,
    whatsappId: wbot.id
  };

  const contact = CreateOrUpdateContactService(contactData);

  return contact;
};

const verifyQuotedMessage = async (
  msg: proto.IWebMessageInfo
): Promise<Message | null> => {
  if (!msg) return null;
  const quoted = getQuotedMessageId(msg);

  if (!quoted) return null;

  const quotedMsg = await Message.findOne({
    where: { id: quoted }
  });

  if (!quotedMsg) return null;

  return quotedMsg;
};

const sanitizeName = (name: string): string => {
  let sanitized = name.split(" ")[0];
  sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, "");
  return sanitized.substring(0, 60);
};

export const convertTextToSpeechAndSaveToFile = (
  text: string,
  filename: string,
  subscriptionKey: string,
  serviceRegion: string,
  voice: string = "pt-BR-FabioNeural",
  audioToFormat: string = "mp3"
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const speechConfig = SpeechConfig.fromSubscription(
      subscriptionKey,
      serviceRegion
    );
    speechConfig.speechSynthesisVoiceName = voice;
    const audioConfig = AudioConfig.fromAudioFileOutput(`${filename}.wav`);
    const synthesizer = new SpeechSynthesizer(speechConfig, audioConfig);
    synthesizer.speakTextAsync(
      text,
      result => {
        if (result) {
          convertWavToAnotherFormat(
            `${filename}.wav`,
            `${filename}.${audioToFormat}`,
            audioToFormat
          )
            .then(output => {
              resolve();
            })
            .catch(error => {
              console.error(error);
              reject(error);
            });
        } else {
          reject(new Error("No result from synthesizer"));
        }
        synthesizer.close();
      },
      error => {
        console.error(`Error: ${error}`);
        synthesizer.close();
        reject(error);
      }
    );
  });
};

const convertWavToAnotherFormat = (
  inputPath: string,
  outputPath: string,
  toFormat: string
) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .toFormat(toFormat)
      .on("end", () => resolve(outputPath))
      .on("error", (err: { message: any }) =>
        reject(new Error(`Error converting file: ${err.message}`))
      )
      .save(outputPath);
  });
};

const deleteFileSync = (path: string): void => {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    console.error("Erro ao deletar o arquivo:", error);
  }
};

export const keepOnlySpecifiedChars = (str: string) => {
  return str.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚâêîôûÂÊÎÔÛãõÃÕçÇ!?.,;:\s]/g, "");
};

export const detectMediaTypeFromMessage = (msg: proto.IWebMessageInfo): string => {
  const msgType = getTypeMessage(msg);

  switch (msgType) {
    case "imageMessage":
      return "image";
    case "videoMessage":
      return "video";
    case "audioMessage":
    case "voiceMessage":
      return "audio";
    case "documentMessage":
    case "documentWithCaptionMessage":
      return "document";
    case "stickerMessage":
      return "sticker";
    case "contactMessage":
      return "contact";
    case "locationMessage":
    case "liveLocationMessage":
      return "location";
    case "conversation":
    case "extendedTextMessage":
    case "editedMessage":
      return "text";
    default:
      return "text";
  }
};

export const getMediaValueFromMessage = (msg: proto.IWebMessageInfo): string => {
  const msgType = getTypeMessage(msg);
  const body = getBodyMessage(msg);

  if (msgType === "imageMessage" || msgType === "videoMessage" ||
    msgType === "audioMessage" || msgType === "documentMessage" ||
    msgType === "stickerMessage" || msgType === "contactMessage" ||
    msgType === "locationMessage") {
    return "present";
  }

  return body || "";
};

const handleOpenAi = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  ticket: Ticket,
  contact: Contact,
  mediaSent: Message | undefined,
  ticketTraking: TicketTraking = null,
  openAiSettings = null
): Promise<void> => {
  if (msg.message && "enc" in msg.message) {
    return;
  }
  if (msg.message?.protocolMessage && msg.message.protocolMessage.type !== 14) {
    return;
  }

  if (contact.disableBot) {
    return;
  }

  const bodyMessage = getBodyMessage(msg);

  if (!bodyMessage) return;

  let { prompt } = await ShowWhatsAppService(wbot.id, ticket.companyId);

  if (openAiSettings)
    prompt = openAiSettings;

  if (!prompt && !isNil(ticket?.queue?.prompt)) {
    prompt = ticket.queue.prompt;
  }

  if (!prompt) return;

  if (msg.messageStubType) return;

  const publicFolder: string = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public"
  );

  let openai: SessionOpenAi;
  const openAiIndex = sessionsOpenAi.findIndex(s => s.id === wbot.id);

  if (openAiIndex === -1) {
    const configuration = new Configuration({
      apiKey: prompt.apiKey
    });
    openai = new OpenAIApi(configuration);
    openai.id = wbot.id;
    sessionsOpenAi.push(openai);
  } else {
    openai = sessionsOpenAi[openAiIndex];
  }

  let maxMessages = prompt.maxMessages;

  const messages = await Message.findAll({
    where: { ticketId: ticket.id },
    order: [["createdAt", "DESC"]],
    limit: maxMessages
  });

  const promptSystem = `En las respuestas utiliza el nombre ${sanitizeName(
    contact.name || "Amigo(a)"
  )} para identificar al cliente.\nTu respuesta debe usar como máximo ${prompt.maxTokens
    } tokens y asegúrate de no cortar el final.\nSiempre que sea posible, menciona su nombre para que la atención sea más personalizada y cordial. Cuando la respuesta requiera una transferencia al sector de atención, comienza tu respuesta con 'Acción: Transferir al sector de atención'.\n
   ${prompt.prompt}\n`;

  let messagesOpenAi: ChatCompletionRequestMessage[] = [];

  if (msg.message?.conversation || msg.message?.extendedTextMessage?.text) {
    messagesOpenAi = [];
    messagesOpenAi.push({ role: "system", content: promptSystem });
    for (let i = 0; i < Math.min(maxMessages, messages.length); i++) {
      const message = messages[i];
      if (
        message.mediaType === "conversation" ||
        message.mediaType === "extendedTextMessage"
      ) {
        if (message.fromMe) {
          messagesOpenAi.push({ role: "assistant", content: message.body });
        } else {
          messagesOpenAi.push({ role: "user", content: message.body });
        }
      }
    }
    messagesOpenAi.push({ role: "user", content: bodyMessage! });

    const chat = await openai.createChatCompletion({
      model: prompt.model,
      messages: messagesOpenAi,
      max_tokens: prompt.maxTokens,
      temperature: prompt.temperature
    });

    let response = chat.data.choices[0].message?.content;

    if (response?.includes("Acción: Transferir al sector de atención")) {
      await transferQueue(prompt.queueId, ticket, contact);
      response = response
        .replace("Acción: Transferir al sector de atención", "")
        .trim();
    }

    const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
      text: response!
    });
    await verifyMessage(sentMessage!, ticket, contact);
  } else if (msg.message?.audioMessage) {
    const mediaUrl = mediaSent!.mediaUrl!.split("/").pop();
    const file = fs.createReadStream(`${publicFolder}/${mediaUrl}`) as any;
    const transcription = await openai.createTranscription(file, "whisper-1");

    messagesOpenAi = [];
    messagesOpenAi.push({ role: "system", content: promptSystem });
    for (let i = 0; i < Math.min(maxMessages, messages.length); i++) {
      const message = messages[i];
      if (
        message.mediaType === "conversation" ||
        message.mediaType === "extendedTextMessage"
      ) {
        if (message.fromMe) {
          messagesOpenAi.push({ role: "assistant", content: message.body });
        } else {
          messagesOpenAi.push({ role: "user", content: message.body });
        }
      }
    }
    messagesOpenAi.push({ role: "user", content: transcription.data.text });
    const chat = await openai.createChatCompletion({
      model: prompt.model,
      messages: messagesOpenAi,
      max_tokens: prompt.maxTokens,
      temperature: prompt.temperature
    });
    let response = chat.data.choices[0].message?.content;

    if (response?.includes("Acción: Transferir al sector de atención")) {
      await transferQueue(prompt.queueId, ticket, contact);
      response = response
        .replace("Acción: Transferir al sector de atención", "")
        .trim();
    }
  }
  messagesOpenAi = [];
};

const handleDeepSeek = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  ticket: Ticket,
  contact: Contact,
  deepSeekSettings: IDeepSeek
): Promise<void> => {
  if (msg.message && "enc" in msg.message) {
    return;
  }
  if (msg.message?.protocolMessage && msg.message.protocolMessage.type !== 14) {
    return;
  }
  if (contact.disableBot) {
    return;
  }

  const bodyMessage = getBodyMessage(msg);
  if (!bodyMessage) return;

  try {
    const maxMessages = deepSeekSettings.maxMessages || 10;
    const messages = await Message.findAll({
      where: { ticketId: ticket.id },
      order: [["createdAt", "DESC"]],
      limit: maxMessages
    });

    const promptSystem = `En las respuestas utiliza el nombre ${sanitizeName(
      contact.name || "Amigo(a)"
    )} para identificar al cliente.\nTu respuesta debe usar como máximo ${deepSeekSettings.maxTokens} tokens.\n${deepSeekSettings.prompt}\n`;

    const messagesDeepSeek: DeepSeekMessage[] = [
      { role: "system", content: promptSystem }
    ];

    for (let i = 0; i < Math.min(maxMessages, messages.length); i++) {
      const message = messages[i];
      if (message.mediaType === "conversation" || message.mediaType === "extendedTextMessage") {
        if (message.fromMe) {
          messagesDeepSeek.push({ role: "assistant", content: message.body });
        } else {
          messagesDeepSeek.push({ role: "user", content: message.body });
        }
      }
    }

    messagesDeepSeek.push({ role: "user", content: bodyMessage });

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepSeekSettings.apiKey}`
      },
      body: JSON.stringify({
        model: deepSeekSettings.model || "deepseek-chat",
        messages: messagesDeepSeek,
        max_tokens: deepSeekSettings.maxTokens || 1000,
        temperature: deepSeekSettings.temperature || 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Error DeepSeek API: ${response.statusText}`);
    }

    const data: DeepSeekResponse = await response.json();
    let aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      throw new Error("No response from DeepSeek");
    }

    if (aiResponse.includes("Acción: Transferir al sector de atención")) {
      await transferQueue(deepSeekSettings.queueId, ticket, contact);
      aiResponse = aiResponse.replace("Acción: Transferir al sector de atención", "").trim();
    }

    const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
      text: aiResponse
    });
    await verifyMessage(sentMessage!, ticket, contact);

  } catch (error) {
    console.error("Error con DeepSeek:", error);

    const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
      text: "Lo siento, hubo un error procesando tu mensaje. Por favor, intenta nuevamente."
    });
    await verifyMessage(sentMessage!, ticket, contact);
  }
};

export const transferQueue = async (
  queueId: number,
  ticket: Ticket,
  contact: Contact
): Promise<void> => {
  await UpdateTicketService({
    ticketData: { queueId: queueId },
    ticketId: ticket.id,
    companyId: ticket.companyId
  });
};

export const verifyMediaMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  ticketTraking: TicketTraking = null,
  isForwarded: boolean = false,
  isPrivate: boolean = false,
  wbot: Session = null
): Promise<Message> => {
  if (msg.message && "enc" in msg.message) {
    throw new Error("ERR_WAPP_ENCRYPTED_MEDIA");
  }
  if (msg.message?.protocolMessage && msg.message.protocolMessage.type !== 14) {
    throw new Error("ERR_WAPP_PROTOCOL_MESSAGE");
  }
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const media = await downloadMedia(msg);

  if (!media) {
    throw new Error("ERR_WAPP_DOWNLOAD_MEDIA");
  }

  if (!media.filename) {
    const ext = media.mimetype.split("/")[1].split(";")[0];
    media.filename = `${new Date().getTime()}.${ext}`;
  }

  try {
    const path = require("path");
    const fs = require("fs");
    const { writeFile } = require("fs").promises;

    const folder = path.join(__dirname, "..", "..", "..", "public", `company${ticket.companyId}`);

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
      fs.chmodSync(folder, 0o777);
    }

    const ext = path.extname(media.filename);

    const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const uniqueFilename = `${path.basename(media.filename, ext)}_${uniqueSuffix}${ext}`;
    media.filename = uniqueFilename;

    await writeFile(
      path.join(folder, uniqueFilename),
      media.data,
      "base64"
    );

  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }

  const body = getBodyMessage(msg);

  const hasCap = hasCaption(body, media.filename);
  const bodyMessage = body ? hasCap ? formatBody(body, ticket.contact) : "-" : "-";

  const messageData = {
    id: msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body: bodyMessage,
    fromMe: msg.key.fromMe,
    read: msg.key.fromMe,
    mediaUrl: media.filename,
    mediaType: media.mimetype.split("/")[0],
    detectedMediaType: detectMediaTypeFromMessage(msg),
    quotedMsgId: quotedMsg?.id,
    ack: getAckFromStatus(msg.status, msg.key?.fromMe),
    remoteJid: msg.key.remoteJid,
    participant: msg.key.participant,
    dataJson: JSON.stringify(msg),
    ticketTrakingId: ticketTraking?.id,
  };

  await ticket.update({
    lastMessage: body || "Archivo de medios"
  });

  const newMessage = await CreateMessageService({
    messageData,
    companyId: ticket.companyId
  });

  if (!msg.key.fromMe && ticket.status === "closed") {
    await ticket.update({ status: "pending" });
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Contact, as: "contact" }
      ]
    });

    io.to(`company-${ticket.companyId}-closed`)
      .to(`queue-${ticket.queueId}-closed`)
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "delete",
        ticket,
        ticketId: ticket.id
      });

    io.to(`company-${ticket.companyId}-${ticket.status}`)
      .to(`queue-${ticket.queueId}-${ticket.status}`)
      .to(ticket.id.toString())
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "update",
        ticket,
        ticketId: ticket.id
      });
  }

  return newMessage;
};

export const verifyMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact
) => {
  if (msg.message && "enc" in msg.message) {
    return;
  }
  if (msg.message?.protocolMessage && msg.message.protocolMessage.type !== 14) {
    return;
  }
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  let body = getBodyMessage(msg) || "";
  const isEdited = getTypeMessage(msg) == "editedMessage";

  const messageData = {
    id: isEdited
      ? msg?.message?.editedMessage?.message?.protocolMessage?.key?.id
      : msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body,
    fromMe: msg.key.fromMe,
    mediaType: getTypeMessage(msg),
    detectedMediaType: detectMediaTypeFromMessage(msg),
    read: msg.key.fromMe,
    quotedMsgId: quotedMsg?.id,
    ack: getAckFromStatus(msg.status, msg.key?.fromMe),
    remoteJid: msg.key.remoteJid,
    participant: msg.key.participant,
    dataJson: JSON.stringify(msg),
    isEdited: isEdited
  };

  await ticket.update({
    lastMessage: body
  });

  await CreateMessageService({ messageData, companyId: ticket.companyId });

  if (!msg.key.fromMe && ticket.status === "closed") {
    await ticket.update({ status: "pending" });
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Contact, as: "contact" }
      ]
    });

    io.to(`company-${ticket.companyId}-closed`)
      .to(`queue-${ticket.queueId}-closed`)
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "delete",
        ticket,
        ticketId: ticket.id
      });

    io.to(`company-${ticket.companyId}-${ticket.status}`)
      .to(`queue-${ticket.queueId}-${ticket.status}`)
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "update",
        ticket,
        ticketId: ticket.id
      });
  }
};

const isValidMsg = (msg: proto.IWebMessageInfo): boolean => {
  if (msg.key.remoteJid === "status@broadcast") return false;
  if (msg.message && "enc" in msg.message) return false;
  if (msg.message?.protocolMessage && msg.message.protocolMessage.type !== 14) {
    return false;
  }
  try {
    const msgType = getTypeMessage(msg);
    if (!msgType) {
      return;
    }

    const ifType =
      msgType === "conversation" ||
      msgType === "extendedTextMessage" ||
      msgType === "editedMessage" ||
      msgType === "audioMessage" ||
      msgType === "videoMessage" ||
      msgType === "imageMessage" ||
      msgType === "documentMessage" ||
      msgType === "documentWithCaptionMessage" ||
      msgType === "stickerMessage" ||
      msgType === "buttonsResponseMessage" ||
      msgType === "buttonsMessage" ||
      msgType === "messageContextInfo" ||
      msgType === "locationMessage" ||
      msgType === "liveLocationMessage" ||
      msgType === "contactMessage" ||
      msgType === "voiceMessage" ||
      msgType === "mediaMessage" ||
      msgType === "contactsArrayMessage" ||
      msgType === "reactionMessage" ||
      msgType === "ephemeralMessage" ||
      msgType === "protocolMessage" ||
      msgType === "listResponseMessage" ||
      msgType === "listMessage" ||
      msgType === "viewOnceMessage";

    if (!ifType) {
      logger.warn(`Tipo no reconocido en isValidMsg: ${msgType}`);
      Sentry.setExtra("Mensagem", { BodyMsg: msg.message, msg, msgType });
      Sentry.captureException(new Error("Novo Tipo de Mensagem em isValidMsg"));
    }

    return ifType;
  } catch (error) {
    Sentry.setExtra("Error isValidMsg", { msg });
    Sentry.captureException(error);
    return false;
  }
};

const Push = (msg: proto.IWebMessageInfo) => {
  return msg.pushName;
};

const verifyQueue = async (
  wbot: Session,
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  mediaSent?: Message | undefined
) => {

  const companyId = ticket.companyId;

  const { queues, greetingMessage, maxUseBotQueues, timeUseBotQueues } =
    await ShowWhatsAppService(wbot.id!, ticket.companyId);

  if (queues.length === 1) {
    const sendGreetingMessageOneQueues = await Setting.findOne({
      where: {
        key: "sendGreetingMessageOneQueues",
        companyId: ticket.companyId
      }
    });

    if (
      greetingMessage.length > 1 &&
      sendGreetingMessageOneQueues?.value === "enabled"
    ) {
      const body = formatBody(`${greetingMessage}`, contact);

      await wbot.sendMessage(
        `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
        {
          text: body
        }
      );
    }

    const firstQueue = head(queues);
    let chatbot = false;
    if (firstQueue?.options) {
      chatbot = firstQueue.options.length > 0;
    }

    if (
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !isNil(queues[0]?.integrationId)
    ) {
      const integrations = await ShowQueueIntegrationService(
        queues[0].integrationId,
        companyId
      );

      await handleMessageIntegration(
        msg,
        wbot,
        integrations,
        ticket,
        companyId,
        false,
        undefined,
        contact
      );

      await ticket.update({
        useIntegration: true,
        integrationId: integrations.id
      });
    }

    if (!msg.key.fromMe && !ticket.isGroup && !isNil(queues[0]?.promptId)) {
      await handleOpenAi(msg, wbot, ticket, contact, mediaSent);

      await ticket.update({
        useIntegration: true,
        promptId: queues[0]?.promptId
      });
    }

    await UpdateTicketService({
      ticketData: { queueId: firstQueue.id, chatbot, status: "pending" },
      ticketId: ticket.id,
      companyId: ticket.companyId
    });

    return;
  }

  const selectedOption = getBodyMessage(msg);
  console.log("Mensaje recibido del usuario:", selectedOption);
  console.log("Lista de filas disponibles:", queues.map((q, idx) => ({ index: idx + 1, name: q.name })));

  const choosenQueue = queues[+selectedOption - 1];
  console.log("Queue seleccionada:", choosenQueue ? choosenQueue.name : "Ninguna (input inválido)");

  const buttonActive = await Setting.findOne({
    where: {
      key: "chatBotType",
      companyId
    }
  });

  const botText = async () => {
    let options = "";

    queues.forEach((queue, index) => {
      options += `*[ ${index + 1} ]* - ${queue.name}\n`;
    });

    const textMessage = {
      text: formatBody(`\u200e${greetingMessage}\n\n${options}`, contact)
    };

    const sendMsg = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      textMessage
    );

    await verifyMessage(sendMsg, ticket, ticket.contact);
  };

  if (choosenQueue) {
    let chatbot = false;
    if (choosenQueue?.options) {
      chatbot = choosenQueue.options.length > 0;
    }
    console.log("Se va a asignar la fila:", {
      queueId: choosenQueue.id,
      chatbot,
      ticketId: ticket.id
    });
    await UpdateTicketService({
      ticketData: { queueId: choosenQueue.id, chatbot },
      ticketId: ticket.id,
      companyId: ticket.companyId
    });

    if (choosenQueue.options.length === 0) {
      const queue = await Queue.findByPk(choosenQueue.id);
      const { schedules }: any = queue;
      const now = moment();
      const weekday = now.format("dddd").toLowerCase();
      let schedule;
      if (Array.isArray(schedules) && schedules.length > 0) {
        schedule = schedules.find(
          s =>
            s.weekdayEn === weekday &&
            s.startTime !== "" &&
            s.startTime !== null &&
            s.endTime !== "" &&
            s.endTime !== null
        );
      }

      if (
        queue.outOfHoursMessage !== null &&
        queue.outOfHoursMessage !== "" &&
        !isNil(schedule)
      ) {
        const startTime = moment(schedule.startTime, "HH:mm");
        const endTime = moment(schedule.endTime, "HH:mm");

        if (now.isBefore(startTime) || now.isAfter(endTime)) {
          const body = formatBody(
            `\u200e ${queue.outOfHoursMessage}\n\n*[ # ]* - Voltar ao Menu Principal`,
            ticket.contact
          );
          const sentMessage = await wbot.sendMessage(
            `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
            {
              text: body
            }
          );
          await verifyMessage(sentMessage, ticket, contact);
          await UpdateTicketService({
            ticketData: { queueId: null, chatbot },
            ticketId: ticket.id,
            companyId: ticket.companyId
          });
          return;
        }
      }

      if (!msg.key.fromMe && !ticket.isGroup && choosenQueue.integrationId) {
        const integrations = await ShowQueueIntegrationService(
          choosenQueue.integrationId,
          companyId
        );

        await handleMessageIntegration(
          msg,
          wbot,
          integrations,
          ticket,
          companyId,
          false,
          undefined,
          contact
        );

        await ticket.update({
          useIntegration: true,
          integrationId: integrations.id
        });
      }

      if (
        !msg.key.fromMe &&
        !ticket.isGroup &&
        !isNil(choosenQueue?.promptId)
      ) {
        await handleOpenAi(msg, wbot, ticket, contact, mediaSent);

        await ticket.update({
          useIntegration: true,
          promptId: choosenQueue?.promptId
        });
      }

      const body = formatBody(
        `\u200e${choosenQueue.greetingMessage}`,
        ticket.contact
      );
      if (choosenQueue.greetingMessage) {
        const sentMessage = await wbot.sendMessage(
          `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          {
            text: body
          }
        );
        await verifyMessage(sentMessage, ticket, contact);
      }
    }
  } else {
    console.log("No se eligió una opción válida de fila. Se recibió:", selectedOption);
    console.log("Se ejecutará botText (menú de opciones por texto)");

    if (
      maxUseBotQueues &&
      maxUseBotQueues !== 0 &&
      ticket.amountUsedBotQueues >= maxUseBotQueues
    ) {
      return;
    }

    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId
    });
    let dataLimite = new Date();
    let Agora = new Date();

    if (ticketTraking.chatbotAt !== null) {
      dataLimite.setMinutes(
        ticketTraking.chatbotAt.getMinutes() + Number(timeUseBotQueues)
      );

      if (
        ticketTraking.chatbotAt !== null &&
        Agora < dataLimite &&
        timeUseBotQueues !== "0" &&
        ticket.amountUsedBotQueues !== 0
      ) {
        return;
      }
    }
    await ticketTraking.update({
      chatbotAt: null
    });

    if (buttonActive.value === "text") {
      return botText();
    }
  }
  console.log("Fila asignada en verifyQueue:", {
    queueId: ticket.queueId,
    integrationId: ticket.integrationId,
    useIntegration: ticket.useIntegration
  });
};

export const verifyRating = (ticketTraking: TicketTraking) => {
  if (
    ticketTraking &&
    ticketTraking.finishedAt === null &&
    ticketTraking.userId !== null &&
    ticketTraking.ratingAt !== null
  ) {
    return true;
  }
  return false;
};

export const handleRating = async (
  rate: number,
  ticket: Ticket,
  ticketTraking: TicketTraking
) => {
  const io = getIO();

  const { complationMessage } = await ShowWhatsAppService(
    ticket.whatsappId,
    ticket.companyId
  );

  let finalRate = rate;

  if (rate < 1) {
    finalRate = 1;
  }
  if (rate > 5) {
    finalRate = 5;
  }

  await UserRating.create({
    ticketId: ticketTraking.ticketId,
    companyId: ticketTraking.companyId,
    userId: ticketTraking.userId,
    rate: finalRate
  });

  if (complationMessage) {
    const body = formatBody(`\u200e${complationMessage}`, ticket.contact);
    await SendWhatsAppMessage({ body, ticket });
  }

  await ticketTraking.update({
    finishedAt: moment().toDate(),
    rated: true
  });

  await ticket.update({
    queueId: null,
    chatbot: null,
    queueOptionId: null,
    userId: null,
    status: "closed"
  });

  io.to(`company-${ticket.companyId}-open`)
    .to(`queue-${ticket.queueId}-open`)
    .emit(`company-${ticket.companyId}-ticket`, {
      action: "delete",
      ticket,
      ticketId: ticket.id
    });

  io.to(`company-${ticket.companyId}-${ticket.status}`)
    .to(`queue-${ticket.queueId}-${ticket.status}`)
    .to(ticket.id.toString())
    .emit(`company-${ticket.companyId}-ticket`, {
      action: "update",
      ticket,
      ticketId: ticket.id
    });
};

const handleChartbot = async (
  ticket: Ticket,
  msg: WAMessage,
  wbot: Session,
  dontReadTheFirstQuestion: boolean = false
) => {
  const queue = await Queue.findByPk(ticket.queueId, {
    include: [
      {
        model: QueueOption,
        as: "options",
        where: { parentId: null },
        order: [
          ["option", "ASC"],
          ["createdAt", "ASC"]
        ]
      }
    ]
  });

  const messageBody = getBodyMessage(msg);

  if (messageBody == "#") {
    await ticket.update({ queueOptionId: null, chatbot: false, queueId: null });
    await verifyQueue(wbot, msg, ticket, ticket.contact);
    return;
  }

  if (!isNil(queue) && !isNil(ticket.queueOptionId) && messageBody == "0") {
    const option = await QueueOption.findByPk(ticket.queueOptionId);
    await ticket.update({ queueOptionId: option?.parentId });

  } else if (!isNil(queue) && !isNil(ticket.queueOptionId)) {
    const count = await QueueOption.count({
      where: { parentId: ticket.queueOptionId }
    });
    let option: any = {};
    if (count == 1) {
      option = await QueueOption.findOne({
        where: { parentId: ticket.queueOptionId }
      });
    } else {
      option = await QueueOption.findOne({
        where: {
          option: messageBody || "",
          parentId: ticket.queueOptionId
        }
      });
    }
    if (option) {
      await ticket.update({ queueOptionId: option?.id });
    }

  } else if (
    !isNil(queue) &&
    isNil(ticket.queueOptionId) &&
    !dontReadTheFirstQuestion
  ) {
    const option = queue?.options.find(o => o.option == messageBody);
    if (option) {
      await ticket.update({ queueOptionId: option?.id });
    }
  }

  await ticket.reload({
    include: [
      { model: Queue, as: "queue" },
      { model: User, as: "user" },
      { model: Contact, as: "contact" }
    ]
  });
  console.log("QUEUE AFTER RELOAD:", ticket.queue);

  if (!isNil(queue) && isNil(ticket.queueOptionId)) {
    const queueOptions = await QueueOption.findAll({
      where: { queueId: ticket.queueId, parentId: null },
      order: [
        ["option", "ASC"],
        ["createdAt", "ASC"]
      ]
    });

    const companyId = ticket.companyId;

    const buttonActive = await Setting.findOne({
      where: {
        key: "chatBotType",
        companyId
      }
    });

    const botButton = async () => {
      const buttons = [];
      queueOptions.forEach((option, i) => {
        buttons.push({
          buttonId: `${option.option}`,
          buttonText: { displayText: option.title },
          type: 4
        });
      });
      buttons.push({
        buttonId: `#`,
        buttonText: { displayText: "Menu inicial *[ 0 ]* Menu anterior" },
        type: 4
      });

      const buttonMessage = {
        text: formatBody(`\u200e${queue.greetingMessage}`, ticket.contact),
        buttons,
        headerType: 4
      };

      const sendMsg = await wbot.sendMessage(
        `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
        }`,
        buttonMessage
      );

      await verifyMessage(sendMsg, ticket, ticket.contact);
    };

    const botText = async () => {
      let options = "";

      queueOptions.forEach((option, i) => {
        options += `*[ ${option.option} ]* - ${option.title}\n`;
      });
      options += `\n*[ # ]* - Menu inicial`;

      const textMessage = {
        text: formatBody(
          `\u200e${queue.greetingMessage}\n\n${options}`,
          ticket.contact
        )
      };

      const sendMsg = await wbot.sendMessage(
        `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
        }`,
        textMessage
      );

      await verifyMessage(sendMsg, ticket, ticket.contact);
    };

    if (buttonActive.value === "button" && QueueOption.length <= 4) {
      return botButton();
    }

    if (buttonActive.value === "text") {
      return botText();
    }

    if (buttonActive.value === "button" && QueueOption.length > 4) {
      return botText();
    }
  } else if (!isNil(queue) && !isNil(ticket.queueOptionId)) {
    const currentOption = await QueueOption.findByPk(ticket.queueOptionId);
    const queueOptions = await QueueOption.findAll({
      where: { parentId: ticket.queueOptionId },
      order: [
        ["option", "ASC"],
        ["createdAt", "ASC"]
      ]
    });

    if (queueOptions.length > -1) {
      const companyId = ticket.companyId;
      const buttonActive = await Setting.findOne({
        where: {
          key: "chatBotType",
          companyId
        }
      });

      const botList = async () => {
        const sectionsRows = [];

        queueOptions.forEach((option, i) => {
          sectionsRows.push({
            title: option.title,
            rowId: `${option.option}`
          });
        });
        sectionsRows.push({
          title: "Menu inicial *[ 0 ]* Menu anterior",
          rowId: `#`
        });
        const sections = [
          {
            rows: sectionsRows
          }
        ];

        const listMessage = {
          text: formatBody(`\u200e${currentOption.message}`, ticket.contact),
          buttonText: "Escolha uma opção",
          sections
        };

        const sendMsg = await wbot.sendMessage(
          `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
          }`,
          listMessage
        );

        await verifyMessage(sendMsg, ticket, ticket.contact);
      };

      const botButton = async () => {
        const buttons = [];
        queueOptions.forEach((option, i) => {
          buttons.push({
            buttonId: `${option.option}`,
            buttonText: { displayText: option.title },
            type: 4
          });
        });
        buttons.push({
          buttonId: `#`,
          buttonText: { displayText: "Menu inicial *[ 0 ]* Menu anterior" },
          type: 4
        });

        const buttonMessage = {
          text: formatBody(`\u200e${currentOption.message}`, ticket.contact),
          buttons,
          headerType: 4
        };

        const sendMsg = await wbot.sendMessage(
          `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
          }`,
          buttonMessage
        );

        await verifyMessage(sendMsg, ticket, ticket.contact);
      };

      const botText = async () => {
        let options = "";

        queueOptions.forEach((option, i) => {
          options += `*[ ${option.option} ]* - ${option.title}\n`;
        });
        options += `\n*[ 0 ]* - Menu anterior`;
        options += `\n*[ # ]* - Menu inicial`;
        const textMessage = {
          text: formatBody(
            `\u200e${currentOption.message}\n\n${options}`,
            ticket.contact
          )
        };

        const sendMsg = await wbot.sendMessage(
          `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
          }`,
          textMessage
        );

        await verifyMessage(sendMsg, ticket, ticket.contact);
      };

      if (buttonActive.value === "list") {
        return botList();
      }

      if (buttonActive.value === "button" && QueueOption.length <= 4) {
        return botButton();
      }

      if (buttonActive.value === "text") {
        return botText();
      }

      if (buttonActive.value === "button" && QueueOption.length > 4) {
        return botText();
      }
    }
  }
};

const flowbuilderIntegration = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number,
  queueIntegration: QueueIntegrations,
  ticket: Ticket,
  contact: Contact,
  isFirstMsg?: Ticket,
  isTranfered?: boolean
) => {
  if (msg.message && "enc" in msg.message) {
    return;
  }
  if (msg.message?.protocolMessage && msg.message.protocolMessage.type !== 14) {
    return;
  }
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const body = getBodyMessage(msg);

  if (!msg.key.fromMe && ticket.status === "closed") {

    console.log("===== CHANGE =====");
    await ticket.update({ status: "pending" });
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Contact, as: "contact" }
      ]
    });
    await UpdateTicketService({
      ticketData: { status: "pending", integrationId: ticket.integrationId },
      ticketId: ticket.id,
      companyId
    });

    io.of(String(companyId)).emit(`company-${companyId}-ticket`, {
      action: "delete",
      ticket,
      ticketId: ticket.id
    });

    io.to(ticket.status).emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket,
      ticketId: ticket.id
    });
  }

  if (msg.key.fromMe) {
    return;
  }

  const whatsapp = await ShowWhatsAppService(wbot.id!, companyId);

  const listPhrase = await FlowCampaignModel.findAll({
    where: {
      whatsappId: whatsapp.id
    }
  });

  if (
    !isFirstMsg &&
    listPhrase.filter(item => item.phrase && body && item.phrase.toLowerCase() === body.toLowerCase()).length === 0
  ) {
    const flow = await FlowBuilderModel.findOne({
      where: {
        id: whatsapp.flowIdWelcome
      }
    });
    if (flow) {
      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      const mountDataContact = {
        number: contact.number,
        name: contact.name,
        email: contact.email
      };
      console.log("LLAMADA 2 - LINEA 1825");
      await ActionsWebhookService(
        whatsapp.id,
        whatsapp.flowIdWelcome,
        ticket.companyId,
        nodes,
        connections,
        flow.flow["nodes"][0].id,
        ticket.dataWebhook || {},
        "",
        "",
        null,
        ticket.id,
        mountDataContact,
        msg
      );
    }
  }

  const dateTicket = new Date(
    isFirstMsg?.updatedAt ? isFirstMsg.updatedAt : ""
  );

  const dateNow = new Date();
  const diferencaEmMilissegundos = Math.abs(
    differenceInMilliseconds(dateTicket, dateNow)
  );
  const seisHorasEmMilissegundos = 0;

  if (
    listPhrase.filter(item => item.phrase && body && item.phrase.toLowerCase() === body.toLowerCase()).length === 0 &&
    diferencaEmMilissegundos >= seisHorasEmMilissegundos &&
    isFirstMsg
  ) {
    const flow = await FlowBuilderModel.findOne({
      where: {
        id: whatsapp.flowIdNotPhrase
      }
    });

    if (flow) {
      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      const mountDataContact = {
        number: contact.number,
        name: contact.name,
        email: contact.email
      };
      console.log("LLAMADA 2 - LINEA 1880");
      await ActionsWebhookService(
        whatsapp.id,
        whatsapp.flowIdNotPhrase,
        ticket.companyId,
        nodes,
        connections,
        flow.flow["nodes"][0].id,
        ticket.dataWebhook || {},
        "",
        "",
        null,
        ticket.id,
        mountDataContact,
        msg
      );
    }
  }

  if (listPhrase.some(item => item.phrase === "*" || (item.phrase && body && item.phrase.toLowerCase() === body.toLowerCase()))) {

    const flowDispar = listPhrase.find(item => item.phrase === "*" || (item.phrase && body && item.phrase.toLowerCase() === body.toLowerCase()));
    const flow = await FlowBuilderModel.findOne({
      where: {
        id: flowDispar.flowId
      }
    });
    const nodes: INodes[] = flow.flow["nodes"];
    const connections: IConnections[] = flow.flow["connections"];

    const mountDataContact = {
      number: contact.number,
      name: contact.name,
      email: contact.email
    };
    console.log("LLAMADA 2 - LINEA 1918");
    if (!ticket.flowWebhook && ticket.flowStopped !== "0") {
      console.log("LLAMADA 2 - Iniciando nuevo flujo desde campaign");
      await ActionsWebhookService(
        whatsapp.id,
        flowDispar.flowId,
        ticket.companyId,
        nodes,
        connections,
        flow.flow["nodes"][0].id,
        ticket.dataWebhook || {},
        "",
        "",
        null,
        ticket.id,
        mountDataContact,
        msg
      );
    } else {
      console.log("Flujo ya activo o completado, no ejecutar desde campaign");
      console.log("Estado:", {
        flowWebhook: ticket.flowWebhook,
        flowStopped: ticket.flowStopped,
        lastFlowId: ticket.lastFlowId
      });
    }
    return;
  }

  if (ticket.flowWebhook && ticket.flowStopped !== "0") {
    const webhook = await WebhookModel.findOne({
      where: {
        company_id: ticket.companyId,
        hash_id: ticket.hashFlowId
      }
    });

    if (webhook && webhook.config["details"]) {
    } else {
      const flow = await FlowBuilderModel.findOne({
        where: {
          id: ticket.flowStopped
        }
      });

      if (!flow) {
        console.log("No se encontró el flujo con ID:", ticket.flowStopped);
        return;
      }

      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      if (!ticket.lastFlowId) {
        return;
      }

      const mountDataContact = {
        number: contact.number,
        name: contact.name,
        email: contact.email
      };

      console.log("LLAMADA 2 - Continuando flujo existente");
      await ActionsWebhookService(
        whatsapp.id,
        parseInt(ticket.flowStopped),
        ticket.companyId,
        nodes,
        connections,
        ticket.lastFlowId,
        null,
        "",
        "",
        body,
        ticket.id,
        mountDataContact,
        msg
      );
    }
  } else if (ticket.flowStopped === "0") {
    console.log("Flujo ya completado, no ejecutar ActionsWebhookService");
    return;
  }
};

export const handleMessageIntegration = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  queueIntegration: QueueIntegrations,
  ticket: Ticket,
  companyId: number,
  isMenu: boolean = null,
  whatsapp: Whatsapp = null,
  contact: Contact = null,
  isFirstMsg: Ticket | null = null,
): Promise<void> => {
  if (msg.message && "enc" in msg.message) {
    return;
  }
  if (msg.message?.protocolMessage && msg.message.protocolMessage.type !== 14) {
    return;
  }
  console.log("handleMessageIntegration llamado - Tipo:", queueIntegration?.type);
  console.log("Ticket state:", {
    id: ticket.id,
    flowWebhook: ticket.flowWebhook,
    lastFlowId: ticket.lastFlowId,
    flowStopped: ticket.flowStopped
  });
  const msgType = getTypeMessage(msg);

  if (queueIntegration.type === "n8n" || queueIntegration.type === "webhook") {
    if (queueIntegration?.urlN8N) {
      const options = {
        method: "POST",
        url: queueIntegration?.urlN8N,
        headers: {
          "Content-Type": "application/json"
        },
        json: msg
      };
      try {
        request(options, function (error, response) {
          if (error) {
            throw new Error(error);
          } else {
            console.log("1234", response.body);
          }
        });
      } catch (error) {
        throw new Error(error);
      }
    }
  } else if (queueIntegration.type === "typebot") {
    console.log("entrou no typebot");
    await typebotListener({ ticket, msg, wbot, typebot: queueIntegration });
  } else if (queueIntegration.type === "flowbuilder") {
    if (!isMenu) {

      await flowbuilderIntegration(
        msg,
        wbot,
        companyId,
        queueIntegration,
        ticket,
        contact,
        isFirstMsg
      );
    } else {

      if (
        !isNaN(parseInt(ticket.lastMessage)) &&
        ticket.status !== "open" &&
        ticket.status !== "closed"
      ) {
        await flowBuilderQueue(
          ticket,
          msg,
          wbot,
          whatsapp,
          companyId,
          contact,
          isFirstMsg
        );
      }
    }
  }
};

const flowBuilderQueue = async (
  ticket: Ticket,
  msg: proto.IWebMessageInfo,
  wbot: Session,
  whatsapp: Whatsapp,
  companyId: number,
  contact: Contact,
  isFirstMsg: Ticket
) => {
  const body = getBodyMessage(msg);

  const flow = await FlowBuilderModel.findOne({
    where: {
      id: ticket.flowStopped
    }
  });

  const mountDataContact = {
    number: contact.number,
    name: contact.name,
    email: contact.email
  };

  const nodes: INodes[] = flow.flow["nodes"];
  const connections: IConnections[] = flow.flow["connections"];

  if (!ticket.lastFlowId) {
    return;
  }

  if (
    ticket.status === "closed" ||
    ticket.status === "interrupted" ||
    ticket.status === "open"
  ) {
    return;
  }
  console.log("LLAMADA 2 - LINEA 2122");
  await ActionsWebhookService(
    whatsapp.id,
    parseInt(ticket.flowStopped),
    ticket.companyId,
    nodes,
    connections,
    ticket.lastFlowId,
    null,
    "",
    "",
    body,
    ticket.id,
    mountDataContact,
    msg
  );
};

let isFirstMsg: Ticket | null = null;
const handleMessage = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number
): Promise<void> => {
  if (debugEncryptedMessage(msg, 'handleMessage')) {
    return;
  }

  // Verificar mensajes eliminados ANTES de otras validaciones
  // Los mensajes eliminados tienen protocolMessage.type === 0 (número)
  // También pueden venir con messageStubType === REVOKE
  // Nota: En algunos casos el type puede venir como string "REVOKE" en el JSON serializado
  const protocolType = msg.message?.protocolMessage?.type;
  const isRevokeMessage = 
    protocolType === 0 || 
    (typeof protocolType === 'string' && protocolType === "REVOKE") ||
    msg.messageStubType === WAMessageStubType.REVOKE;
  
  if (isRevokeMessage) {
    console.log("🔍 [DELETE] Mensaje eliminado detectado:", {
      protocolType: msg.message?.protocolMessage?.type,
      messageStubType: msg.messageStubType,
      key: msg.message?.protocolMessage?.key
    });
    
    const deletedMsgId = msg.message?.protocolMessage?.key?.id;
    
    if (!deletedMsgId) {
      console.log("⚠️ [DELETE] No se encontró el ID del mensaje eliminado en protocolMessage.key.id");
      return;
    }
    
    console.log("🔍 [DELETE] Buscando mensaje con ID:", deletedMsgId);
    
    const deletedMsg = await Message.findOne({
      where: { id: deletedMsgId },
      include: [
        "contact",
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        }
      ]
    });

    if (deletedMsg) {
      console.log("✅ [DELETE] Mensaje encontrado en BD:", {
        id: deletedMsg.id,
        body: deletedMsg.body,
        ticketId: deletedMsg.ticketId
      });
      // Preservar el body original si existe, de lo contrario usar el mensaje por defecto
      const originalBody = deletedMsg.body && deletedMsg.body.trim() !== "" ? deletedMsg.body : "*Este mensaje fue eliminado*";
      
      await deletedMsg.update({
        body: originalBody,
        isDeleted: true
      });

      // Recargar el mensaje actualizado con todas sus relaciones
      await deletedMsg.reload({
        include: [
          "contact",
          {
            model: Message,
            as: "quotedMsg",
            include: ["contact"]
          }
        ]
      });

      // Obtener el ticket para saber el companyId
      const ticket = await Ticket.findByPk(deletedMsg.ticketId);
      
      if (ticket) {
        // Emitir evento de socket para notificar al frontend
        const io = getIO();
        io.to(String(deletedMsg.ticketId))
          .emit(`company-${ticket.companyId}-appMessage`, {
            action: "update",
            message: deletedMsg
          });
        
        console.log("✅ Mensaje marcado como eliminado y notificado al frontend:", deletedMsgId);
      } else {
        console.log("⚠️ Mensaje marcado como eliminado pero no se encontró el ticket:", deletedMsgId);
      }
    } else {
      console.log("⚠️ No se encontró el mensaje a eliminar:", deletedMsgId);
    }

    return;
  }

  // Validaciones para otros tipos de mensajes (después de manejar mensajes eliminados)
  if (msg.message?.protocolMessage && msg.message.protocolMessage.type !== 14) {
    return;
  }
  const messageId = msg.key.id || 'sin-id';
  let mediaSent: Message | undefined;

  if (msg.message && "enc" in msg.message) {
    return;
  }
  if (msg.message?.protocolMessage && msg.message.protocolMessage.type !== 14) {
    return;
  }
  if (msg.message && "enc" in msg.message) {
    return;
  }
  if (msg.message?.protocolMessage && msg.message.protocolMessage.type !== 14) {
    return;
  }

  if (!isValidMsg(msg)) return;

  try {
    let msgContact: IMe;
    let groupContact: Contact | undefined;

    const normalizedJid = normalizeLidJid(msg);
    const isGroup = normalizedJid?.endsWith("@g.us");

    const msgIsGroupBlock = await Setting.findOne({
      where: {
        companyId,
        key: "CheckMsgIsGroup"
      }
    });

    const bodyMessage = getBodyMessage(msg);
    const msgType = getTypeMessage(msg);
    const detectedMediaType = detectMediaTypeFromMessage(msg);
    console.log("Tipo de mensaje detectado automáticamente:", detectedMediaType);
    const hasMedia =
      msg.message?.audioMessage ||
      msg.message?.imageMessage ||
      msg.message?.videoMessage ||
      msg.message?.documentMessage ||
      msg.message?.documentWithCaptionMessage ||
      msg.message.stickerMessage;
    if (msg.key.fromMe) {
      if (/\u200e/.test(bodyMessage)) return;

      if (
        !hasMedia &&
        msgType !== "conversation" &&
        msgType !== "extendedTextMessage" &&
        msgType !== "vcard"
      )
        return;
      msgContact = await getContactMessage(msg, wbot);
    } else {
      msgContact = await getContactMessage(msg, wbot);
    }

    if (msgIsGroupBlock?.value === "enabled" && isGroup) return;

    if (isGroup) {
      const grupoMeta = await wbot.groupMetadata(msg.key.remoteJid);
      const msgGroupContact = {
        id: grupoMeta.id,
        name: grupoMeta.subject
      };
      groupContact = await verifyContact(msgGroupContact, wbot, companyId);
    }

    const whatsapp = await ShowWhatsAppService(wbot.id!, companyId);
    const contact = await verifyContact(msgContact, wbot, companyId);

    // Si el contacto es un LID, buscar si existe un contacto con ese número LID
    // o si existe un contacto relacionado que pueda ser el mismo
    if (contact.number.includes('@lid') || msgContact.id?.endsWith('@lid')) {
      const lidNumber = contact.number.replace('@lid', '').replace(/\D/g, '');
      
      // PRIMERO: Buscar contacto con el número LID
      let existingContact = await Contact.findOne({
        where: { 
          number: lidNumber,
          companyId 
        },
        order: [['updatedAt', 'DESC']] // El más reciente primero
      });
      
      // SEGUNDO: Si no se encuentra, buscar contactos relacionados recientemente
      // (contactos creados en los últimos 5 minutos que puedan estar relacionados)
      if (!existingContact) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        // Buscar contactos creados recientemente con el mismo nombre o similares
        const recentContacts = await Contact.findAll({
          where: {
            companyId,
            createdAt: {
              [Op.gte]: fiveMinutesAgo
            },
            name: {
              [Op.like]: `%${contact.name}%`
            }
          },
          order: [['createdAt', 'DESC']],
          limit: 5
        });
        
        if (recentContacts.length > 0) {
          // Usar el contacto más reciente que no sea un LID
          existingContact = recentContacts.find(c => !c.number.includes('@lid') && c.number !== lidNumber) || recentContacts[0];
          console.log(`✅ Contacto relacionado encontrado recientemente: ${existingContact.number}`);
        }
      }
      
      // TERCERO: Intentar obtener el número real del mensaje si está disponible
      if (!existingContact) {
        const msgWithAny = msg as any;
        if (msgWithAny.key?.senderPn) {
          const realNumber = msgWithAny.key.senderPn.replace('@s.whatsapp.net', '').replace(/\D/g, '');
          existingContact = await Contact.findOne({
            where: { 
              number: realNumber,
              companyId 
            }
          });
          
          if (existingContact) {
            console.log(`✅ Contacto encontrado por número real (LID): ${existingContact.number}`);
          }
        }
      }
      
      if (existingContact) {
        console.log(`✅ Usando contacto existente en lugar de LID: ${existingContact.number}`);
        
        // Si el contacto existente tiene un número real (no LID), actualizar el contacto LID
        if (existingContact.number !== lidNumber && !existingContact.number.includes('@lid')) {
          // Actualizar el contacto LID para que use el número real
          await contact.update({ 
            number: existingContact.number,
            name: contact.name !== 'Contacto WhatsApp' && contact.name !== 'Contacto LinkedIn' ? contact.name : existingContact.name
          });
          contact.number = existingContact.number;
        }
        
        Object.assign(contact, existingContact);
      } else {
        // Si no se encuentra, actualizar el contacto LID para que no tenga @lid en el número
        if (contact.number.includes('@lid')) {
          const cleanLidNumber = contact.number.replace('@lid', '').replace(/\D/g, '');
          await contact.update({ number: cleanLidNumber });
          contact.number = cleanLidNumber;
        }
      }
    }

    let unreadMessages = 0;

    if (msg.key.fromMe) {
      await cacheLayer.set(`contacts:${contact.id}:unreads`, "0");
    } else {
      const unreads = await cacheLayer.get(`contacts:${contact.id}:unreads`);
      unreadMessages = +unreads + 1;
      await cacheLayer.set(
        `contacts:${contact.id}:unreads`,
        `${unreadMessages}`
      );
    }

    const lastMessage = await Message.findOne({
      where: {
        contactId: contact.id,
        companyId
      },
      order: [["createdAt", "DESC"]]
    });

    if (
      unreadMessages === 0 &&
      whatsapp.complationMessage &&
      formatBody(whatsapp.complationMessage, contact).trim().toLowerCase() ===
      lastMessage?.body.trim().toLowerCase()
    ) {
      return;
    }

    const ticket = await FindOrCreateTicketService(
      contact,
      wbot.id!,
      unreadMessages,
      companyId,
      groupContact
    );
    console.log(`TICKET ${ticket.id} | Contacto: ${contact.name} (${contact.number}) | Tipo: ${detectedMediaType} | Estado: ${ticket.status}`);
    if (msg.key.fromMe && ticket?.flowWebhook) {
      console.log('Mensaje del bot, ignorando procesamiento de flujo');
      return;
    }

    if (!ticket) {
      console.log("Ticket nulo (grupo bloqueado por configuración).");
      return;
    }
    if (ticket.unreadMessages !== unreadMessages) {
      await ticket.update({ unreadMessages });
    }
    await provider(ticket, msg, companyId, contact, wbot as WASocket);

    if (bodyMessage == "#") {
      await ticket.update({
        queueOptionId: null,
        chatbot: false,
        queueId: null
      });
      await verifyQueue(wbot, msg, ticket, ticket.contact);
      return;
    }

    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId,
      whatsappId: whatsapp?.id
    });

    try {
      if (!msg.key.fromMe) {

        if (ticketTraking !== null && verifyRating(ticketTraking)) {
          handleRating(parseFloat(bodyMessage), ticket, ticketTraking);
          return;
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log("e1222: ", e);
    }

    try {
      await ticket.update({
        fromMe: msg.key.fromMe
      });
    } catch (e) {
      Sentry.captureException(e);
      console.log("e1232: ", e);
    }

    if (hasMedia) {
      mediaSent = await verifyMediaMessage(msg, ticket, contact);
    } else {
      await verifyMessage(msg, ticket, contact);
    }

    const currentSchedule = await VerifyCurrentSchedule(companyId);
    const scheduleType = await Setting.findOne({
      where: {
        companyId,
        key: "scheduleType"
      }
    });

    try {
      if (!msg.key.fromMe && scheduleType) {
        if (
          scheduleType.value === "company" &&
          !isNil(currentSchedule) &&
          (!currentSchedule || currentSchedule.inActivity === false)
        ) {
          const body = `\u200e ${whatsapp.outOfHoursMessage}`;

          const debouncedSentMessage = debounce(
            async () => {
              await wbot.sendMessage(
                `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
                }`,
                {
                  text: body
                }
              );
            },
            3000,
            ticket.id
          );
          debouncedSentMessage();
          return;
        }

        if (scheduleType.value === "queue" && ticket.queueId !== null) {
          const queue = await Queue.findByPk(ticket.queueId);

          const { schedules }: any = queue;
          const now = moment();
          const weekday = now.format("dddd").toLowerCase();
          let schedule = null;

          if (Array.isArray(schedules) && schedules.length > 0) {
            schedule = schedules.find(
              s =>
                s.weekdayEn === weekday &&
                s.startTime !== "" &&
                s.startTime !== null &&
                s.endTime !== "" &&
                s.endTime !== null
            );
          }

          if (
            scheduleType.value === "queue" &&
            queue.outOfHoursMessage !== null &&
            queue.outOfHoursMessage !== "" &&
            !isNil(schedule)
          ) {
            const startTime = moment(schedule.startTime, "HH:mm");
            const endTime = moment(schedule.endTime, "HH:mm");

            if (now.isBefore(startTime) || now.isAfter(endTime)) {
              const body = `${queue.outOfHoursMessage}`;
              const debouncedSentMessage = debounce(
                async () => {
                  await wbot.sendMessage(
                    `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
                    }`,
                    {
                      text: body
                    }
                  );
                },
                3000,
                ticket.id
              );
              debouncedSentMessage();
              return;
            }
          }
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log("e1246: ", e);
    }

    const flow = await FlowBuilderModel.findOne({
      where: {
        id: ticket.flowStopped
      }
    });

    const dataWebhook = ticket.dataWebhook || {};

    let isMenu = false;
    let isOpenai = false;
    let isQuestion = false;
    let nodeSelected: any = null;

    if (flow) {
      nodeSelected = flow.flow["nodes"].find((node: any) => node.id === ticket.lastFlowId);
      isMenu = nodeSelected?.type === "menu";
      isOpenai = nodeSelected?.type === "openai";
      isQuestion = nodeSelected?.type === "question";
    }

    if (flow) {
      isMenu =
        flow.flow["nodes"].find((node: any) => node.id === ticket.lastFlowId)
          ?.type === "menu";
      isOpenai =
        flow.flow["nodes"].find((node: any) => node.id === ticket.lastFlowId)
          ?.type === "openai";
      isQuestion =
        flow.flow["nodes"].find((node: any) => node.id === ticket.lastFlowId)
          ?.type === "question";
    }

    if (ticket.flowWebhook === false &&
      !ticket.lastFlowId &&
      ticket.flowStopped) {
      console.log("BLOQUEO ACTIVADO: Flujo ya finalizado, ignorando mensaje del usuario");
      console.log("Estado del ticket:", {
        flowWebhook: ticket.flowWebhook,
        lastFlowId: ticket.lastFlowId,
        flowStopped: ticket.flowStopped,
        useIntegration: ticket.useIntegration
      });
      await ticket.update({
        status: "closed",
        useIntegration: false,
        flowWebhook: false,
        flowStopped: null,
        lastFlowId: null,
        dataWebhook: {}
      });
      return;
    }
    if (!isNil(flow) && isQuestion && !msg.key.fromMe) {
      const body = getBodyMessage(msg);
      const mediaType = detectMediaTypeFromMessage(msg);

      if (body || mediaType !== "text") {
        const nodes: INodes[] = flow.flow["nodes"];
        const connections: IConnections[] = flow.flow["connections"];
        const nodeSelected = nodes.find(node => node.id === ticket.lastFlowId);
        const typebotData = nodeSelected?.data?.typebotIntegration as unknown as IOpenAi;
        const answerKey = typebotData?.answerKey || "";

        console.log("RESPUESTA RECIBIDA EN QUESTION:");
        console.log("Mensaje del usuario:", body);
        console.log("Tipo de medio detectado:", mediaType);
        console.log("Clave para guardar:", answerKey);

        const currentDataWebhook = ticket.dataWebhook as any || {};
        let responseValue = body;

        if (mediaType === "image") {
          try {
            const mediaUrl = await saveMediaFromMessage(msg, ticket.companyId);
            const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
            const fullImageUrl = `${backendUrl}/${mediaUrl}`;

            responseValue = fullImageUrl;
            console.log("Imagen guardada con URL completa:", fullImageUrl);
          } catch (error) {
            console.error("Error guardando imagen:", error);
            responseValue = "image";
          }
        }
        else if (mediaType !== "text") {
          responseValue = mediaType;
        }

        const dataWebhook = {
          ...currentDataWebhook,
          variables: {
            ...(currentDataWebhook.variables || {}),
            [answerKey]: responseValue,
            [`${answerKey}_type`]: mediaType
          }
        };

        console.log("Nuevo dataWebhook:", dataWebhook);

        await ticket.update({
          dataWebhook: dataWebhook
        });

        const nextConnection = connections.find(c => c.source === nodeSelected.id);
        console.log("Conexión siguiente:", nextConnection);

        if (!nextConnection) {
          console.log("No hay conexión desde el nodo question");
          return;
        }

        const nextNode = nodes.find(n => n.id === nextConnection.target);
        console.log("Nodo siguiente:", nextNode?.type, nextNode?.id);

        if (!nextNode) {
          console.log("No se encontró el nodo siguiente");
          return;
        }

        await ticket.update({
          lastFlowId: nextNode.id,
          dataWebhook: dataWebhook
        });

        console.log("Ticket actualizado:", {
          lastFlowId: nextNode.id,
          dataWebhookVariables: dataWebhook.variables
        });

        const mountDataContact = {
          number: contact.number,
          name: contact.name,
          email: contact.email
        };

        console.log("LLAMADA 1 - Desde nodo question");
        await ActionsWebhookService(
          whatsapp.id,
          parseInt(ticket.flowStopped),
          ticket.companyId,
          nodes,
          connections,
          nextNode.id,
          dataWebhook,
          "",
          "",
          "",
          ticket.id,
          mountDataContact,
          msg
        );
      }
    }

    if ((isOpenai || nodeSelected?.type === "deepseek") && !isNil(flow) && !ticket.queue) {
      const nodeSelected = flow.flow["nodes"].find(
        (node: any) => node.id === ticket.lastFlowId
      );

      if (nodeSelected.type === "deepseek") {
        const {
          name,
          prompt,
          apiKey,
          maxTokens,
          temperature,
          queueId,
          maxMessages,
          model = "deepseek-chat"
        } = nodeSelected.data.typebotIntegration;

        const deepSeekSettings: IDeepSeek = {
          name,
          prompt,
          apiKey,
          maxTokens,
          temperature,
          model,
          queueId,
          maxMessages
        };

        await handleDeepSeek(
          msg,
          wbot,
          ticket,
          contact,
          deepSeekSettings
        );
      } else {
        let {
          name,
          prompt,
          voice,
          voiceKey,
          voiceRegion,
          maxTokens,
          temperature,
          apiKey,
          queueId,
          maxMessages
        } = nodeSelected.data.typebotIntegration as IOpenAi;

        let aiSettings = {
          name,
          prompt,
          voice,
          voiceKey,
          voiceRegion,
          apiKey,
          maxTokens,
          temperature,
          queueId,
          maxMessages
        };

        await handleOpenAi(
          msg,
          wbot,
          ticket,
          contact,
          mediaSent,
          ticketTraking,
          aiSettings,
        );
      }

      return;
    }
    if (!isNil(flow) && !ticket.queue) {
      const nodeSelected = flow.flow["nodes"].find(
        (node: any) => node.id === ticket.lastFlowId
      );

    }

    if (
      !ticket.queue &&
      !isGroup &&
      !msg.key.fromMe &&
      !ticket.userId &&
      !isNil(whatsapp.promptId)
    ) {
      await handleOpenAi(msg, wbot, ticket, contact, mediaSent);
    }

    if (
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.queue &&
      !ticket.user &&
      ticket.chatbot &&
      !isNil(whatsapp.integrationId) &&
      !ticket.useIntegration
    ) {

      const integrations = await ShowQueueIntegrationService(
        whatsapp.integrationId,
        companyId
      );

      await handleMessageIntegration(
        msg,
        wbot,
        integrations,
        ticket,
        companyId,
        isMenu,
        whatsapp,
        contact,
        isFirstMsg
      );


      return;
    }

    if (
      !isGroup &&
      !msg.key.fromMe &&
      !ticket.userId &&
      !isNil(ticket.promptId) &&
      ticket.useIntegration &&
      ticket.queueId
    ) {
      await handleOpenAi(msg, wbot, ticket, contact, mediaSent);
    }


    await ticket.reload({
      include: [
        { model: Queue, as: "queue" }
      ]
    });

    if (ticket.useIntegration && ticket.integrationId === null && ticket.queue?.integrationId) {
      await ticket.update({
        integrationId: ticket.queue.integrationId
      });
      await ticket.reload({
        include: [
          { model: Queue, as: "queue" }
        ]
      });
      console.log("Integración corregida:", ticket.integrationId);
    }

    if (
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.userId &&
      ticket.integrationId &&
      ticket.useIntegration &&
      ticket.queue
    ) {
      const integrations = await ShowQueueIntegrationService(
        ticket.integrationId,
        companyId
      );

      isFirstMsg = await Ticket.findOne({
        where: {
          contactId: groupContact ? groupContact.id : contact.id,
          companyId,
          whatsappId: whatsapp.id
        },
        order: [["id", "DESC"]]
      });
      logger.info(`INTERACCION CON BOT - TICKET: ${isFirstMsg.id}`);
      await handleMessageIntegration(
        msg,
        wbot,
        integrations,
        ticket,
        companyId,
        isMenu,
        whatsapp,
        contact,
        isFirstMsg
      );
    }

    if (
      !ticket.queue &&
      !ticket.isGroup &&
      !msg.key.fromMe &&
      !ticket.userId &&
      whatsapp.queues.length >= 1 &&
      !ticket.useIntegration
    ) {
      await verifyQueue(wbot, msg, ticket, contact);

      if (ticketTraking && ticketTraking.chatbotAt === null) {
        await ticketTraking.update({
          chatbotAt: moment().toDate()
        });
      }

      await ticket.reload({
        include: [
          { model: Queue, as: "queue" }
        ]
      });

      if (ticket.queue &&
        ticket.queue.integrationId &&
        !ticket.useIntegration) {
        console.log("ENTRO AL BOT (nuevo ticket con integración después de verifyQueue)");

        const integrations = await ShowQueueIntegrationService(
          ticket.queue.integrationId,
          companyId
        );

        await ticket.update({
          useIntegration: true,
          integrationId: integrations.id
        });

        isFirstMsg = await Ticket.findOne({
          where: {
            contactId: contact.id,
            companyId,
            whatsappId: whatsapp.id
          },
          order: [["id", "DESC"]]
        });

        await handleMessageIntegration(
          msg,
          wbot,
          integrations,
          ticket,
          companyId,
          isMenu,
          whatsapp,
          contact,
          isFirstMsg
        );
        return;
      }
    }

    isFirstMsg = await Ticket.findOne({
      where: {
        contactId: groupContact ? groupContact.id : contact.id,
        companyId,
        whatsappId: whatsapp.id
      },
      order: [["id", "DESC"]]
    });

    if (ticket.flowWebhook === false || ticket.flowStopped === "0") {
      console.log("Flujo completamente finalizado");
      return;
    }

    if (
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.queue &&
      !ticket.user &&
      !isNil(whatsapp.integrationId) &&
      !ticket.useIntegration
    ) {

      const integrations = await ShowQueueIntegrationService(
        whatsapp.integrationId,
        companyId
      );

      await handleMessageIntegration(
        msg,
        wbot,
        integrations,
        ticket,
        companyId,
        isMenu,
        whatsapp,
        contact,
        isFirstMsg
      );
    }

    const dontReadTheFirstQuestion = ticket.queue === null;

    await ticket.reload();

    try {
      if (!msg.key.fromMe && scheduleType && ticket.queueId !== null) {
        const queue = await Queue.findByPk(ticket.queueId);

        const { schedules }: any = queue;
        const now = moment();
        const weekday = now.format("dddd").toLowerCase();
        let schedule = null;

        if (Array.isArray(schedules) && schedules.length > 0) {
          schedule = schedules.find(
            s =>
              s.weekdayEn === weekday &&
              s.startTime !== "" &&
              s.startTime !== null &&
              s.endTime !== "" &&
              s.endTime !== null
          );
        }

        if (
          scheduleType.value === "queue" &&
          queue.outOfHoursMessage !== null &&
          queue.outOfHoursMessage !== "" &&
          !isNil(schedule)
        ) {
          const startTime = moment(schedule.startTime, "HH:mm");
          const endTime = moment(schedule.endTime, "HH:mm");

          if (now.isBefore(startTime) || now.isAfter(endTime)) {
            const body = queue.outOfHoursMessage;
            const debouncedSentMessage = debounce(
              async () => {
                await wbot.sendMessage(
                  `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
                  }`,
                  {
                    text: body
                  }
                );
              },
              3000,
              ticket.id
            );
            debouncedSentMessage();
            return;
          }
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log("e1438: ", e);
    }

    if (
      !whatsapp?.queues?.length &&
      !ticket.userId &&
      !isGroup &&
      !msg.key.fromMe
    ) {
      const lastMessage = await Message.findOne({
        where: {
          ticketId: ticket.id,
          fromMe: true
        },
        order: [["createdAt", "DESC"]]
      });

      if (lastMessage && lastMessage.body.includes(whatsapp.greetingMessage)) {
        return;
      }

      if (whatsapp.greetingMessage) {
        const debouncedSentMessage = debounce(
          async () => {
            await wbot.sendMessage(
              `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
              }`,
              {
                text: whatsapp.greetingMessage
              }
            );
          },
          1000,
          ticket.id
        );
        debouncedSentMessage();
        return;
      }
    }

    if (whatsapp.queues.length == 1 && ticket.queue) {
      if (ticket.chatbot && !msg.key.fromMe) {
        await handleChartbot(ticket, msg as any, wbot);
      }
    }

    if (whatsapp.queues.length > 1 && ticket.queue) {
      if (ticket.chatbot && !msg.key.fromMe) {
        await handleChartbot(ticket, msg as any, wbot, dontReadTheFirstQuestion);
      }
    }

  } catch (err) {
    console.log("e17645: ", err);
    Sentry.captureException(err);
    logger.error(`Error handling whatsapp message: Err: ${err}`);
  }
};

const findNextInteractiveNode = (
  currentNodeId: string,
  nodes: INodes[],
  connections: IConnections[]
): { nextNode: INodes | null; nextNodeId: string | null } => {
  const connection = connections.find(c => c.source === currentNodeId);
  if (!connection) return { nextNode: null, nextNodeId: null };

  const nextNode = nodes.find(n => n.id === connection.target);
  return { nextNode, nextNodeId: connection.target };
};

const handleMsgAck = async (
  msg: WAMessage,
  chat: number | null | undefined
) => {
  await new Promise(r => setTimeout(r, 500));
  const io = getIO();

  try {
    const messageToUpdate = await Message.findByPk(msg.key.id, {
      include: [
        "contact",
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        }
      ]
    });

    if (!messageToUpdate) return;
    await messageToUpdate.update({ ack: chat });
    io.to(messageToUpdate.ticketId.toString()).emit(
      `company-${messageToUpdate.companyId}-appMessage`,
      {
        action: "update",
        message: messageToUpdate
      }
    );
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Error handling message ack. Err: ${err}`);
  }
};

const verifyCampaignMessageAndCloseTicket = async (
  message: proto.IWebMessageInfo,
  companyId: number
) => {
  const io = getIO();
  const body = getBodyMessage(message);
  const isCampaign = /\u200c/.test(body);
  if (message.key.fromMe && isCampaign) {
    const messageRecord = await Message.findOne({
      where: { id: message.key.id!, companyId }
    });
    const ticket = await Ticket.findByPk(messageRecord.ticketId);
    await ticket.update({ status: "closed" });

    io.to(`company-${ticket.companyId}-open`)
      .to(`queue-${ticket.queueId}-open`)
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "delete",
        ticket,
        ticketId: ticket.id
      });

    io.to(`company-${ticket.companyId}-${ticket.status}`)
      .to(`queue-${ticket.queueId}-${ticket.status}`)
      .to(ticket.id.toString())
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "update",
        ticket,
        ticketId: ticket.id
      });
  }
};

const filterMessages = (msg: WAMessage): boolean => {
  if (msg.messageStubType) {
    const ignoredStubTypes = [
      WAMessageStubType.E2E_DEVICE_CHANGED,
      WAMessageStubType.E2E_IDENTITY_CHANGED,
      WAMessageStubType.CIPHERTEXT,
      WAMessageStubType.REVOKE,
      9, 5, 6, 7, 8
    ] as number[];

    if (ignoredStubTypes.includes(msg.messageStubType as number)) {
      console.log("Filtrado por stubType en filterMessages:", msg.messageStubType);
      return false;
    }
  }
  return true;
};

const wbotMessageListener = async (
  wbot: Session,
  companyId: number
): Promise<void> => {
  try {
    wbot.ev.on("connection.update", (update) => {
      if (update.connection === "close") {
        console.log("Conexión cerrada");
      }
    });

    wbot.ev.on("messages.upsert", async (messageUpsert: ImessageUpsert) => {
      try {
        //console.log(`messages.upsert recibido: ${messageUpsert.messages.length} mensajes, tipo: ${messageUpsert.type}`);
        console.log("=== MESSAGE UPSERT COMPLETE STRUCTURE ===");
        console.log(JSON.stringify(messageUpsert, null, 2));
        console.log("=========================================");
        
        const modifiedMessages = messageUpsert.messages.map(msg => {
          const messageWithAny = msg as any;

          if (msg.key.remoteJid?.endsWith('@lid') && messageWithAny.key?.remoteJidAlt) {
            const modifiedMsg = { ...msg };
            modifiedMsg.key = {
              ...msg.key,
              remoteJid: messageWithAny.key.remoteJidAlt
            };
            console.log(`Normalizando LID JID: ${msg.key.remoteJid} -> ${messageWithAny.key.remoteJidAlt}`);
            return modifiedMsg;
          }
          
          if (messageWithAny.key?.senderPn) {
            const modifiedMsg = { ...msg };
            modifiedMsg.key = {
              ...msg.key,
              remoteJid: messageWithAny.key.senderPn
            };
            console.log(`Normalizando con senderPn: ${msg.key.remoteJid} -> ${messageWithAny.key.senderPn}`);
            return modifiedMsg;
          }
          
          return msg;
        });

        const messages = modifiedMessages.filter(msg => {
          const messageId = msg.key.id || 'sin-id';

          if (msg.message && "enc" in msg.message) {
            console.error(`MENSAJE CIFRADO DETECTADO EN FILTRO: ${messageId}`);
            return false;
          }

          if (!msg.message || typeof msg.message !== 'object') {
            console.log(`${messageId}: Sin mensaje válido`);
            return false;
          }

          const hasEnc = "enc" in msg.message;
          if (hasEnc) {
            console.log(`${messageId}: MENSAJE CIFRADO BLOQUEADO (pkmsg)`);
            return false;
          }

          const messageKeys = Object.keys(msg.message).filter(key => key !== 'enc');
          if (messageKeys.length === 0) {
            console.log(`${messageId}: Mensaje vacío después de filtrar`);
            return false;
          }

          if (msg.message.protocolMessage) {
            const protocolType = msg.message.protocolMessage.type;
            // Permitir mensajes eliminados (type === 0 o "REVOKE" como string) para procesarlos
            if (protocolType === 0 || (typeof protocolType === 'string' && protocolType === "REVOKE")) {
              // No filtrar, permitir que pase para procesar el mensaje eliminado
              return true;
            }
            if (protocolType !== 14) {
              console.log(`${messageId}: ProtocolMessage tipo ${protocolType} filtrado`);
              return false;
            }
          }

          // Permitir mensajes REVOKE (eliminados) para procesarlos
          if (msg.messageStubType === WAMessageStubType.REVOKE) {
            // No filtrar, permitir que pase para procesar el mensaje eliminado
            return true;
          }
          
          if (msg.messageStubType && [5, 6, 7, 8, 9].includes(msg.messageStubType as number)) {
            console.log(`${messageId}: StubType ${msg.messageStubType} filtrado`);
            return false;
          }

          return true;
        });

        if (messages.length === 0) {
          console.log("Todos los mensajes fueron filtrados correctamente");
          return;
        }

        for (const message of messages) {
          try {
            const messageExists = await Message.count({
              where: { id: message.key.id!, companyId }
            });

            if (!messageExists) {
              console.log(`Procesando mensaje nuevo: ${message.key.id} para JID: ${message.key.remoteJid}`);
              await handleMessage(message, wbot, companyId);
              await verifyCampaignMessageAndCloseTicket(message, companyId);
            } else {
              console.log(`Mensaje ya existe: ${message.key.id}, saltando...`);
            }
          } catch (error) {
            console.error(`Error procesando mensaje ${message.key.id}:`, error);
            Sentry.captureException(error);
          }
        }

      } catch (error) {
        console.error("Error crítico en messages.upsert:", error);
        Sentry.captureException(error);
      }
    });

    wbot.ev.on("messages.update", (messageUpdate: WAMessageUpdate[]) => {
      if (messageUpdate.length === 0) return;
      messageUpdate.forEach(async (message: WAMessageUpdate) => {
        (wbot as WASocket)!.readMessages([message.key]);
        handleMsgAck(message, message.update.status);
      });
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error(`Error handling wbot message listener. Err: ${error}`);
  }
};

export { wbotMessageListener, handleMessage, handleMsgAck };