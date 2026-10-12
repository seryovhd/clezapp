import AppError from "../../errors/AppError";
import { WebhookModel } from "../../models/Webhook";
import { sendMessageFlow } from "../../controllers/MessageController";
import { IConnections, INodes } from "./DispatchWebHookService";
import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";
import CreateContactService from "../ContactServices/CreateContactService";
import Contact from "../../models/Contact";
import { SendMessage } from "../../helpers/SendMessage";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import Ticket from "../../models/Ticket";
import fs from "fs";
import GetWhatsappWbot from "../../helpers/GetWhatsappWbot";
import path from "path";
import SendWhatsAppMedia from "../WbotServices/SendWhatsAppMedia";
import SendWhatsAppMediaFlow, {
  typeSimulation
} from "../WbotServices/SendWhatsAppMediaFlow";
import { randomizarCaminho } from "../../utils/randomizador";
import { SendMessageFlow } from "../../helpers/SendMessageFlow";
import formatBody from "../../helpers/Mustache";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import ShowTicketService from "../TicketServices/ShowTicketService";
import CreateMessageService, {
  MessageData
} from "../MessageServices/CreateMessageService";
import { randomString } from "../../utils/randomCode";
import ShowQueueService from "../QueueService/ShowQueueService";
import { getIO } from "../../libs/socket";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import ShowTicketUUIDService from "../TicketServices/ShowTicketFromUUIDService";
import { logger } from "../../utils/logger";
import { delay } from "bluebird";
import typebotListener from "../TypebotServices/typebotListener";

import { getWbot } from "../../libs/wbot";
import { proto } from "@whiskeysockets/baileys";
import { handleOpenAi } from "../IntegrationsServices/OpenAiService";
import Message from "../../models/Message";
import { IOpenAi } from "../../@types/openai";
import Queue from "../../models/Queue";
import User from "../../models/User";
import { detectMediaTypeFromMessage } from "../WbotServices/wbotMessageListener";
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
// ✅ FUNCIÓN PARA ACCEDER A VARIABLES ANIDADAS - AGREGAR AL INICIO
const getNestedValue = (obj: any, path: string) => {
  try {
    console.log(`🔍 Buscando: ${path} en:`, JSON.stringify(obj, null, 2));

    // Manejar notación como resultado[0].subregion
    const keys = path.split(/\.|\[|\]/).filter(k => k !== '');
    let current = obj;

    for (const k of keys) {
      if (current === undefined || current === null) {
        console.log(`❌ No se puede acceder a ${k} - current es undefined/null`);
        return undefined;
      }

      // ✅ NUEVO: Si el valor actual es un string JSON, parsearlo
      if (typeof current === 'string' && current.trim().startsWith('{') && current.trim().endsWith('}')) {
        try {
          current = JSON.parse(current);
          console.log(`🔄 Parseando string JSON para ${k}`);
        } catch {
          // Si no se puede parsear, mantener como string
        }
      }

      // Si la clave es un número, tratar como índice de array
      if (!isNaN(Number(k))) {
        current = current[Number(k)];
      } else {
        current = current[k];
      }

      console.log(`➡️  Accediendo a ${k}:`, current);
    }

    console.log(`✅ Valor final para ${path}:`, current);
    return current;
  } catch (error) {
    console.log(`❌ Error accediendo a ${path}:`, error.message);
    return undefined;
  }
};
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
interface IDataWebhook {
  variables?: Record<string, any>;
}

interface IAddContact {
  companyId: number;
  name: string;
  phoneNumber: string;
  email?: string;
  dataMore?: any;
}
const getMimeType = (filename: string): string => {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: { [key: string]: string } = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed'
  };
  return mimeTypes[extension] || 'application/octet-stream';
};
// ✅ FUNCIÓN DE VALIDACIÓN DE TIPOS - AGREGAR AL INICIO
const validateConditionTypes = (condition: string, varValue: any, compareValue: any): { isValid: boolean; errorMessage: string } => {
  // Detectar si es comparación numérica
  const isNumericComparison = condition === ">=" || condition === "<=" || condition === ">" || condition === "<";

  if (isNumericComparison) {
    const isVarNumeric = !isNaN(parseFloat(varValue)) && isFinite(varValue);
    const isValueNumeric = !isNaN(parseFloat(compareValue)) && isFinite(compareValue);

    if (!isVarNumeric) {
      return {
        isValid: false,
        errorMessage: `Por favor ingrese una respuesta numérica válida.`
      };
    }
    if (!isValueNumeric) {
      return {
        isValid: false,
        errorMessage: `Error interno: Valor de comparación inválido`
      };
    }
  }

  return { isValid: true, errorMessage: "" };
};
const validateByDataType = (dataType: string, actualValue: any, condition: string, expectedValue?: any, variables?: any, key?: string): { isValid: boolean; errorMessage: string } => {
  console.log(`🔍 Validando tipo: ${dataType}, valor:`, actualValue, `condición: ${condition}`, `esperado:`, expectedValue);

  // ✅ CORRECCIÓN GLOBAL: Manejar valor vacío para todos los tipos
  const isEmptyValue = expectedValue === "" || expectedValue === null || expectedValue === undefined;

  switch (dataType) {
    case "text":
      return validateText(actualValue, condition, expectedValue);
    case "number":
      return validateNumber(actualValue, condition, expectedValue);
    case "image":
    case "audio":
    case "video":
    case "document":
    case "sticker":
      // ✅ Para medios, cuando el valor está vacío, solo validar presencia y tipo
      if (isEmptyValue) {
        const actualType = variables?.[`${key}_type`];
        return validateMediaType(actualValue, dataType, actualType);
      } else {
        // Si hay valor específico, validar según la condición
        const isPresent = actualValue !== undefined && actualValue !== null && actualValue !== "";
        switch (condition) {
          case "==":
            return {
              isValid: isPresent && (expectedValue === "true" || expectedValue === "present" || expectedValue === ""),
              errorMessage: `Se esperaba un ${dataType}`
            };
          case "!=":
            return {
              isValid: !isPresent || (expectedValue === "false" || expectedValue === "absent"),
              errorMessage: `No se esperaba un ${dataType}`
            };
          default:
            return { isValid: isPresent, errorMessage: `Se esperaba un ${dataType}` };
        }
      }

    case "contact":
      if (isEmptyValue) {
        return validateContact(actualValue);
      } else {
        const isPresent = actualValue !== undefined && actualValue !== null && actualValue !== "";
        switch (condition) {
          case "==":
            return {
              isValid: isPresent && (expectedValue === "true" || expectedValue === "present" || expectedValue === ""),
              errorMessage: "Se esperaba un contacto"
            };
          case "!=":
            return {
              isValid: !isPresent || (expectedValue === "false" || expectedValue === "absent"),
              errorMessage: "No se esperaba un contacto"
            };
          default:
            return { isValid: isPresent, errorMessage: "Se esperaba un contacto" };
        }
      }

    case "location":
      if (isEmptyValue) {
        return validateLocation(actualValue);
      } else {
        const isPresent = actualValue !== undefined && actualValue !== null && actualValue !== "";
        switch (condition) {
          case "==":
            return {
              isValid: isPresent && (expectedValue === "true" || expectedValue === "present" || expectedValue === ""),
              errorMessage: "Se esperaba una ubicación"
            };
          case "!=":
            return {
              isValid: !isPresent || (expectedValue === "false" || expectedValue === "absent"),
              errorMessage: "No se esperaba una ubicación"
            };
          default:
            return { isValid: isPresent, errorMessage: "Se esperaba una ubicación" };
        }
      }

    default:
      return { isValid: true, errorMessage: "" };
  }
};

const validateText = (value: any, condition: string, expected: string): { isValid: boolean; errorMessage: string } => {
  if (value === undefined || value === null) {
    return {
      isValid: false,
      errorMessage: "No se recibió ningún texto para validar"
    };
  }

  const stringValue = String(value);

  // ✅ DETECTAR SI ES SOLO NÚMEROS (no es texto real)
  const isOnlyNumbers = /^\d+$/.test(stringValue.trim());

  // ✅ CORRECCIÓN MEJORADA: Si el valor esperado está vacío, validar que sea texto REAL
  if (expected === "" || expected === null || expected === undefined) {
    return {
      isValid: stringValue.length > 0 && !isOnlyNumbers,  // ✅ NO PERMITIR SOLO NÚMEROS
      errorMessage: "Se esperaba un texto válido (no solo números)"
    };
  }

  // Si estamos validando contra un valor específico, permitir números como string
  switch (condition) {
    case "contains":
      return {
        isValid: stringValue.includes(expected),
        errorMessage: `El texto debe contener: "${expected}"`
      };
    case "startsWith":
      return {
        isValid: stringValue.startsWith(expected),
        errorMessage: `El texto debe comenzar con: "${expected}"`
      };
    case "endsWith":
      return {
        isValid: stringValue.endsWith(expected),
        errorMessage: `El texto debe terminar con: "${expected}"`
      };
    case "length":
      const expectedLength = parseInt(expected);
      return {
        isValid: stringValue.length === expectedLength,
        errorMessage: `El texto debe tener exactamente ${expected} caracteres`
      };
    case "==":
      return {
        isValid: stringValue === expected,
        errorMessage: `El texto debe ser igual a: "${expected}"`
      };
    case "!=":
      return {
        isValid: stringValue !== expected,
        errorMessage: `El texto debe ser diferente de: "${expected}"`
      };
    default:
      return { isValid: true, errorMessage: "" };
  }
};

const validateNumber = (value: any, condition: string, expected: string): { isValid: boolean; errorMessage: string } => {
  const numValue = parseFloat(value);

  // ✅ CORRECCIÓN: Si el valor esperado está vacío, solo validar que sea un número
  if (expected === "" || expected === null || expected === undefined) {
    return {
      isValid: !isNaN(numValue) && isFinite(numValue),
      errorMessage: "Se esperaba un número válido"
    };
  }

  const numExpected = parseFloat(expected);

  if (isNaN(numValue)) {
    return {
      isValid: false,
      errorMessage: "Se esperaba un número válido"
    };
  }

  if (isNaN(numExpected)) {
    return {
      isValid: false,
      errorMessage: "Valor de comparación inválido para número"
    };
  }

  switch (condition) {
    case "==":
      return { isValid: numValue === numExpected, errorMessage: `El número debe ser igual a: ${expected}` };
    case "!=":
      return { isValid: numValue !== numExpected, errorMessage: `El número debe ser diferente de: ${expected}` };
    case ">=":
      return { isValid: numValue >= numExpected, errorMessage: `El número debe ser mayor o igual a: ${expected}` };
    case "<=":
      return { isValid: numValue <= numExpected, errorMessage: `El número debe ser menor o igual a: ${expected}` };
    case ">":
      return { isValid: numValue > numExpected, errorMessage: `El número debe ser mayor a: ${expected}` };
    case "<":
      return { isValid: numValue < numExpected, errorMessage: `El número debe ser menor a: ${expected}` };
    default:
      return { isValid: true, errorMessage: "" };
  }
};

const validateMediaType = (value: any, expectedType: string, actualMediaType?: string): { isValid: boolean; errorMessage: string } => {
  console.log(`🔍 Validando medio: Esperado ${expectedType}, Real: ${actualMediaType}`);

  // ✅ CORRECCIÓN: Para medios, cuando no hay valor específico, solo validar el tipo
  const isMediaPresent = value !== undefined && value !== null && value !== "";

  // Si tenemos el tipo real del mensaje, validar contra el esperado
  if (actualMediaType && actualMediaType !== expectedType) {
    return {
      isValid: false,
      errorMessage: `_Se esperaba un ${expectedType}._`
    };
  }

  if (!isMediaPresent) {
    return {
      isValid: false,
      errorMessage: `No se recibió ningún ${expectedType}`
    };
  }

  return {
    isValid: true,
    errorMessage: ""
  };
};

const validateContact = (value: any): { isValid: boolean; errorMessage: string } => {
  const isContactPresent = value !== undefined && value !== null && value !== "";

  return {
    isValid: isContactPresent,
    errorMessage: "No se recibió información de contacto"
  };
};

const validateLocation = (value: any): { isValid: boolean; errorMessage: string } => {
  const isLocationPresent = value !== undefined && value !== null && value !== "";

  return {
    isValid: isLocationPresent,
    errorMessage: "No se recibió ubicación"
  };
};

const getFileInfoFromMessage = async (msg: any, wbot: any, companyId: number) => {
  try {
    const fileInfo: any = {
      type: getTypeMessage(msg),
      timestamp: Date.now()
    };

    let mediaMessage = null;

    if (msg.message?.imageMessage) {
      mediaMessage = msg.message.imageMessage;
      fileInfo.mimetype = mediaMessage.mimetype || 'image/jpeg';
      fileInfo.filename = mediaMessage.caption || `image_${Date.now()}.jpg`;
      fileInfo.mediaType = 'image';
    } else if (msg.message?.videoMessage) {
      mediaMessage = msg.message.videoMessage;
      fileInfo.mimetype = mediaMessage.mimetype || 'video/mp4';
      fileInfo.filename = mediaMessage.caption || `video_${Date.now()}.mp4`;
      fileInfo.mediaType = 'video';
    } else if (msg.message?.documentMessage) {
      mediaMessage = msg.message.documentMessage;
      fileInfo.mimetype = mediaMessage.mimetype || 'application/octet-stream';
      fileInfo.filename = mediaMessage.fileName || `document_${Date.now()}`;
      fileInfo.mediaType = 'document';
    } else if (msg.message?.audioMessage) {
      mediaMessage = msg.message.audioMessage;
      fileInfo.mimetype = mediaMessage.mimetype || 'audio/mpeg';
      fileInfo.filename = `audio_${Date.now()}.mp3`;
      fileInfo.mediaType = 'audio';
    } else if (msg.message?.stickerMessage) {
      mediaMessage = msg.message.stickerMessage;
      fileInfo.mimetype = mediaMessage.mimetype || 'image/webp';
      fileInfo.filename = `sticker_${Date.now()}.webp`;
      fileInfo.mediaType = 'sticker';
    }

    if (mediaMessage) {
      console.log("📥 Descargando archivo de WhatsApp...");
      const buffer = await wbot.downloadMediaMessage(msg);

      if (buffer) {
        fileInfo.buffer = buffer;
        fileInfo.base64 = buffer.toString('base64');
        fileInfo.size = buffer.length;
        fileInfo.dataUrl = `data:${fileInfo.mimetype};base64,${fileInfo.base64}`;

        const companyFolder = `company${companyId}`;
        const fileExtension = fileInfo.mimetype.split('/')[1] ||
          (fileInfo.mediaType === 'image' ? 'jpg' :
            fileInfo.mediaType === 'video' ? 'mp4' :
              fileInfo.mediaType === 'audio' ? 'mp3' : 'bin');

        const fileName = `flow_media_${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
        const filePath = path.resolve(__dirname, `../../public/${companyFolder}/flow_media`, fileName);

        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`📁 Directorio creado: ${dir}`);
        }

        fs.writeFileSync(filePath, buffer);

        fileInfo.path = `public/${companyFolder}/flow_media/${fileName}`;
        fileInfo.fullPath = filePath;

        const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
        fileInfo.url = `${backendUrl}/public/${companyFolder}/flow_media/${fileName}`;

        console.log(`✅ Archivo guardado: ${fileInfo.path}`);
        console.log(`🔗 URL pública: ${fileInfo.url}`);
        console.log(`📊 Tamaño: ${fileInfo.size} bytes`);
        console.log(`📝 Tipo: ${fileInfo.mediaType} (${fileInfo.mimetype})`);

        return fileInfo;
      }
    }

    return null;
  } catch (error) {
    console.error("❌ Error obteniendo archivo:", error);
    return null;
  }
};
const cleanDeepSeekResponse = (response: string): string => {
  console.log("🧹 Limpiando respuesta de DeepSeek:", response);

  // Eliminar el prefijo "json" si existe
  let cleaned = response.replace(/^json\s*\n?\s*/i, '');

  // Eliminar cualquier texto antes del primer {
  const firstBraceIndex = cleaned.indexOf('{');
  if (firstBraceIndex > 0) {
    cleaned = cleaned.substring(firstBraceIndex);
  }

  // Eliminar cualquier texto después del último }
  const lastBraceIndex = cleaned.lastIndexOf('}');
  if (lastBraceIndex !== -1 && lastBraceIndex < cleaned.length - 1) {
    cleaned = cleaned.substring(0, lastBraceIndex + 1);
  }

  console.log("✅ Respuesta limpia:", cleaned);
  return cleaned.trim();
};
export const ActionsWebhookService = async (
  whatsappId: number,
  idFlowDb: number,
  companyId: number,
  nodes: INodes[],
  connects: IConnections[],
  nextStage: string,
  dataWebhook: any,
  details: any,
  hashWebhookId: string,
  pressKey?: string,
  idTicket?: number,
  numberPhrase: "" | { number: string; name: string; email: string } = "",
  msg?: proto.IWebMessageInfo,
  wbot?: any
): Promise<string> => {

  console.log("🎯 ActionsWebhookService LLAMADO DESDE:", {
    llamador: new Error().stack?.split("\n")[2]?.trim(), // Esto muestra quién llamó la función
    nextStage,
    idTicket,
    pressKey,
    tieneMsg: !!msg,
    msgFromMe: msg?.key?.fromMe
  });

  console.log("🚀 ActionsWebhookService INICIADO:");
  console.log("🎫 Ticket ID:", idTicket);
  let ticket = null;
  if (idTicket) {
    const existingTicket = await Ticket.findOne({
      where: { id: idTicket, companyId }
    });

    if (existingTicket) {
      console.log("🔍 Estado actual del ticket:", {
        flowWebhook: existingTicket.flowWebhook,
        lastFlowId: existingTicket.lastFlowId,
        flowStopped: existingTicket.flowStopped,
        useIntegration: existingTicket.useIntegration
      });

      if (existingTicket.flowWebhook && nextStage === "1" && existingTicket.lastFlowId) {
        const lastNode = nodes.find(node => node.id === existingTicket.lastFlowId);
        if (lastNode && lastNode.type === "menu") {
          console.log("🔄 MENÚ ACTIVO - Permitiendo continuar desde:", existingTicket.lastFlowId);
          nextStage = existingTicket.lastFlowId;
        } else {
          console.log("🛑 FLUJO ACTIVO NO-MENÚ - Evitando reinicio");
          return "flow_already_running";
        }
      }

      // Si hay lastFlowId, permitir que continúe desde ese punto
      if (existingTicket.flowWebhook && nextStage === "1" && existingTicket.lastFlowId) {
        console.log("🔄 FLUJO ACTIVO CON lastFlowId - Continuando desde:", existingTicket.lastFlowId);
        nextStage = existingTicket.lastFlowId; // Continuar desde el último nodo
      }

      // Si el flujo está marcado como completado, no ejecutar
      if (existingTicket.flowStopped === "0") {
        console.log("🛑 FLUJO YA COMPLETADO - No ejecutar");
        return "flow_completed";
      }
    }
  }
  if (nextStage === "1" && idTicket) {
    console.log("🔍 VERIFICANDO SI EL FLUJO DEBE BLOQUEARSE...");

    const ticket = await Ticket.findOne({
      where: { id: idTicket, companyId }
    });

    if (ticket) {
      console.log("📋 ESTADO ACTUAL DEL TICKET:", {
        flowWebhook: ticket.flowWebhook,
        lastFlowId: ticket.lastFlowId,
        flowStopped: ticket.flowStopped,
        useIntegration: ticket.useIntegration,
        status: ticket.status
      });

      // ✅ MODIFICADO: Permitir continuar si hay lastFlowId (reintento de validación)
      if (ticket.flowStopped && ticket.flowStopped !== "null" && nextStage === "1" && !ticket.lastFlowId) {
        console.log("🛑 BLOQUEO ACTIVADO: Flujo ya tiene flowStopped, evitando reinicio");
        return "flow_already_started";
      }

      // ✅ AGREGADO: Si hay lastFlowId, continuar desde ese punto
      if (ticket.flowStopped && ticket.flowStopped !== "null" && nextStage === "1" && ticket.lastFlowId) {
        console.log("🔄 REINTENTO ACTIVADO: Continuando desde lastFlowId:", ticket.lastFlowId);
        nextStage = ticket.lastFlowId; // Continuar desde el último nodo
      }
    } else {
      console.log("❌ Ticket no encontrado");
    }
  }

  try {
    const io = getIO();
    let next = nextStage;
    /*  DEBUG FLOW   console.log(
          "ActionWebhookService | 53",
          idFlowDb,
          companyId,
          nodes,
          connects,
          nextStage,
          dataWebhook,
          details,
          hashWebhookId,
          pressKey,
          idTicket,
          numberPhrase
        ); */
    let createFieldJsonName = "";

    const connectStatic = connects;
    if (numberPhrase === "") {
      const nameInput = details.inputs.find(item => item.keyValue === "nome");
      nameInput.data.split(",").map(dataN => {
        const lineToData = details.keysFull.find(item => item === dataN);
        let sumRes = "";
        if (!lineToData) {
          sumRes = dataN;
        } else {
          sumRes = constructJsonLine(lineToData, dataWebhook);
        }
        createFieldJsonName = createFieldJsonName + sumRes;
      });
    } else {
      createFieldJsonName = numberPhrase.name;
    }

    let numberClient = "";

    if (numberPhrase === "") {
      const numberInput = details.inputs.find(
        item => item.keyValue === "celular"
      );

      numberInput.data.split(",").map(dataN => {
        const lineToDataNumber = details.keysFull.find(item => item === dataN);
        let createFieldJsonNumber = "";
        if (!lineToDataNumber) {
          createFieldJsonNumber = dataN;
        } else {
          createFieldJsonNumber = constructJsonLine(
            lineToDataNumber,
            dataWebhook
          );
        }

        numberClient = numberClient + createFieldJsonNumber;
      });
    } else {
      numberClient = numberPhrase.number;
    }

    numberClient = removerNaoLetrasNumeros(numberClient);

    if (numberClient.substring(0, 2) === "55") {
      if (parseInt(numberClient.substring(2, 4)) >= 31) {
        if (numberClient.length === 13) {
          numberClient =
            numberClient.substring(0, 4) + numberClient.substring(5, 13);
        }
      }
    }

    let createFieldJsonEmail = "";

    if (numberPhrase === "") {
      const emailInput = details.inputs.find(item => item.keyValue === "email");
      emailInput.data.split(",").map(dataN => {
        const lineToDataEmail = details.keysFull.find(item =>
          item.endsWith("email")
        );

        let sumRes = "";
        if (!lineToDataEmail) {
          sumRes = dataN;
        } else {
          sumRes = constructJsonLine(lineToDataEmail, dataWebhook);
        }

        createFieldJsonEmail = createFieldJsonEmail + sumRes;
      });
    } else {
      createFieldJsonEmail = numberPhrase.email;
    }

    const lengthLoop = nodes.length;
    const whatsapp = await GetDefaultWhatsApp(companyId);
    //console.log("⚙️ WHATSAPP:", whatsapp);

    if (whatsapp.status !== "CONNECTED") {
      return;
    }

    let execCount = 0;
    let execFn = "";
    let noAlterNext = false;
    let processedNodes = new Set();
    for (var i = 0; i < lengthLoop; i++) {
      let nodeSelected: any;
      let ticketInit: Ticket;
      if (!ticket && idTicket) {
        ticket = await Ticket.findOne({
          where: { id: idTicket, companyId }
        });
        if (!ticket) {
          console.error("❌ Ticket perdido durante el bucle");
          break;
        }
      }
      console.log("🔍 DEBUG - Procesando nodo en loop:", {
        iteracion: i,
        next: next,
        nodeSelected: nodes.find(n => n.id === next)
      });
      const nextNode = nodes.find(node => node.id === next);
      if (processedNodes.has(next)) {
        console.log("🔄 Nodo ya procesado, saltando:", next);

        // Encontrar la siguiente conexión para continuar
        const connectionsFromNode = connects.filter(connect => connect.source === next);
        if (connectionsFromNode.length > 0) {
          next = connectionsFromNode[0].target;
          console.log("➡️  Saltando al siguiente nodo:", next);
          continue;
        } else {
          console.log("❌ No hay más conexiones, terminando flujo");
          await ticket.update({
            status: "closed",
            useIntegration: false,
            flowWebhook: false,
            flowStopped: null,
            lastFlowId: null,
            dataWebhook: {}
          });
          break;
        }
      }
      processedNodes.add(next);
      if (pressKey) {
        console.log("🔍 PROCESANDO CON PRESKEY:", { pressKey, next });

        if (pressKey === "parar") {
          if (idTicket) {
            ticketInit = await Ticket.findOne({
              where: { id: idTicket, whatsappId }
            });
            await ticket.update({
              status: "closed"
            });
          }
          break;
        }
      }

      // ✅ SIEMPRE buscar el nodo por next, sin importar si hay pressKey o no
      nodeSelected = nodes.find(node => node.id === next);

      if (!nodeSelected) {
        console.error("❌ Nodo no encontrado para next:", next);
        break;
      }

      console.log("✅ Nodo seleccionado:", {
        id: nodeSelected.id,
        type: nodeSelected.type,
        hasData: !!nodeSelected.data
      });
      if (nodeSelected.type === "message") {

        let msg;

        const webhook = ticket.dataWebhook
        console.log("🔍 DEBUG - Antes de mostrar mensaje:", {
          ticketId: ticket.id,
          variableTester: webhook?.variables?.tester,
          mensajeConVariable: nodeSelected.data.label,
          dataWebhookCompleto: webhook
        });
        if (webhook && webhook.hasOwnProperty("variables")) {
          msg = {
            body: replaceMessages(webhook, nodeSelected.data.label)
          };
        } else {
          msg = {
            body: nodeSelected.data.label
          };
        }

        await SendMessage(whatsapp, {
          number: numberClient,
          body: msg.body,
          companyId: companyId
        });

        await intervalWhats("1");
        const connectionsFromThisNode = connects.filter(
          connect => connect.source === nodeSelected.id
        );

        console.log("🔗 Conexiones desde nodo message:", connectionsFromThisNode.length);
        console.log("📋 Conexiones:", connectionsFromThisNode);

        if (connectionsFromThisNode.length > 0) {
          next = connectionsFromThisNode[0].target;
          noAlterNext = true;
          console.log("➡️  Siguiente nodo desde message:", next);
        } else {
          console.log("❌ No hay conexiones desde el nodo message");
          console.log("REINICIANDO ESTADO DEL TICKET PARA PERMITIR NUEVO INICIO DE FLUJO");
          await ticket.update({
            status: "closed",
            useIntegration: false,
            flowWebhook: false,
            flowStopped: null,
            lastFlowId: null,
            dataWebhook: {}
          });
          break;
        }

      }
      if (nodeSelected.type === "img") {
        console.log('🖼️ Procesando nodo de imagen:', nodeSelected.data);

        if (nodeSelected.data && nodeSelected.data.url) {
          const fileName = nodeSelected.data.url;

          if (!fileName) {
            console.error('❌ Nombre del archivo de imagen no encontrado');
          } else {
            // Construir la ruta completa del archivo
            const mediaPath = __dirname.includes("dist")
              ? path.resolve(__dirname.split("dist")[0], "public", fileName)
              : path.resolve(__dirname.split("src")[0], "public", fileName);

            // Verificar si el archivo existe
            if (!fs.existsSync(mediaPath)) {
              console.error('❌ Archivo de imagen no encontrado:', mediaPath);
            } else {
              try {
                console.log('📤 Enviando imagen:', mediaPath);

                // Usar la función SendMessage que ya tienes
                await SendMessage(whatsapp, {
                  number: numberClient,
                  body: "", // Mensaje vacío para imagen
                  mediaPath: mediaPath,
                  companyId: companyId
                });

                await intervalWhats("1");
                console.log('✅ Imagen enviada correctamente');
              } catch (error) {
                console.error('❌ Error enviando imagen:', error);
              }
            }
          }
        } else {
          console.error('❌ URL de imagen no encontrada en nodo img');
        }

        // ✅ IMPORTANTE: SIEMPRE buscar las conexiones después de procesar el nodo
        const connectionsFromThisNode = connects.filter(
          connect => connect.source === nodeSelected.id
        );

        console.log(`🔗 Conexiones desde nodo img (${nodeSelected.id}):`, connectionsFromThisNode.length);

        if (connectionsFromThisNode.length > 0) {
          next = connectionsFromThisNode[0].target;
          noAlterNext = true;
          console.log('➡️  Siguiente nodo después de imagen:', next);
        } else {
          console.log('❌ No hay conexiones desde el nodo img, finalizando flujo');
          // Si no hay conexiones, dejar que el loop principal maneje la finalización
        }

        // ✅ CONTINUAR siempre al siguiente ciclo del loop
        continue;
      }
      if (nodeSelected.type === "video") {
        console.log('🎥 Procesando nodo de video:', nodeSelected.data);

        if (nodeSelected.data && nodeSelected.data.url) {
          const fileName = nodeSelected.data.url;

          if (!fileName) {
            console.error('❌ Nombre del archivo de video no encontrado');
          } else {
            // Construir la ruta completa del archivo
            const mediaPath = __dirname.includes("dist")
              ? path.resolve(__dirname.split("dist")[0], "public", fileName)
              : path.resolve(__dirname.split("src")[0], "public", fileName);

            // Verificar si el archivo existe
            if (!fs.existsSync(mediaPath)) {
              console.error('❌ Archivo de video no encontrado:', mediaPath);
            } else {
              try {
                console.log('📤 Enviando video:', mediaPath);

                // ✅ USAR LA FUNCIÓN SendMessage ACTUALIZADA
                await SendMessage(whatsapp, {
                  number: numberClient,
                  body: "",
                  mediaPath: mediaPath,
                  fileName: fileName,
                  mimetype: 'video/mp4',
                  mediaType: 'video', // ✅ NUEVO PARÁMETRO
                  companyId: companyId
                });

                await intervalWhats("1");
                console.log('✅ Video enviado correctamente');
              } catch (error) {
                console.error('❌ Error enviando video:', error);
              }
            }
          }
        } else {
          console.error('❌ URL de video no encontrada en nodo video');
        }

        // Buscar conexiones para continuar
        const connectionsFromThisNode = connects.filter(
          connect => connect.source === nodeSelected.id
        );

        if (connectionsFromThisNode.length > 0) {
          next = connectionsFromThisNode[0].target;
          noAlterNext = true;
          console.log('➡️  Siguiente nodo después de video:', next);
        }

        continue;
      }
      if (nodeSelected.type === "audio") {
        console.log('🎵 Procesando nodo de audio:', nodeSelected.data);

        if (nodeSelected.data && nodeSelected.data.url) {
          const fileName = nodeSelected.data.url;

          if (!fileName) {
            console.error('❌ Nombre del archivo de audio no encontrado');
          } else {
            // Construir la ruta completa del archivo
            const mediaPath = __dirname.includes("dist")
              ? path.resolve(__dirname.split("dist")[0], "public", fileName)
              : path.resolve(__dirname.split("src")[0], "public", fileName);

            // Verificar si el archivo existe
            if (!fs.existsSync(mediaPath)) {
              console.error('❌ Archivo de audio no encontrado:', mediaPath);
            } else {
              try {
                console.log('📤 Enviando audio:', mediaPath);

                // ✅ USAR LA FUNCIÓN SendMessage ACTUALIZADA
                await SendMessage(whatsapp, {
                  number: numberClient,
                  body: "",
                  mediaPath: mediaPath,
                  fileName: fileName,
                  mimetype: 'audio/mpeg',
                  mediaType: 'audio',
                  companyId: companyId
                });

                await intervalWhats("1");
                console.log('✅ Audio enviado correctamente');
              } catch (error) {
                console.error('❌ Error enviando audio:', error);

                // ✅ FALLBACK: Usar función específica si SendMessage falla
                try {
                  console.log('🔄 Intentando con función específica...');
                  const ticketInt = await Ticket.findOne({ where: { id: ticket.id } });

                  await typeSimulation(ticket, "recording");

                  await SendWhatsAppMediaFlow({
                    media: mediaPath,
                    ticket: ticketInt,
                    isRecord: false // o nodeSelected.data.isRecord si existe
                  });

                  console.log('✅ Audio enviado con función específica');
                } catch (error2) {
                  console.error('❌ Error también con función específica:', error2);
                }
              }
            }
          }
        } else {
          console.error('❌ URL de audio no encontrada en nodo audio');
        }

        // ✅ IMPORTANTE: Buscar conexiones después de procesar el nodo
        const connectionsFromThisNode = connects.filter(
          connect => connect.source === nodeSelected.id
        );

        console.log(`🔗 Conexiones desde nodo audio:`, connectionsFromThisNode.length);

        if (connectionsFromThisNode.length > 0) {
          next = connectionsFromThisNode[0].target;
          noAlterNext = true;
          console.log('➡️  Siguiente nodo después de audio:', next);
        } else {
          console.log('❌ No hay conexiones desde el nodo audio, finalizando flujo');
        }

        // ✅ CONTINUAR siempre al siguiente ciclo del loop
        continue;
      }
      if (nodeSelected.type === "typebot") {

        console.log("⚙️ WHATSAPP ACTUAL:", whatsapp);
        const wbot = getWbot(whatsapp.id);

        await typebotListener({
          wbot: wbot,
          msg,
          ticket,
          typebot: nodeSelected.data.typebotIntegration
        });
      }

      if (nodeSelected.type === "openai" || nodeSelected.type === "deepseek") {
        if (!ticket) {
          ticket = await Ticket.findOne({ where: { id: idTicket, companyId } });
          if (!ticket) throw new Error("Ticket no encontrado");
        }

        const contact = await Contact.findOne({
          where: { number: numberClient, companyId }
        });
        if (!contact) throw new Error("Contacto no encontrado");

        if (whatsapp.status !== "CONNECTED") {
          logger.error("🚫 WhatsApp no conectado para el flujo de IA");
          throw new AppError("ERR_WAPP_NOT_INITIALIZED", 400);
        }

        if (!msg || !msg.message) {
          logger.warn("⚠️ Mensaje no válido en nodo de IA. msg:", msg);
          break;
        }

        const wbot = await GetWhatsappWbot(whatsapp);

        const ticketTraking = await FindOrCreateATicketTrakingService({
          ticketId: ticket.id,
          companyId,
          userId: null,
          whatsappId: whatsapp.id
        });

        // Obtener configuración
        const aiConfig = nodeSelected.data.typebotIntegration;

        // ✅ VERIFICAR SI ES DEEPSEEK CON GUARDADO EN VARIABLE
        if (nodeSelected.type === "deepseek" && aiConfig.saveResponseTo) {
          console.log(`🎯 DeepSeek en modo SILENCIOSO - Guardando en variable: ${aiConfig.saveResponseTo}`);

          const deepSeekSettings: IDeepSeek = {
            name: aiConfig.name,
            prompt: aiConfig.prompt,
            apiKey: aiConfig.apiKey,
            maxTokens: aiConfig.maxTokens,
            temperature: aiConfig.temperature,
            model: aiConfig.model || "deepseek-chat",
            queueId: aiConfig.queueId,
            maxMessages: aiConfig.maxMessages,
            saveResponseTo: aiConfig.saveResponseTo
          };

          await handleDeepSeekFlow(
            msg,
            wbot,
            ticket,
            contact,
            deepSeekSettings
          );

          // ✅ ACTUALIZAR dataWebhook LOCAL CON LOS CAMBIOS
          // Necesitas recargar el ticket para obtener el dataWebhook actualizado
          const updatedTicket = await Ticket.findOne({ where: { id: ticket.id } });
          if (updatedTicket) {
            dataWebhook = updatedTicket.dataWebhook || {};
            console.log("🔄 dataWebhook local actualizado después de DeepSeek:",
              JSON.stringify(dataWebhook, null, 2));
          }

          // ✅ CONTINUAR CON EL SIGUIENTE NODO SIN ENVIAR MENSAJE
          const connectionsFromThisNode = connects.filter(
            connect => connect.source === nodeSelected.id
          );

          if (connectionsFromThisNode.length > 0) {
            next = connectionsFromThisNode[0].target;
            noAlterNext = true;
            console.log("➡️  Continuando al siguiente nodo después de DeepSeek silencioso:", next);
          }

          continue;
        } else {
          // ✅ COMPORTAMIENTO NORMAL (OpenAI o DeepSeek sin guardar variable)
          if (nodeSelected.type === "deepseek") {
            logger.info("🤖 Ejecutando nodo DeepSeek normal", {
              ticketId: ticket.id,
              contact: contact.name,
              phone: contact.number
            });

            const deepSeekSettings: IDeepSeek = {
              name: aiConfig.name,
              prompt: aiConfig.prompt,
              apiKey: aiConfig.apiKey,
              maxTokens: aiConfig.maxTokens,
              temperature: aiConfig.temperature,
              model: aiConfig.model || "deepseek-chat",
              queueId: aiConfig.queueId,
              maxMessages: aiConfig.maxMessages
              // saveResponseTo no está definido = comportamiento normal
            };

            await handleDeepSeekFlow(
              msg,
              wbot,
              ticket,
              contact,
              deepSeekSettings
            );
          } else {
            // Código existente para OpenAI
            const aiSettings = {
              name: aiConfig.name,
              prompt: aiConfig.prompt,
              voice: aiConfig.voice,
              voiceKey: aiConfig.voiceKey,
              voiceRegion: aiConfig.voiceRegion,
              apiKey: aiConfig.apiKey,
              maxTokens: aiConfig.maxTokens,
              temperature: aiConfig.temperature,
              queueId: aiConfig.queueId,
              maxMessages: aiConfig.maxMessages
            };

            await handleOpenAi(
              aiSettings,
              msg,
              wbot,
              ticket,
              contact,
              null,
              ticketTraking
            );
          }
        }
      }
      if (!ticket) {
        ticket = await Ticket.findOne({ where: { id: idTicket, companyId } });
        if (!ticket) throw new Error("Ticket no encontrado");
      }
      if (nodeSelected.type === "question") {
        const { message, answerKey } = nodeSelected.data.typebotIntegration;

        // ✅ MODO 1: MOSTRAR PREGUNTA (cuando NO hay mensaje de respuesta)
        if (!msg || (msg && msg.key.fromMe) || nextStage !== nodeSelected.id) {
          console.log("📝 QUESTION: Mostrando pregunta al usuario por primera vez");
          console.log("🔍 Estado:", {
            tieneMsg: !!msg,
            msgFromMe: msg?.key?.fromMe,
            nextStage,
            nodeId: nodeSelected.id
          });

          const ticketDetails = await ShowTicketService(ticket.id, companyId);

          // ✅ CORRECCIÓN MEJORADA: Aplicar variables al mensaje de la pregunta
          let formattedMessage = message;
          const webhook = ticket.dataWebhook;

          console.log("🔍 Variables disponibles:", webhook?.variables);

          if (webhook && webhook.hasOwnProperty("variables")) {
            formattedMessage = replaceMessages(webhook, message);
            console.log("✅ Mensaje con variables aplicadas:", formattedMessage);
          } else {
            console.log("🔍 Sin variables disponibles, usando mensaje original");
          }

          const bodyFila = formatBody(formattedMessage, ticket.contact);

          await delay(3000);
          await typeSimulation(ticket, "composing");

          await SendWhatsAppMessage({
            body: bodyFila,
            ticket: ticketDetails,
            quotedMsg: null
          });

          SetTicketMessagesAsRead(ticketDetails);

          await ticketDetails.update({
            lastMessage: bodyFila
          });

          // ✅ ACTUALIZAR TICKET PARA ESPERAR RESPUESTA
          await ticket.update({
            userId: null,
            companyId: companyId,
            lastFlowId: nodeSelected.id, // Mantener en este nodo
            hashFlowId: hashWebhookId,
            flowStopped: idFlowDb.toString(),
            flowWebhook: true // IMPORTANTE: Marcar como activo
          });

          console.log("⏳ QUESTION: Esperando respuesta del usuario...");
          return "awaiting_response";
        }

        // ✅ MODO 2: PROCESAR RESPUESTA (cuando hay mensaje del usuario)
        if (msg && !msg.key.fromMe) {
          console.log("🎯 QUESTION: Procesando respuesta del usuario");

          const body = getBodyMessage(msg);
          const mediaType = detectMediaTypeFromMessage(msg);

          console.log("📥 RESPUESTA RECIBIDA:");
          console.log("📝 Contenido:", body);
          console.log("📊 Tipo de medio:", mediaType);
          console.log("🔑 Variable destino:", answerKey);

          // ✅ DEBUG DETALLADO
          console.log("🔍 DEBUG - msg completo:", {
            hasImage: !!msg.message?.imageMessage,
            hasVideo: !!msg.message?.videoMessage,
            hasDocument: !!msg.message?.documentMessage,
            messageType: Object.keys(msg.message || {})[0]
          });

          if (msg.message?.imageMessage) {
            console.log("🖼️ IMAGEN DETECTADA:", {
              caption: msg.message.imageMessage.caption,
              fileSize: msg.message.imageMessage.fileLength,
              mimetype: msg.message.imageMessage.mimetype
            });
          }

          // ✅ OBTENER Wbot PARA DESCARGAR ARCHIVOS
          let wbotInstance = wbot;
          if (!wbotInstance) {
            console.log("🔄 Obteniendo wbot...");
            wbotInstance = await GetWhatsappWbot(whatsapp);
          }

          let responseValue: any = body;

          // ✅ CAPTURAR ARCHIVO SI ES MEDIO
          if (mediaType !== "text" && wbotInstance) {
            try {
              console.log(`📁 ${mediaType.toUpperCase()} detectado - Capturando archivo CON BASE64...`);

              const fileInfo = await getFileInfoFromMessage(msg, wbotInstance, companyId);
              console.log("🔍 RESULTADO DE getFileInfoFromMessage:", fileInfo);
              if (fileInfo) {
                // ✅ GUARDAR INFORMACIÓN COMPLETA
                responseValue = {
                  type: mediaType,
                  filename: fileInfo.filename,
                  mimetype: fileInfo.mimetype,
                  size: fileInfo.size,
                  base64: fileInfo.base64,
                  dataUrl: fileInfo.dataUrl,
                  timestamp: fileInfo.timestamp,
                  path: fileInfo.filename,
                  url: fileInfo.url // ✅ AGREGAR URL PÚBLICA
                };

                console.log(`💾 ${mediaType} capturado exitosamente:`, fileInfo.filename);
              }
            } catch (error) {
              console.error(`❌ Error capturando ${mediaType}:`, error);
              responseValue = `${mediaType}_error`;
            }
          }

          // ✅ GUARDAR EN VARIABLE
          const currentDataWebhook = ticket.dataWebhook || {};
          const currentVariables = currentDataWebhook.variables || {};

          const newDataWebhook = {
            ...currentDataWebhook,
            variables: {
              ...currentVariables,
              [answerKey]: responseValue,
              [`${answerKey}_type`]: mediaType,
              [`${answerKey}_timestamp`]: new Date().toISOString()
            }
          };

          console.log("💾 Variable guardada:", {
            key: answerKey,
            type: mediaType,
            hasBase64: mediaType !== "text" && responseValue.base64,
            value: mediaType === "text" ? responseValue : `[${mediaType}]`
          });

          // Actualizar el ticket
          await ticket.update({
            dataWebhook: newDataWebhook
          });

          // ✅ CONTINUAR AL SIGUIENTE NODO
          const nextConnection = connects.find(c => c.source === nodeSelected.id);

          if (!nextConnection) {
            console.log("❌ No hay conexión desde el nodo question");
            return "stop";
          }

          const nextNode = nodes.find(n => n.id === nextConnection.target);

          if (!nextNode) {
            console.log("❌ No se encontró el nodo siguiente");
            return "stop";
          }

          // Actualizar lastFlowId para continuar
          await ticket.update({
            lastFlowId: nextNode.id,
            dataWebhook: newDataWebhook
          });

          console.log("➡️  Continuando al nodo:", nextNode.type, nextNode.id);

          // ✅ OBTENER DATOS DEL CONTACTO
          const ticketContact = await Contact.findOne({
            where: { id: ticket.contactId, companyId }
          });

          const mountDataContact = {
            number: ticketContact?.number || "",
            name: ticketContact?.name || "",
            email: ticketContact?.email || ""
          };

          // ✅ CONTINUAR FLUJO CON LA RESPUESTA GUARDADA
          console.log("📍 CONTINUANDO FLUJO DESDE QUESTION...");
          await ActionsWebhookService(
            whatsapp.id,
            parseInt(ticket.flowStopped),
            ticket.companyId,
            nodes,
            connects,
            nextNode.id,
            newDataWebhook, // ✅ Pasar el dataWebhook actualizado
            "",
            "",
            "",
            ticket.id,
            mountDataContact,
            undefined, // ✅ IMPORTANTE: NO pasar msg para evitar procesamiento inmediato
            wbotInstance
          );

          return "processed";
        }
      }


      if (nodeSelected.type === "ticket") {
        const queueId = nodeSelected.data?.data?.id || nodeSelected.data?.id;

        if (!queueId) {
          console.warn("🛑 Nodo tipo 'ticket' sin ID de fila (queueId).");
          break;
        }

        const queue = await ShowQueueService(queueId, companyId);
        if (!queue) {
          console.warn(`🛑 Fila con ID ${queueId} no encontrada.`);
          break;
        }

        await ticket.update({
          status: "pending",
          queueId: queue.id,
          userId: ticket.userId,
          companyId: companyId,
          flowWebhook: true,
          lastFlowId: nodeSelected.id,
          hashFlowId: hashWebhookId,
          flowStopped: idFlowDb.toString()
        });

        await FindOrCreateATicketTrakingService({
          ticketId: ticket.id,
          companyId,
          whatsappId: ticket.whatsappId,
          userId: ticket.userId
        });

        // ✅ Reload para incluir relaciones (y evitar error en frontend)
        await ticket.reload({
          include: [
            { model: Queue, as: "queue" },
            { model: User, as: "user" },
            { model: Contact, as: "contact" }
          ]
        });

        const ticketDetails = await ShowTicketService(ticket.id, companyId);
        const bodyFila = formatBody(`Tu solicitud fue redirigida a *${queue.name}*.`, ticket.contact);

        await delay(3000);
        await typeSimulation(ticket, "composing");

        await SendWhatsAppMessage({
          body: bodyFila,
          ticket: ticketDetails,
          quotedMsg: null
        });

        SetTicketMessagesAsRead(ticketDetails);

        await ticketDetails.update({
          lastMessage: bodyFila
        });
        // ✅ Mensaje final tras redirigir el ticket
        const finalMsg = formatBody(
          "Gracias por tu mensaje, en breve un agente continuará la atención.",
          ticket.contact
        );

        await delay(3000);
        await typeSimulation(ticket, "composing");

        await SendWhatsAppMessage({
          body: finalMsg,
          ticket: ticketDetails,
          quotedMsg: null
        });

        await ticketDetails.update({
          lastMessage: finalMsg
        });

        // ✅ Evitar que siga repitiendo
        break;
      }


      if (nodeSelected.type === "singleBlock") {
        console.log("🔍 DEBUG COMPLETO del singleBlock:", JSON.stringify(nodeSelected, null, 2));

        if (!nodeSelected.data.elements) {
          console.error("❌ CRÍTICO: singleBlock sin elements - NODO CORRUPTO");
          console.log("💡 Solución: Editar este nodo en el frontend y volver a guardar");
        }
        // ✅ AGREGAR VERIFICACIÓN DE SEGURIDAD AL INICIO
        if (!nodeSelected.data || !nodeSelected.data.elements || !nodeSelected.data.seq) {
          console.error("❌ Error: Datos del singleBlock no disponibles", {
            nodeId: nodeSelected.id,
            hasData: !!nodeSelected.data,
            hasElements: !!nodeSelected.data?.elements,
            hasSeq: !!nodeSelected.data?.seq
          });

          // Continuar con el siguiente nodo en lugar de romper el flujo
          const connectionsFromThisNode = connects.filter(
            connect => connect.source === nodeSelected.id
          );
          if (connectionsFromThisNode.length > 0) {
            next = connectionsFromThisNode[0].target;
            noAlterNext = true;
            console.log("➡️  Continuando al siguiente nodo después de error:", next);
            continue;
          }
          break;
        }

        console.log("🎯 Procesando singleBlock:", {
          nodeId: nodeSelected.id,
          elementsCount: nodeSelected.data.elements.length,
          seqCount: nodeSelected.data.seq.length
        });

        for (var iLoc = 0; iLoc < nodeSelected.data.seq.length; iLoc++) {
          const elementNowSelected = nodeSelected.data.seq[iLoc];

          // ✅ ✅ ✅ DEBUG CRÍTICO - AGREGAR ESTO ✅ ✅ ✅
          console.log("🔍 🔍 🔍 PROCESANDO ELEMENTO EN SINGLEBLOCK:", {
            iteracion: iLoc,
            totalElementos: nodeSelected.data.seq.length,
            elementNowSelected: elementNowSelected,
            todosLosElementos: nodeSelected.data.seq,
            tieneImgUrl: nodeSelected.data.seq.some(item => item.includes("imgUrl"))
          });

          ticket = await Ticket.findOne({
            where: { id: idTicket, companyId }
          });

          // ✅ AGREGAR VERIFICACIÓN PARA CADA ELEMENTO
          const element = nodeSelected.data.elements.find(
            item => item.number === elementNowSelected
          );

          if (!element) {
            console.warn("⚠️ Elemento no encontrado en singleBlock:", elementNowSelected);
            continue; // Saltar este elemento y continuar con el siguiente
          }

          if (elementNowSelected.includes("message")) {
            const bodyFor = element.value;

            const ticketDetails = await ShowTicketService(idTicket, companyId);

            let msg;

            const webhook = ticket.dataWebhook;

            if (webhook && webhook.hasOwnProperty("variables")) {
              msg = replaceMessages(webhook.variables, bodyFor);
            } else {
              msg = bodyFor;
            }

            await delay(3000);
            await typeSimulation(ticket, "composing");

            await SendWhatsAppMessage({
              body: msg,
              ticket: ticketDetails,
              quotedMsg: null
            });

            SetTicketMessagesAsRead(ticketDetails);

            await ticketDetails.update({
              lastMessage: formatBody(bodyFor, ticket.contact)
            });

            await intervalWhats("1");
          }

          if (elementNowSelected.includes("interval")) {
            await intervalWhats(element.value);
          }

          // ✅ AGREGAR PROCESAMIENTO PARA imgUrl (NUEVA FUNCIONALIDAD)
          if (elementNowSelected.includes("imgUrl")) {
            console.log("🖼️ Procesando imagen con URL/variables:", element.value);

            const webhook = ticket.dataWebhook;
            let imageUrl = element.value;

            // Aplicar variables si están disponibles
            if (webhook && webhook.hasOwnProperty("variables")) {
              imageUrl = replaceMessages(webhook.variables, element.value);
              console.log("🔗 URL de imagen con variables aplicadas:", imageUrl);
            }

            try {
              const ticketDetails = await ShowTicketService(idTicket, companyId);

              await delay(3000);
              await typeSimulation(ticket, "composing");

              // ✅ USAR LA FUNCIÓN SendMessage ACTUALIZADA
              await SendMessage(whatsapp, {
                number: numberClient,
                body: "",
                mediaUrl: imageUrl, // ✅ ENVIAR POR URL
                companyId
              });

              await intervalWhats("1");

            } catch (error) {
              console.error("❌ Error enviando imagen con URL:", error);

              // Enviar mensaje de error
              const ticketDetails = await ShowTicketService(idTicket, companyId);
              await SendWhatsAppMessage({
                body: "❌ No se pudo cargar la imagen dinámica",
                ticket: ticketDetails,
                quotedMsg: null
              });
            }
          }

          if (elementNowSelected.includes("img")) {
            await typeSimulation(ticket, "composing");

            const fileName = element.value;

            if (!fileName) {
              console.error("❌ Nombre del archivo de imagen no encontrado");
              continue;
            }

            const mediaPath = __dirname.includes("dist")
              ? path.resolve(__dirname.split("dist")[0], "public", fileName)
              : path.resolve(__dirname.split("src")[0], "public", fileName);

            // Verificar si el archivo existe
            if (!fs.existsSync(mediaPath)) {
              console.error("❌ Archivo de imagen no encontrado:", mediaPath);
              continue;
            }

            await SendMessage(whatsapp, {
              number: numberClient,
              body: "",
              mediaPath,
              companyId
            });

            await intervalWhats("1");
          }

          if (elementNowSelected.includes("audio")) {
            console.log("🎵 Procesando audio en singleBlock:", element.value);

            const fileName = element.value;
            const isRecord = element.record;

            if (!fileName) {
              console.error("❌ Nombre del archivo de audio no encontrado");
              continue;
            }

            const mediaPath = __dirname.includes("dist")
              ? path.resolve(__dirname.split("dist")[0], "public", fileName)
              : path.resolve(__dirname.split("src")[0], "public", fileName);

            if (!fs.existsSync(mediaPath)) {
              console.error("❌ Archivo de audio no encontrado:", mediaPath);
              continue;
            }

            try {
              const ticketDetails = await ShowTicketService(idTicket, companyId);

              await delay(3000);
              await typeSimulation(ticket, "recording");

              // ✅ USAR SendMessage ACTUALIZADA
              await SendMessage(whatsapp, {
                number: numberClient,
                body: "",
                mediaPath: mediaPath,
                fileName: fileName,
                mimetype: 'audio/mpeg',
                mediaType: 'audio',
                companyId: companyId
              });

              await intervalWhats("1");
              console.log('✅ Audio enviado correctamente desde singleBlock');

            } catch (error) {
              console.error("❌ Error enviando audio con SendMessage:", error);

              // ✅ FALLBACK a la función original
              try {
                console.log('🔄 Usando función original SendWhatsAppMediaFlow...');
                const ticketInt = await Ticket.findOne({ where: { id: ticket.id } });

                await typeSimulation(ticket, "recording");

                await SendWhatsAppMediaFlow({
                  media: mediaPath,
                  ticket: ticketInt,
                  isRecord: isRecord
                });

                console.log('✅ Audio enviado con función original');
              } catch (error2) {
                console.error('❌ Error también con función original:', error2);

                const ticketDetails = await ShowTicketService(idTicket, companyId);
                await SendWhatsAppMessage({
                  body: "❌ No se pudo enviar el audio",
                  ticket: ticketDetails,
                  quotedMsg: null
                });
              }
            }
          }

          if (elementNowSelected.includes("video")) {
            console.log("🎥 Procesando video en singleBlock:", element.value);

            const fileName = element.value;

            if (!fileName) {
              console.error("❌ Nombre del archivo de video no encontrado");
              continue;
            }

            const mediaPath = __dirname.includes("dist")
              ? path.resolve(__dirname.split("dist")[0], "public", fileName)
              : path.resolve(__dirname.split("src")[0], "public", fileName);

            // Verificar si el archivo existe
            if (!fs.existsSync(mediaPath)) {
              console.error("❌ Archivo de video no encontrado:", mediaPath);
              continue;
            }

            try {
              const ticketDetails = await ShowTicketService(idTicket, companyId);

              await delay(3000);
              await typeSimulation(ticket, "recording");

              // ✅ USAR LA FUNCIÓN SendMessage ACTUALIZADA
              await SendMessage(whatsapp, {
                number: numberClient,
                body: element.caption || "", // ✅ Usar caption si está disponible
                mediaPath: mediaPath,
                fileName: fileName,
                mimetype: 'video/mp4',
                mediaType: 'video', // ✅ Especificar que es video
                companyId: companyId
              });

              await intervalWhats("1");
              console.log('✅ Video enviado correctamente desde singleBlock');

            } catch (error) {
              console.error("❌ Error enviando video en singleBlock:", error);

              // Enviar mensaje de error
              const ticketDetails = await ShowTicketService(idTicket, companyId);
              await SendWhatsAppMessage({
                body: "❌ No se pudo enviar el video",
                ticket: ticketDetails,
                quotedMsg: null
              });
            }
          }
          // ✅ AGREGAR PROCESAMIENTO PARA DOCUMENTOS LOCALES
          if (elementNowSelected.includes("document") && !elementNowSelected.includes("documentUrl")) {
            console.log("📄 Procesando documento local:", element.value);

            const fileName = element.value;

            if (!fileName) {
              console.error("❌ Nombre del archivo de documento no encontrado");
              continue;
            }

            const documentPath = __dirname.includes("dist")
              ? path.resolve(__dirname.split("dist")[0], "public", fileName)
              : path.resolve(__dirname.split("src")[0], "public", fileName);

            // Verificar si el archivo existe
            if (!fs.existsSync(documentPath)) {
              console.error("❌ Archivo de documento no encontrado:", documentPath);
              continue;
            }

            // ✅ VERIFICAR TAMAÑO MÁXIMO (15MB)
            const stats = fs.statSync(documentPath);
            if (stats.size > 15 * 1024 * 1024) {
              console.error("❌ Archivo demasiado grande:", stats.size, "máximo 15MB");

              // Enviar mensaje de error
              const ticketDetails = await ShowTicketService(idTicket, companyId);
              await SendWhatsAppMessage({
                body: "❌ El archivo es demasiado grande. Máximo 15MB permitido.",
                ticket: ticketDetails,
                quotedMsg: null
              });
              continue;
            }

            try {
              await SendMessage(whatsapp, {
                number: numberClient,
                body: element.caption || "", // ✅ Usar caption si está disponible
                documentPath,
                fileName: element.original,
                mimetype: getMimeType(element.original),
                companyId
              });

              await intervalWhats("1");
            } catch (error) {
              console.error("❌ Error enviando documento:", error);

              const ticketDetails = await ShowTicketService(idTicket, companyId);
              await SendWhatsAppMessage({
                body: "❌ No se pudo enviar el documento",
                ticket: ticketDetails,
                quotedMsg: null
              });
            }
          }

          // ✅ AGREGAR PROCESAMIENTO PARA DOCUMENTOS POR URL/VARIABLES
          // ✅ AGREGAR PROCESAMIENTO PARA DOCUMENTOS POR URL/VARIABLES
          if (elementNowSelected.includes("documentUrl")) {
            console.log("📄 Procesando documento con URL/variables:", element.value);

            const webhook = ticket.dataWebhook;
            let documentUrl = element.value;
            let fileName = element.fileName || "documento.pdf";

            // Aplicar variables si están disponibles
            if (webhook && webhook.hasOwnProperty("variables")) {
              documentUrl = replaceMessages(webhook.variables, element.value);
              fileName = replaceMessages(webhook.variables, fileName); // ✅ CORRECCIÓN: Aplicar variables al fileName también
              console.log("🔗 URL de documento con variables aplicadas:", documentUrl);
              console.log("📝 Nombre de archivo con variables aplicadas:", fileName);
            }

            try {
              const ticketDetails = await ShowTicketService(idTicket, companyId);

              await delay(3000);
              await typeSimulation(ticket, "composing");

              await SendMessage(whatsapp, {
                number: numberClient,
                body: element.caption || "",
                documentUrl: documentUrl,
                fileName: fileName, // ✅ CORRECCIÓN: Usar el fileName con variables resueltas
                mimetype: getMimeType(documentUrl),
                companyId
              });

              await intervalWhats("1");

            } catch (error) {
              console.error("❌ Error enviando documento con URL:", error);

              // Enviar mensaje de error
              const ticketDetails = await ShowTicketService(idTicket, companyId);
              await SendWhatsAppMessage({
                body: "❌ No se pudo cargar el documento",
                ticket: ticketDetails,
                quotedMsg: null
              });
            }
          }
        }
      }

      if (false && nodeSelected.type === "condition") {
        const { key, condition, dataType = "text" } = nodeSelected.data;
        const value = nodeSelected.data.value || "";
        const variables = dataWebhook?.variables || {};
        console.log("🔧 CONFIGURACIÓN DEL NODO CONDITION:", {
          key: nodeSelected.data.key,
          condition: nodeSelected.data.condition,
          dataType: nodeSelected.data.dataType,
          value: nodeSelected.data.value,  // ⚠️ Esto probablemente es undefined
          hasValue: nodeSelected.data.hasOwnProperty('value'),
          sendErrorMessages: nodeSelected.data.sendErrorMessages
        });
        console.log("🔍 EVALUANDO CONDICIÓN:");
        console.log("📋 Todas las variables:", JSON.stringify(variables, null, 2));
        console.log("🎯 Variable a evaluar:", key);

        // ✅ FUNCIÓN MEJORADA PARA ACCEDER A VARIABLES ANIDADAS
        // ✅ FUNCIÓN MEJORADA PARA ACCEDER A VARIABLES ANIDADAS
        const getNestedValue = (obj: any, path: string) => {
          try {
            console.log(`🔍 Buscando: ${path} en:`, JSON.stringify(obj, null, 2));

            // Manejar notación como resultado[0].subregion
            const keys = path.split(/\.|\[|\]/).filter(k => k !== '');
            let current = obj;

            for (const k of keys) {
              if (current === undefined || current === null) {
                console.log(`❌ No se puede acceder a ${k} - current es undefined/null`);
                return undefined;
              }

              // ✅ NUEVO: Si el valor actual es un string JSON, parsearlo
              if (typeof current === 'string' && current.trim().startsWith('{') && current.trim().endsWith('}')) {
                try {
                  current = JSON.parse(current);
                  console.log(`🔄 Parseando string JSON para ${k}`);
                } catch {
                  // Si no se puede parsear, mantener como string
                }
              }

              // Si la clave es un número, tratar como índice de array
              if (!isNaN(Number(k))) {
                current = current[Number(k)];
              } else {
                current = current[k];
              }

              console.log(`➡️  Accediendo a ${k}:`, current);
            }

            console.log(`✅ Valor final para ${path}:`, current);
            return current;
          } catch (error) {
            console.log(`❌ Error accediendo a ${path}:`, error.message);
            return undefined;
          }
        };

        const varValue = getNestedValue(variables, key);

        console.log("📊 Valor de la variable:", varValue);
        // ✅ VALIDACIÓN POR TIPO DE DATO
        console.log("🎯 Tipo de dato a validar:", dataType);
        const typeValidation = validateByDataType(dataType, varValue, condition, value, variables, key);

        if (!typeValidation.isValid) {
          console.log("❌ ERROR DE VALIDACIÓN DE TIPO:", typeValidation.errorMessage);

          // ✅ NUEVA LÓGICA: Verificar si se deben enviar mensajes de error
          const shouldSendError = nodeSelected.data.sendErrorMessages !== false;

          if (shouldSendError) {
            // Enviar mensaje de error al usuario solo si está habilitado
            const ticketDetails = await ShowTicketService(ticket.id, companyId);
            await delay(2000);
            await typeSimulation(ticket, "composing");

            await SendWhatsAppMessage({
              body: `⚠️ ${typeValidation.errorMessage}`,
              ticket: ticketDetails,
              quotedMsg: null
            });

            SetTicketMessagesAsRead(ticketDetails);
          } else {
            console.log("🔇 Mensaje de error suprimido por configuración");
          }

          // ✅ EN LUGAR DE QUEDARSE, SEGUIR POR LA CONEXIÓN FALSE
          console.log("🔄 Validación fallida, siguiendo por conexión false...");

          const connectionsFromThisNode = connects.filter(
            connect => connect.source === nodeSelected.id
          );

          const falseConnection = connectionsFromThisNode.find(
            conn => conn.sourceHandle === "false"
          );

          if (falseConnection) {
            next = falseConnection.target;
            noAlterNext = true;
            console.log("➡️  Siguiente nodo (false):", next);
            continue; // Continuar con el siguiente nodo
          } else {
            console.log("❌ No se encontró conexión false, terminando flujo");
            break;
          }
        }

        console.log("✅ Validación de tipo exitosa");
        console.log("⚖️  Condición:", condition);
        console.log("🎯 Valor de comparación:", value);

        // ✅ NUEVA FUNCIÓN PARA NORMALIZAR VALORES DE COMPARACIÓN
        const normalizeComparisonValue = (val: any, comparisonVal: any): any => {
          // Si el valor de comparación es "true" o "false" como string, convertirlo a boolean
          if (comparisonVal === "true") return true;
          if (comparisonVal === "false") return false;

          // Si es un número como string, convertirlo a número
          if (!isNaN(comparisonVal) && comparisonVal !== "") {
            return parseFloat(comparisonVal);
          }

          return comparisonVal;
        };

        // ✅ NORMALIZAR EL VALOR DE COMPARACIÓN
        const normalizedValue = normalizeComparisonValue(varValue, value);
        console.log("🔄 Valor de comparación normalizado:", normalizedValue);

        // ✅ VALIDACIÓN DE TIPOS AUTOMÁTICA
        // Detectar si es comparación numérica
        const isNumericComparison = condition === ">=" || condition === "<=" || condition === ">" || condition === "<";

        // Declarar result aquí para que esté disponible en todo el scope
        let result = false;

        // Validar tipos para comparaciones numéricas
        if (isNumericComparison) {
          const validation = validateConditionTypes(condition, varValue, normalizedValue);

          if (!validation.isValid) {
            console.log("❌ ERROR DE VALIDACIÓN:", validation.errorMessage);

            // Enviar mensaje de error
            const ticketDetails = await ShowTicketService(ticket.id, companyId);

            await delay(2000);
            await typeSimulation(ticket, "composing");

            await SendWhatsAppMessage({
              body: `⚠️ ${validation.errorMessage}`,
              ticket: ticketDetails,
              quotedMsg: null
            });

            SetTicketMessagesAsRead(ticketDetails);

            // ✅ MANTENER EN EL MISMO NODO PERO PERMITIR NUEVAS RESPUESTAS
            console.log("🔄 Manteniendo en el mismo nodo para reintentar...");

            // Actualizar el ticket para que permanezca en este nodo PERO permita nuevas respuestas
            await ticket.update({
              lastFlowId: nodeSelected.id, // Mantener el mismo nodo
              hashFlowId: hashWebhookId,
              flowStopped: "null",
              flowWebhook: false // ✅ IMPORTANTE: Marcar como NO activo para permitir nueva interacción
            });

            // IMPORTANTE: Salir del flujo pero permitir que la siguiente respuesta active el flujo nuevamente
            return "validation_error_retry";
          }
        }

        // ✅ CONTINUAR CON EVALUACIÓN NORMAL SI LOS TIPOS SON VÁLIDOS
        const isVarNumeric = !isNaN(parseFloat(varValue)) && isFinite(varValue);
        const isValueNumeric = !isNaN(parseFloat(normalizedValue)) && isFinite(normalizedValue);

        const shouldCompareAsNumbers = isVarNumeric && isValueNumeric &&
          (condition === ">=" || condition === "<=" || condition === ">" || condition === "<");

        console.log("🔢 Detección automática:", {
          variableEsNumérica: isVarNumeric,
          valorEsNumérico: isValueNumeric,
          compararComoNúmeros: shouldCompareAsNumbers,
          tipoCondición: condition
        });

        // Evaluar la condición con valores normalizados
        const compareValue = shouldCompareAsNumbers ? parseFloat(varValue) : varValue;
        const compareTo = shouldCompareAsNumbers ? parseFloat(normalizedValue) : normalizedValue;

        console.log("🔍 COMPARACIÓN FINAL:", {
          valorVariable: compareValue,
          tipoValorVariable: typeof compareValue,
          valorComparación: compareTo,
          tipoValorComparación: typeof compareTo,
          condición: condition
        });

        // ✅ EVALUACIÓN SEGÚN TIPO DE DATO
        switch (dataType) {
          case "text":
            // ✅ CORRECCIÓN MEJORADA: Cuando el valor de comparación está vacío
            if (value === "" || value === null || value === undefined) {
              // Si es booleano, validar como booleano
              if (varValue === true || varValue === false) {
                result = varValue === true;
              }
              // Si es texto, validar que tenga contenido
              else {
                result = String(varValue).length > 0;
              }
              break;
            }

            // Para texto con valor específico, usar las condiciones específicas
            switch (condition) {
              case "contains":
                result = String(varValue).includes(value);
                break;
              case "startsWith":
                result = String(varValue).startsWith(value);
                break;
              case "endsWith":
                result = String(varValue).endsWith(value);
                break;
              case "length":
                result = String(varValue).length === parseInt(value);
                break;
              case "==":
                result = String(varValue) === value;
                break;
              case "!=":
                result = String(varValue) !== value;
                break;
              default:
                // Para condiciones numéricas en texto, usar comparación numérica
                const textNumValue = parseFloat(varValue);
                const textNumExpected = parseFloat(value);
                if (!isNaN(textNumValue) && !isNaN(textNumExpected)) {
                  switch (condition) {
                    case ">=":
                      result = textNumValue >= textNumExpected;
                      break;
                    case "<=":
                      result = textNumValue <= textNumExpected;
                      break;
                    case ">":
                      result = textNumValue > textNumExpected;
                      break;
                    case "<":
                      result = textNumValue < textNumExpected;
                      break;
                    default:
                      result = false;
                  }
                } else {
                  result = false;
                }
            }
            break;

          case "number":
            // Para números, siempre convertir a número
            if (value === "" || value === null || value === undefined) {
              const numValue = parseFloat(varValue);
              result = !isNaN(numValue) && isFinite(numValue);
              break;
            }
            const numValue = parseFloat(varValue);
            const numExpected = parseFloat(value);
            if (!isNaN(numValue) && !isNaN(numExpected)) {
              switch (condition) {
                case "==":
                  result = numValue === numExpected;
                  break;
                case "!=":
                  result = numValue !== numExpected;
                  break;
                case ">=":
                  result = numValue >= numExpected;
                  break;
                case "<=":
                  result = numValue <= numExpected;
                  break;
                case ">":
                  result = numValue > numExpected;
                  break;
                case "<":
                  result = numValue < numExpected;
                  break;
                default:
                  result = false;
              }
            } else {
              result = false;
            }
            break;

          default:
            // ✅ CORRECCIÓN: Para medios (image, audio, video, etc.) - validar tipo específico
            // Primero verificar si el tipo de medio coincide con el esperado
            const actualMediaType = detectMediaTypeFromMessage(msg);

            if (dataType === "image" && actualMediaType !== "image") {
              result = false;
            } else if (dataType === "audio" && actualMediaType !== "audio") {
              result = false;
            } else if (dataType === "video" && actualMediaType !== "video") {
              result = false;
            } else if (dataType === "document" && actualMediaType !== "document") {
              result = false;
            } else if (dataType === "sticker" && actualMediaType !== "sticker") {
              result = false;
            } else if (dataType === "contact" && actualMediaType !== "contact") {
              result = false;
            } else if (dataType === "location" && actualMediaType !== "location") {
              result = false;
            } else {
              // Si el tipo coincide, entonces evaluar la condición
              const isPresent = varValue !== undefined && varValue !== null && varValue !== "";

              // Para medios, las condiciones solo pueden ser de presencia
              switch (condition) {
                case "==":
                  result = isPresent && (value === "true" || value === "present" || value === "");
                  break;
                case "!=":
                  result = !isPresent || (value === "false" || value === "absent");
                  break;
                default:
                  result = isPresent;
              }
            }

            console.log("🔍 VALIDACIÓN DE MEDIO:", {
              tipoEsperado: dataType,
              tipoReal: actualMediaType,
              condición: condition,
              valor: value,
              resultado: result
            });
        }

        console.log("✅ Resultado de la condición:", result);
        console.log("📝 Comparación:", {
          tipo: shouldCompareAsNumbers ? "numérica" : "texto",
          comparando: `${compareValue} ${condition} ${compareTo}`
        });

        // Encontrar la conexión correcta según el resultado
        const connectionsFromThisNode = connects.filter(
          connect => connect.source === nodeSelected.id
        );

        console.log("🔄 Conexiones disponibles:", connectionsFromThisNode);

        let nextConnection;
        if (result === true) {
          nextConnection = connectionsFromThisNode.find(
            conn => conn.sourceHandle === "true"
          );
        } else {
          nextConnection = connectionsFromThisNode.find(
            conn => conn.sourceHandle === "false"
          );
        }

        if (nextConnection) {
          next = nextConnection.target;
          noAlterNext = true;
          console.log("➡️  Siguiente nodo:", next);
          continue;
        } else {
          console.log("❌ No se encontró conexión para el resultado:", result);
          break;
        }
      }


      let isRandomizer: boolean;
      if (nodeSelected.type === "randomizer") {
        const selectedRandom = randomizarCaminho(
          nodeSelected.data.percent / 100
        );

        const resultConnect = connects.filter(
          connect => connect.source === nodeSelected.id
        );
        if (selectedRandom === "A") {
          next = resultConnect.filter(item => item.sourceHandle === "a")[0]
            .target;
          noAlterNext = true;
        } else {
          next = resultConnect.filter(item => item.sourceHandle === "b")[0]
            .target;
          noAlterNext = true;
        }
        isRandomizer = true;
      }

      let isMenu: boolean;
      console.log("🔍 ESTADO ANTES DE PROCESAR NODO:", {
        nodeType: nodeSelected?.type,
        pressKey,
        next,
        nodeId: nodeSelected?.id
      });
      if (nodeSelected.type === "menu") {
        // ✅ VERIFICACIÓN DE SEGURIDAD CRÍTICA
        if (!nodeSelected.data || !nodeSelected.data.arrayOption) {
          console.error("❌ ERROR: Nodo menú no tiene data o arrayOption", nodeSelected);
          break;
        }

        console.log("🔍 DEBUG COMPLETO DEL MENÚ:", {
          nodeId: nodeSelected.id,
          opciones: nodeSelected.data.arrayOption,
          responseVariable: nodeSelected.data.responseVariable,
          todasLasConexiones: connects.filter(conn => conn.source === nodeSelected.id).map(conn => ({
            sourceHandle: conn.sourceHandle,
            target: conn.target,
            targetNode: nodes.find(n => n.id === conn.target)?.data?.label
          }))
        });

        // ✅ NUEVA FUNCIONALIDAD: Verificar si hay variable de respuesta
        const responseVar = nodeSelected.data.responseVariable;
        let variableResponseUsed = false;

        if (responseVar && dataWebhook?.variables) {
          const variableKey = responseVar.replace(/{{|}}/g, "").trim();

          // ✅ CORRECCIÓN: Usar getNestedValue para acceder a propiedades anidadas
          const variableValue = getNestedValue(dataWebhook.variables, variableKey);

          if (variableValue !== undefined && variableValue !== null && variableValue !== "") {
            console.log("🎯 Usando respuesta desde variable:", {
              variable: responseVar,
              valor: variableValue
            });

            // Usar el valor de la variable como si fuera pressKey
            pressKey = variableValue.toString();
            variableResponseUsed = true;
            console.log("🔀 Respuesta automática desde variable:", pressKey);
          }
        }

        // ✅ SI HAY RESPUESTA DE VARIABLE, NO MOSTRAR MENÚ - IR DIRECTAMENTE A LA OPCIÓN
        if (variableResponseUsed && pressKey) {
          console.log("🚫 Menú omitido - respuesta desde variable, yendo directamente a opción:", pressKey);

          const connectionsFromMenu = connects.filter(
            conn => conn.source === nodeSelected.id
          );

          console.log("🔗 Conexiones disponibles desde menú:", connectionsFromMenu);

          const selectedConnection = connectionsFromMenu.find(
            conn => conn.sourceHandle === "a" + pressKey
          );

          if (selectedConnection) {
            next = selectedConnection.target;
            noAlterNext = true;
            console.log("✅ Opción desde variable encontrada, siguiente nodo:", next);

            // ✅ DEBUG ADICIONAL: Verificar qué opción se seleccionó
            const optionSelected = nodeSelected.data.arrayOption.find(
              opt => opt.number.toString() === pressKey
            );
            console.log("📝 Opción seleccionada desde variable:", optionSelected);

            // ✅ CONTINUAR CON EL SIGUIENTE NODO SIN MOSTRAR MENÚ
            continue;
          } else {
            console.log("❌ Opción inválida desde variable:", pressKey);

            // Opción inválida desde variable - enviar mensaje de error
            const ticketDetails = await ShowTicketService(ticket.id, companyId);
            await SendWhatsAppMessage({
              body: "❌ Opción inválida en la configuración del flujo. Por favor contacte al administrador.",
              ticket: ticketDetails,
              quotedMsg: null
            });

            // Mantener en el mismo nodo
            await ticket.update({
              lastFlowId: nodeSelected.id,
              hashFlowId: hashWebhookId,
              flowStopped: "null",
              flowWebhook: true
            });

            return "invalid_variable_option";
          }
        }

        // ✅ COMPORTAMIENTO ORIGINAL PARA MENÚ INTERACTIVO
        if (pressKey) {
          console.log("🎯 Procesando respuesta de menú interactivo:", {
            pressKey,
            nodeId: nodeSelected.id,
            nodeData: nodeSelected.data
          });

          const connectionsFromMenu = connects.filter(
            conn => conn.source === nodeSelected.id
          );

          console.log("🔗 Conexiones disponibles desde menú:", connectionsFromMenu);

          const selectedConnection = connectionsFromMenu.find(
            conn => conn.sourceHandle === "a" + pressKey
          );

          if (selectedConnection) {
            next = selectedConnection.target;
            noAlterNext = true;
            console.log("✅ Opción válida encontrada, siguiente nodo:", next);

            const optionSelected = nodeSelected.data.arrayOption.find(
              opt => opt.number.toString() === pressKey
            );
            console.log("📝 Opción seleccionada por usuario:", optionSelected);
          } else {
            console.log("❌ Opción inválida:", pressKey);

            const ticketDetails = await ShowTicketService(ticket.id, companyId);
            await SendWhatsAppMessage({
              body: "❌ Opción inválida. Por favor seleccione una opción del menú.",
              ticket: ticketDetails,
              quotedMsg: null
            });

            await ticket.update({
              lastFlowId: nodeSelected.id,
              hashFlowId: hashWebhookId,
              flowStopped: "null",
              flowWebhook: true
            });

            return "invalid_option_retry";
          }

          continue;

        } else {
          // ✅ CÓDIGO PARA MOSTRAR EL MENÚ AL USUARIO (solo si no hay variable)
          console.log("📋 Mostrando menú al usuario (respuesta interactiva)");

          let optionsMenu = "";
          nodeSelected.data.arrayOption.map(item => {
            optionsMenu += `*${item.number}* .- ${item.value}\n`;
          });

          const menuCreate = `${nodeSelected.data.message}\n\n${optionsMenu}`;

          const webhook = ticket.dataWebhook;

          let msg;
          if (webhook && webhook.hasOwnProperty("variables")) {
            msg = replaceMessages(webhook, menuCreate);
          } else {
            msg = menuCreate;
          }

          const ticketDetails = await ShowTicketService(ticket.id, companyId);

          await typeSimulation(ticket, "composing");

          await SendWhatsAppMessage({
            body: msg,
            ticket: ticketDetails,
            quotedMsg: null
          });

          SetTicketMessagesAsRead(ticketDetails);

          await ticketDetails.update({
            lastMessage: formatBody(msg, ticket.contact)
          });

          await intervalWhats("1");

          await ticket.update({
            queueId: ticket.queueId ? ticket.queueId : null,
            userId: null,
            companyId: companyId,
            flowWebhook: true,
            lastFlowId: nodeSelected.id,
            dataWebhook: dataWebhook,
            hashFlowId: hashWebhookId,
            flowStopped: idFlowDb.toString()
          });

          console.log("✅ Menú mostrado - Ticket actualizado para esperar respuesta");

          return "awaiting_menu_response";
        }
      }


      if (next === "") {
        break;
      }
      ticket = await Ticket.findOne({
        where: { id: idTicket, whatsappId, companyId: companyId }
      });

      if (ticket.status === "closed") {
        io.of(String(companyId))
          // .to(oldStatus)
          // .to(ticketId.toString())
          .emit(`company-${ticket.companyId}-ticket`, {
            action: "delete",
            ticketId: ticket.id
          });
      }
      await ticket.update({
        whatsappId: whatsappId,
        queueId: ticket?.queueId,
        userId: null,
        companyId: companyId,
        flowWebhook: true,
        lastFlowId: nodeSelected.id,
        hashFlowId: hashWebhookId,
        flowStopped: idFlowDb.toString()
      });

      noAlterNext = false;
      execCount++;
    }

    if (next === "" || !next) {
      console.log("🏁 Flujo finalizado para el ticket:", idTicket);

      if (ticket) {
        await ticket.update({
          flowWebhook: false,
          lastFlowId: null,
          flowStopped: "0",  // ✅ CAMBIO IMPORTANTE: Cambiar de null a "completed"
          hashFlowId: null,
          dataWebhook: {}
        });
        console.log("✅ Ticket marcado como COMPLETADO - flowStopped: completed");
      }

      return "end";
    }
    return "ds";
  } catch (error) {
    logger.error(error);
  }
};

const constructJsonLine = (line: string, json: any) => {
  let valor = json;
  const chaves = line.split(".");

  if (chaves.length === 1) {
    return valor[chaves[0]];
  }

  for (const chave of chaves) {
    valor = valor[chave];
  }
  return valor;
};

function removerNaoLetrasNumeros(texto: string) {
  // Substitui todos os caracteres que não são letras ou números por vazio
  return texto.replace(/[^a-zA-Z0-9]/g, "");
}

const sendMessageWhats = async (
  whatsId: number,
  msg: any,
  req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>
) => {
  sendMessageFlow(whatsId, msg, req);
  return Promise.resolve();
};

const intervalWhats = (time: string) => {
  const seconds = parseInt(time) * 1000;
  return new Promise(resolve => setTimeout(resolve, seconds));
};

// ✅ FUNCIÓN MEJORADA PARA REEMPLAZAR VARIABLES
const replaceMessages = (variables: any, message: string): string => {
  console.log("🔍 DEBUG - Sustituyendo variables:", {
    variables: variables,
    messageOriginal: message
  });

  let actualVariables = variables;
  if (variables && variables.variables && typeof variables.variables === 'object') {
    actualVariables = variables.variables;
  }

  if (!actualVariables || Object.keys(actualVariables).length === 0) {
    console.log("🔍 No hay variables disponibles, retornando mensaje original");
    return message.replace(/{{\s*[^{}]*\s*}}/g, "");
  }

  const result = message.replace(
    /{{\s*([^{}]+)\s*}}/g,
    (match, key) => {
      console.log(`🔍 Procesando variable: {{${key}}}`);

      try {
        const keys = key.split('.').filter(Boolean);
        let value = actualVariables;

        for (const k of keys) {
          if (value === undefined || value === null) break;

          // ✅ MEJORA: Si value es string que parece objeto, parsearlo
          if (typeof value === 'string' && value.trim().startsWith('{') && value.trim().endsWith('}')) {
            try {
              value = JSON.parse(value);
              console.log(`🔄 Parseando string JSON para ${k}`);
            } catch {
              // Mantener como string si no es JSON válido
            }
          }

          value = value[k];
        }

        let finalValue = "";
        if (value !== undefined && value !== null) {
          // ✅ ✅ ✅ CORRECCIÓN CRÍTICA: Si es objeto, usar JSON.stringify
          if (typeof value === 'object' && !Array.isArray(value)) {
            finalValue = JSON.stringify(value, null, 2);
            console.log(`✅ Variable {{${key}}} es OBJETO, formateando como JSON:`, finalValue);
          } else if (Array.isArray(value)) {
            finalValue = JSON.stringify(value, null, 2);
            console.log(`✅ Variable {{${key}}} es ARRAY, formateando como JSON:`, finalValue);
          } else {
            finalValue = String(value);
            console.log(`✅ Variable {{${key}}} = "${finalValue}"`);
          }
        } else {
          console.log(`❌ Variable {{${key}}} no encontrada o es null/undefined`);
        }

        console.log(`✅ Variable {{${key}}} = "${finalValue}"`);
        return finalValue;
      } catch (error) {
        console.log(`❌ Error en variable {{${key}}}:`, error.message);
        return "";
      }
    }
  );

  console.log("✅ Mensaje final después de reemplazar variables:", result);
  return result;
};
const replaceMessagesOld = (
  message: string,
  details: any,
  dataWebhook: any,
  dataNoWebhook?: any
) => {
  const matches = message.match(/\{([^}]+)\}/g);

  if (dataWebhook) {
    let newTxt = message.replace(/{+nome}+/, dataNoWebhook.nome);
    newTxt = newTxt.replace(/{+numero}+/, dataNoWebhook.numero);
    newTxt = newTxt.replace(/{+email}+/, dataNoWebhook.email);
    return newTxt;
  }

  if (matches && matches.includes("inputs")) {
    const placeholders = matches.map(match => match.replace(/\{|\}/g, ""));
    let newText = message;
    placeholders.map(item => {
      const value = details["inputs"].find(
        itemLocal => itemLocal.keyValue === item
      );
      const lineToData = details["keysFull"].find(itemLocal =>
        itemLocal.endsWith(`.${value.data}`)
      );
      const createFieldJson = constructJsonLine(lineToData, dataWebhook);
      newText = newText.replace(`{${item}}`, createFieldJson);
    });
    return newText;
  } else {
    return message;
  }
};

// ✅ FUNCIÓN PARA DEEPSEEK - Agregar aquí
const handleDeepSeekFlow = async (
  msg: proto.IWebMessageInfo,
  wbot: any,
  ticket: Ticket,
  contact: Contact,
  deepSeekSettings: IDeepSeek
): Promise<void> => {
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

    const promptSystem = `En las respuestas utiliza el nombre ${contact.name || "Amigo(a)"} para identificar al cliente.\nTu respuesta debe usar como máximo ${deepSeekSettings.maxTokens} tokens.\n${deepSeekSettings.prompt}\n`;

    const messagesDeepSeek: DeepSeekMessage[] = [
      { role: "system", content: promptSystem }
    ];

    // Construir historial de conversación
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

    // Llamar a la API de DeepSeek
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
    aiResponse = cleanDeepSeekResponse(aiResponse);
    console.log("🤖 Respuesta de DeepSeek:", aiResponse);

    // ✅ NUEVA FUNCIONALIDAD: Guardar en variable en lugar de responder
    // ✅ CORRECCIÓN MEJORADA: Asegurar la estructura correcta de dataWebhook
    // ✅ NUEVA FUNCIONALIDAD: Guardar en variable en lugar de responder
    // ✅ CORRECCIÓN CRÍTICA: Parsear JSON antes de guardar
    if (deepSeekSettings.saveResponseTo) {
      console.log(`💾 Guardando respuesta en variable: ${deepSeekSettings.saveResponseTo}`);

      // ✅ CORRECCIÓN: Intentar parsear como JSON si parece ser JSON
      let parsedResponse: any = aiResponse;

      try {
        // Si la respuesta parece ser JSON (empieza con { y termina con })
        if (aiResponse.trim().startsWith('{') && aiResponse.trim().endsWith('}')) {
          parsedResponse = JSON.parse(aiResponse);
          console.log("✅ Respuesta parseada como objeto JSON:", parsedResponse);
        }
      } catch (parseError) {
        console.log("⚠️ La respuesta no es JSON válido, guardando como texto");
        // Mantener como string si no es JSON válido
        parsedResponse = aiResponse;
      }

      // ✅ CORRECCIÓN CRÍTICA: Asegurar que se guarde como objeto, no como string
      let finalValueToSave = parsedResponse;

      // Si parsedResponse es un string que parece JSON, forzar el parseo
      if (typeof parsedResponse === 'string' && parsedResponse.trim().startsWith('{') && parsedResponse.trim().endsWith('}')) {
        try {
          finalValueToSave = JSON.parse(parsedResponse);
          console.log("🔁 Forzando parseo de string a objeto JSON");
        } catch (error) {
          console.log("⚠️ No se pudo forzar el parseo, guardando como string");
        }
      }

      // Obtener dataWebhook actual CORRECTAMENTE - manejar diferentes estructuras
      let currentDataWebhook: any = {};

      // Verificar si ticket.dataWebhook existe y tiene contenido
      if (ticket.dataWebhook) {
        // Si es string, intentar parsear
        if (typeof ticket.dataWebhook === 'string') {
          try {
            currentDataWebhook = JSON.parse(ticket.dataWebhook);
          } catch {
            currentDataWebhook = {};
          }
        }
        // Si es objeto, usar directamente
        else if (typeof ticket.dataWebhook === 'object') {
          currentDataWebhook = { ...ticket.dataWebhook };
        }
      }

      console.log("📝 Estructura actual de dataWebhook:", JSON.stringify(currentDataWebhook, null, 2));
      const currentVariables = currentDataWebhook.variables || {};

      // ✅ CORREGIDO: Guardar el objeto parseado en lugar del string
      const updatedVariables = {
        ...currentVariables,
        [deepSeekSettings.saveResponseTo]: finalValueToSave // ← Ahora es OBJETO
      };

      const newDataWebhook = {
        ...currentDataWebhook,
        variables: updatedVariables
      };

      console.log(`💾 Guardando como ${typeof finalValueToSave}:`, finalValueToSave);

      // Actualizar ticket con nueva variable
      await ticket.update({
        dataWebhook: newDataWebhook
      });

      console.log(`✅ Variable guardada: ${deepSeekSettings.saveResponseTo} =`, finalValueToSave);
      console.log("📝 Estructura completa de dataWebhook:", JSON.stringify(newDataWebhook, null, 2));

      return;
    } else {
      // ✅ COMPORTAMIENTO ORIGINAL: Enviar respuesta al usuario

      // Manejar transferencia si es necesario
      if (aiResponse.includes("Acción: Transferir al sector de atención")) {
        await transferQueue(deepSeekSettings.queueId, ticket, contact);
        aiResponse = aiResponse.replace("Acción: Transferir al sector de atención", "").trim();
      }

      // Enviar respuesta por WhatsApp
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: aiResponse
      });
      await verifyMessage(sentMessage!, ticket, contact);
    }

  } catch (error) {
    console.error("Error con DeepSeek:", error);

    // Solo mostrar error si NO estamos guardando en variable
    if (!deepSeekSettings.saveResponseTo) {
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: "Lo siento, hubo un error procesando tu mensaje. Por favor, intenta nuevamente."
      });
      await verifyMessage(sentMessage!, ticket, contact);
    } else {
      console.error("❌ Error guardando variable de DeepSeek:", error);
      // Opcional: Guardar el error en la variable
      const currentDataWebhook = (ticket.dataWebhook as IDataWebhook) || {};
      const currentVariables = currentDataWebhook.variables || {};

      const updatedVariables = {
        ...currentVariables,
        [deepSeekSettings.saveResponseTo]: `Error: ${error.message}`
      };

      await ticket.update({
        dataWebhook: {
          ...currentDataWebhook,
          variables: updatedVariables
        }
      });
    }
  }
};
// ✅ FUNCIONES AUXILIARES PARA DEEPSEEK
const getBodyMessage = (msg: proto.IWebMessageInfo): string | null => {
  try {
    if (msg.message?.conversation) {
      return msg.message.conversation;
    }
    if (msg.message?.extendedTextMessage?.text) {
      return msg.message.extendedTextMessage.text;
    }
    if (msg.message?.imageMessage?.caption) {
      return msg.message.imageMessage.caption;
    }
    if (msg.message?.videoMessage?.caption) {
      return msg.message.videoMessage.caption;
    }
    if (msg.message?.documentMessage?.caption) {
      return msg.message.documentMessage.caption;
    }
    return null;
  } catch (error) {
    console.error("Error getting body message:", error);
    return null;
  }
};

const getTypeMessage = (msg: proto.IWebMessageInfo): string => {
  if (msg.message?.conversation) return "conversation";
  if (msg.message?.extendedTextMessage) return "extendedTextMessage";
  if (msg.message?.imageMessage) return "imageMessage";
  if (msg.message?.videoMessage) return "videoMessage";
  if (msg.message?.audioMessage) return "audioMessage";
  if (msg.message?.documentMessage) return "documentMessage";
  return "unknown";
};

const transferQueue = async (queueId: number, ticket: Ticket, contact: Contact) => {
  await UpdateTicketService({
    ticketData: { queueId: queueId },
    ticketId: ticket.id,
    companyId: ticket.companyId
  });
};

const verifyMessage = async (msg: proto.IWebMessageInfo, ticket: Ticket, contact: Contact) => {
  const messageData = {
    id: msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body: getBodyMessage(msg) || "",
    fromMe: msg.key.fromMe,
    mediaType: getTypeMessage(msg),
    read: msg.key.fromMe,
    ack: msg.status,
    remoteJid: msg.key.remoteJid,
    dataJson: JSON.stringify(msg)
  };

  await CreateMessageService({ messageData, companyId: ticket.companyId });
};
