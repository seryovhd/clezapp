import { MessageUpsertType, proto, WASocket } from "@whiskeysockets/baileys";
import {
  convertTextToSpeechAndSaveToFile,
  getBodyMessage,
  keepOnlySpecifiedChars,
  transferQueue,
  verifyMediaMessage,
  verifyMessage
} from "../WbotServices/wbotMessageListener";

import { isNil, isNull } from "lodash";
import fs from "fs";
import path from "path";

import OpenAI, { Configuration, OpenAIApi } from "openai";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import TicketTraking from "../../models/TicketTraking";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";

type Session = WASocket & {
  id?: number;
};

interface ImessageUpsert {
  messages: proto.IWebMessageInfo[];
  type: MessageUpsertType;
}

interface IMe {
  name: string;
  id: string;
}

interface SessionOpenAi extends OpenAIApi {
  id?: number;
}

const sessionsOpenAi: SessionOpenAi[] = [];

interface IOpenAi {
  name: string;
  prompt: string;
  voice: string;
  voiceKey: string;
  voiceRegion: string;
  maxTokens: number;
  temperature: number;
  apiKey: string;
  queueId: number;
  maxMessages: number;
}

// 🔁 Función de reintento con delay
const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 2000
): Promise<T> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (err?.response?.status === 429 && attempt < retries - 1) {
        console.warn(`🔁 Reintento por límite de tasa (${attempt + 1})`);
        await new Promise(res => setTimeout(res, delayMs));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Falló después de varios intentos");
};

const deleteFileSync = (path: string): void => {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    console.error("Error al eliminar el archivo:", error);
  }
};

const sanitizeName = (name: string): string => {
  let sanitized = name.split(" ")[0];
  sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, "");
  return sanitized.substring(0, 60);
};

export const handleOpenAi = async (
  openAiSettings: IOpenAi,
  msg: proto.IWebMessageInfo,
  wbot: Session,
  ticket: Ticket,
  contact: Contact,
  mediaSent: Message | undefined,
  ticketTraking: TicketTraking
): Promise<void> => {
  if (contact.disableBot) return;
  console.log("bodyMessage:: ", getBodyMessage(msg))
  const bodyMessage = getBodyMessage(msg) || "Hola, ¿en qué puedo ayudarte?";
  if (!bodyMessage || msg.messageStubType || !openAiSettings) return;

  const publicFolder: string = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public",
    `company${ticket.companyId}`
  );

  let openai: OpenAIApi | any;
  const openAiIndex = sessionsOpenAi.findIndex(s => s.id === ticket.id);

  if (openAiIndex === -1) {
    const configuration = new Configuration({ apiKey: openAiSettings.apiKey });
    openai = new OpenAIApi(configuration);
    openai.id = ticket.id;
    sessionsOpenAi.push(openai);
  } else {
    openai = sessionsOpenAi[openAiIndex];
  }

  const messages = await Message.findAll({
    where: { ticketId: ticket.id },
    order: [["createdAt", "ASC"]],
    limit: openAiSettings.maxMessages
  });

  const promptSystem = `En las respuestas, utiliza el nombre ${sanitizeName(
    contact.name || "Amigo(a)"
  )} para identificar al cliente.\nTu respuesta debe usar como máximo ${openAiSettings.maxTokens
    } tokens y asegúrate de no truncar el final.\nSiempre que sea posible, menciona su nombre para que la atención sea más personalizada y educada. Cuando la respuesta requiera una transferencia al área de atención, comienza tu respuesta con 'Acción: Transferir al área de atención'.\n${openAiSettings.prompt}\n`;

  let messagesOpenAi = [];

  if (msg.message?.conversation || msg.message?.extendedTextMessage?.text) {
    messagesOpenAi = [{ role: "system", content: promptSystem }];
    for (let i = 0; i < Math.min(openAiSettings.maxMessages, messages.length); i++) {
      const message = messages[i];
      if (
        message.mediaType === "conversation" ||
        message.mediaType === "extendedTextMessage"
      ) {
        messagesOpenAi.push({
          role: message.fromMe ? "assistant" : "user",
          content: message.body
        });
      }
    }

    messagesOpenAi.push({ role: "user", content: bodyMessage });

    const chat = await withRetry<Awaited<ReturnType<typeof openai.createChatCompletion>>>(() =>
      openai.createChatCompletion({
        model: "gpt-3.5-turbo-1106",
        messages: messagesOpenAi,
        max_tokens: openAiSettings.maxTokens,
        temperature: openAiSettings.temperature
      })
    );

    let response = chat.data.choices[0].message?.content;

    if (response?.includes("Acción: Transferir al área de atención")) {
      await transferQueue(openAiSettings.queueId, ticket, contact);
      response = response.replace("Acción: Transferir al área de atención", "").trim();
    }

    if (openAiSettings.voice === "texto") {
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: `\u200e ${response}`
      });
      await verifyMessage(sentMessage!, ticket, contact);
    } else {
      const fileName = `${ticket.id}_${Date.now()}`;
      await convertTextToSpeechAndSaveToFile(
        keepOnlySpecifiedChars(response!),
        `${publicFolder}/${fileName}`,
        openAiSettings.voiceKey,
        openAiSettings.voiceRegion,
        openAiSettings.voice,
        "mp3"
      );
      try {
        const sendMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          audio: { url: `${publicFolder}/${fileName}.mp3` },
          mimetype: "audio/mpeg",
          ptt: true
        });
        await verifyMediaMessage(sendMessage!, ticket, contact, ticketTraking, false, false, wbot);
        deleteFileSync(`${publicFolder}/${fileName}.mp3`);
        deleteFileSync(`${publicFolder}/${fileName}.wav`);
      } catch (error) {
        console.log(`Error al responder con audio: ${error}`);
      }
    }
  } else if (msg.message?.audioMessage) {
    const mediaUrl = mediaSent!.mediaUrl!.split("/").pop();
    const file = fs.createReadStream(`${publicFolder}/${mediaUrl}`) as any;

    const transcription = await withRetry<Awaited<ReturnType<typeof openai.audio.transcriptions.create>>>(() =>
      openai.audio.transcriptions.create({
        model: "whisper-1",
        file: file
      })
    );

    messagesOpenAi = [{ role: "system", content: promptSystem }];
    for (let i = 0; i < Math.min(openAiSettings.maxMessages, messages.length); i++) {
      const message = messages[i];
      if (
        message.mediaType === "conversation" ||
        message.mediaType === "extendedTextMessage"
      ) {
        messagesOpenAi.push({
          role: message.fromMe ? "assistant" : "user",
          content: message.body
        });
      }
    }
    messagesOpenAi.push({ role: "user", content: transcription.text });

    const chat = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106",
      messages: messagesOpenAi,
      max_tokens: openAiSettings.maxTokens,
      temperature: openAiSettings.temperature
    }) as Awaited<ReturnType<typeof openai.chat.completions.create>>;


    let response = chat.choices[0].message?.content;

    if (response?.includes("Acción: Transferir al área de atención")) {
      await transferQueue(openAiSettings.queueId, ticket, contact);
      response = response.replace("Acción: Transferir al área de atención", "").trim();
    }

    if (openAiSettings.voice === "texto") {
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: `\u200e ${response}`
      });
      await verifyMessage(sentMessage!, ticket, contact);
    } else {
      const fileName = `${ticket.id}_${Date.now()}`;
      await convertTextToSpeechAndSaveToFile(
        keepOnlySpecifiedChars(response!),
        `${publicFolder}/${fileName}`,
        openAiSettings.voiceKey,
        openAiSettings.voiceRegion,
        openAiSettings.voice,
        "mp3"
      );
      try {
        const sendMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          audio: { url: `${publicFolder}/${fileName}.mp3` },
          mimetype: "audio/mpeg",
          ptt: true
        });
        await verifyMediaMessage(sendMessage!, ticket, contact, ticketTraking, false, false, wbot);
        deleteFileSync(`${publicFolder}/${fileName}.mp3`);
        deleteFileSync(`${publicFolder}/${fileName}.wav`);
      } catch (error) {
        console.log(`Error al responder con audio: ${error}`);
      }
    }
  }

  messagesOpenAi = [];
};
