import Whatsapp from "../models/Whatsapp";
import GetWhatsappWbot from "./GetWhatsappWbot";
import fs from "fs";
import path from "path";
import EvolutionApiService from "../services/EvolutionApiServices/EvolutionApiService";
import { resolveLidToPhone } from "./ResolveLidHelper";

import { getMessageOptions } from "../services/WbotServices/SendWhatsAppMedia";

export type MessageData = {
  number: number | string;
  body: string;
  mediaPath?: string;
  mediaUrl?: string;
  documentUrl?: string;
  documentPath?: string;
  companyId?: number;
  fileName?: string;
  mimetype?: string;
  mediaType?: string; // ✅ NUEVO PARÁMETRO
};

// ✅ FUNCIÓN HELPER PARA DETECTAR MIME TYPE MEJORADA
const getMimeType = (filePath: string): string => {
  const extension = path.extname(filePath).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    
    // ✅ TIPOS DE AUDIO
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.opus': 'audio/opus',
    
    // ✅ TIPOS DE VIDEO
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.3gp': 'video/3gpp',
    
    // ✅ TIPOS DE IMAGEN
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
};

export const SendMessage = async (
  whatsapp: Whatsapp,
  messageData: MessageData
): Promise<any> => {
  try {
    const companyIdNumber = messageData.companyId || whatsapp.companyId || 1;
    const evolutionConfig = await EvolutionApiService.getConfig(companyIdNumber);
    const isEvolution = whatsapp.connectionType === "evolution" || (evolutionConfig.enabled && whatsapp.connectionType !== "baileys");

    if (isEvolution) {
      let numStr = messageData.number.toString();
      const cleanNum = numStr.replace(/@.*$/, "").replace(/\D/g, "");
      if (numStr.endsWith("@lid") || cleanNum.length >= 14) {
        const resolved = await resolveLidToPhone(cleanNum, undefined, companyIdNumber);
        if (resolved) {
          numStr = `${resolved}@s.whatsapp.net`;
        } else {
          numStr = `${cleanNum}@lid`;
        }
      }

      // Si tiene archivo o url multimedia
      if (messageData.mediaUrl || messageData.mediaPath || messageData.documentUrl || messageData.documentPath) {
        let mediaTarget = messageData.mediaUrl || messageData.documentUrl;
        let mime = messageData.mimetype;
        const filePath = messageData.mediaPath || messageData.documentPath;

        if (!mediaTarget && filePath && fs.existsSync(filePath)) {
          const fileBuf = fs.readFileSync(filePath);
          mime = mime || getMimeType(filePath);
          mediaTarget = fileBuf.toString("base64");
        }

        if (mediaTarget) {
          const typeDetected = (mime?.split("/")[0] || messageData.mediaType || "document") as any;
          return await EvolutionApiService.sendMediaMessage(whatsapp, numStr, {
            media: mediaTarget,
            mediaType: typeDetected === "image" || typeDetected === "video" || typeDetected === "audio" ? typeDetected : "document",
            caption: messageData.body || "",
            fileName: messageData.fileName,
            mimetype: mime
          });
        }
      }

      // Mensaje de texto estándar
      return await EvolutionApiService.sendTextMessage(whatsapp, numStr, messageData.body);
    }

    const wbot = await GetWhatsappWbot(whatsapp);
    let chatId = `${messageData.number}@s.whatsapp.net`;
    const cleanNum = messageData.number.toString().replace(/@.*$/, "").replace(/\D/g, "");
    if (messageData.number.toString().endsWith("@lid") || cleanNum.length >= 14) {
      const resolved = await resolveLidToPhone(cleanNum, wbot, companyIdNumber);
      if (resolved) {
        chatId = `${resolved}@s.whatsapp.net`;
      } else {
        chatId = `${cleanNum}@lid`;
      }
    }

    if (!messageData.companyId) {
      throw new Error("companyId está indefinido en SendMessage");
    }
    const companyId = messageData.companyId.toString();

    let message;

    // ✅ 1. PRIMERO VERIFICAR DOCUMENTOS POR URL - VERSIÓN MEJORADA
    if (messageData.documentUrl) {
      console.log("📄 Enviando documento por URL:", messageData.documentUrl);
      
      try {
        // ✅ INTENTAR ENVÍO DIRECTO PRIMERO
        message = await wbot.sendMessage(chatId, {
          document: { url: messageData.documentUrl },
          caption: messageData.body || "",
          fileName: messageData.fileName || "documento.pdf",
          mimetype: messageData.mimetype || "application/pdf"
        });
        console.log("✅ Documento enviado exitosamente por URL directa");
        
      } catch (urlError) {
        console.log("❌ Error con URL directa, intentando descarga local:", urlError.message);
        
        // ✅ FALLBACK: DESCARGAR ARCHIVO LOCALMENTE
        try {
          const axios = require('axios');
          
          // Crear directorio temporal
          const tempDir = path.join(__dirname, '..', '..', 'temp');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          // Descargar archivo
          const tempFilePath = path.join(tempDir, `doc_${Date.now()}_${path.basename(messageData.documentUrl)}`);
          
          console.log("📥 Descargando archivo a:", tempFilePath);
          
          const response = await axios({
            method: 'GET',
            url: messageData.documentUrl,
            responseType: 'arraybuffer',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': '*/*',
              'Accept-Encoding': 'identity',
              'Connection': 'keep-alive'
            },
            timeout: 30000
          });
          
          // Guardar archivo localmente
          fs.writeFileSync(tempFilePath, response.data);
          console.log("✅ Archivo descargado:", tempFilePath);
          
          // ✅ VERIFICAR TAMAÑO MÁXIMO (15MB)
          const stats = fs.statSync(tempFilePath);
          if (stats.size > 15 * 1024 * 1024) {
            throw new Error(`Archivo demasiado grande: ${stats.size} bytes. Máximo 15MB permitido.`);
          }

          // Enviar como archivo local
          const documentBuffer = fs.readFileSync(tempFilePath);
          message = await wbot.sendMessage(chatId, {
            document: documentBuffer,
            caption: messageData.body || "",
            fileName: messageData.fileName || path.basename(messageData.documentUrl),
            mimetype: messageData.mimetype || getMimeType(messageData.documentUrl)
          });
          
          console.log("✅ Documento enviado exitosamente desde archivo local");
          
          // Limpiar archivo temporal
          setTimeout(() => {
            try {
              if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
                console.log("🧹 Archivo temporal eliminado:", tempFilePath);
              }
            } catch (cleanError) {
              console.log("⚠️ Error limpiando archivo temporal:", cleanError.message);
            }
          }, 5000);
          
        } catch (downloadError) {
          console.error("❌ Error crítico enviando documento:", downloadError);
          
          // ✅ ENVIAR MENSAJE DE ERROR AL USUARIO
          const errorMsg = await wbot.sendMessage(chatId, {
            text: `❌ No se pudo enviar el documento. Error: ${downloadError.message}`
          });
          
          throw new Error(`No se pudo enviar el documento: ${downloadError.message}`);
        }
      }
    }
    // ✅ 2. LUEGO DOCUMENTOS POR ARCHIVO LOCAL
    else if (messageData.documentPath) {
      console.log("📄 Enviando documento local:", messageData.documentPath);
      
      // ✅ VERIFICAR QUE EL ARCHIVO EXISTA
      if (!fs.existsSync(messageData.documentPath)) {
        throw new Error(`Archivo no encontrado: ${messageData.documentPath}`);
      }

      // ✅ VERIFICAR TAMAÑO MÁXIMO (15MB)
      const stats = fs.statSync(messageData.documentPath);
      if (stats.size > 15 * 1024 * 1024) {
        throw new Error(`Archivo demasiado grande: ${stats.size} bytes. Máximo 15MB permitido.`);
      }

      const documentBuffer = fs.readFileSync(messageData.documentPath);
      message = await wbot.sendMessage(chatId, {
        document: documentBuffer,
        caption: messageData.body || "",
        fileName: messageData.fileName || path.basename(messageData.documentPath),
        mimetype: messageData.mimetype || getMimeType(messageData.documentPath)
      });
    }
    // ✅ 3.1 VIDEOS POR URL - NUEVO CASO
    else if (messageData.mediaUrl && (messageData.mimetype?.includes('video') || messageData.mediaType === 'video')) {
      console.log("🎥 Enviando video por URL:", messageData.mediaUrl);
      message = await wbot.sendMessage(chatId, {
        video: { url: messageData.mediaUrl },
        caption: messageData.body || "",
        fileName: messageData.fileName || "video.mp4",
        mimetype: messageData.mimetype || 'video/mp4'
      });
      console.log("✅ Video por URL enviado exitosamente");
    }
    // ✅ 3.2 IMÁGENES POR URL (caso existente)
    else if (messageData.mediaUrl) {
      console.log("🖼️ Enviando imagen por URL:", messageData.mediaUrl);
      message = await wbot.sendMessage(chatId, {
        image: { url: messageData.mediaUrl },
        caption: messageData.body || "",
        mimetype: "image/jpeg"
      });
    }
    // ✅ 4. VIDEOS LOCALES - NUEVO CASO ESPECÍFICO
    else if (messageData.mediaPath && (messageData.mimetype?.includes('video') || messageData.mediaType === 'video')) {
      console.log("🎥 Enviando video local:", messageData.mediaPath);
      
      // ✅ VERIFICAR QUE EL ARCHIVO EXISTA
      if (!fs.existsSync(messageData.mediaPath)) {
        throw new Error(`Archivo de video no encontrado: ${messageData.mediaPath}`);
      }

      // ✅ VERIFICAR TAMAÑO MÁXIMO (16MB para videos)
      const stats = fs.statSync(messageData.mediaPath);
      if (stats.size > 16 * 1024 * 1024) {
        throw new Error(`Video demasiado grande: ${stats.size} bytes. Máximo 16MB permitido.`);
      }

      const videoBuffer = fs.readFileSync(messageData.mediaPath);
      message = await wbot.sendMessage(chatId, {
        video: videoBuffer,
        caption: messageData.body || "",
        fileName: messageData.fileName || path.basename(messageData.mediaPath),
        mimetype: messageData.mimetype || getMimeType(messageData.mediaPath)
      });
      
      console.log("✅ Video enviado exitosamente como video");
    }
    // ✅ 5. AUDIOS LOCALES - NUEVO CASO ESPECÍFICO
    else if (messageData.mediaPath && (messageData.mimetype?.includes('audio') || messageData.mediaType === 'audio')) {
      console.log("🎵 Enviando audio local:", messageData.mediaPath);
      
      // ✅ VERIFICAR QUE EL ARCHIVO EXISTA
      if (!fs.existsSync(messageData.mediaPath)) {
        throw new Error(`Archivo de audio no encontrado: ${messageData.mediaPath}`);
      }

      // ✅ VERIFICAR TAMAÑO MÁXIMO (16MB para audio)
      const stats = fs.statSync(messageData.mediaPath);
      if (stats.size > 16 * 1024 * 1024) {
        throw new Error(`Audio demasiado grande: ${stats.size} bytes. Máximo 16MB permitido.`);
      }

      const audioBuffer = fs.readFileSync(messageData.mediaPath);
      message = await wbot.sendMessage(chatId, {
        audio: audioBuffer,
        caption: messageData.body || "",
        fileName: messageData.fileName || path.basename(messageData.mediaPath),
        mimetype: messageData.mimetype || getMimeType(messageData.mediaPath),
        ptt: false // ✅ Enviar como audio normal (true para audio de voz)
      });
      
      console.log("✅ Audio enviado exitosamente como audio");
    }
    // ✅ 6. IMÁGENES LOCALES - CASO ESPECÍFICO
    else if (messageData.mediaPath && (messageData.mimetype?.includes('image') || messageData.mediaType === 'image')) {
      console.log("🖼️ Enviando imagen local:", messageData.mediaPath);
      
      if (!fs.existsSync(messageData.mediaPath)) {
        throw new Error(`Archivo de imagen no encontrado: ${messageData.mediaPath}`);
      }

      const imageBuffer = fs.readFileSync(messageData.mediaPath);
      message = await wbot.sendMessage(chatId, {
        image: imageBuffer,
        caption: messageData.body || "",
        fileName: messageData.fileName || path.basename(messageData.mediaPath),
        mimetype: messageData.mimetype || getMimeType(messageData.mediaPath)
      });
      
      console.log("✅ Imagen enviada exitosamente como imagen");
    }
    // ✅ 7. ARCHIVOS MULTIMEDIA LOCALES (caso genérico existente - fallback)
    else if (messageData.mediaPath) {
      console.log("📦 Enviando archivo multimedia local (genérico):", messageData.mediaPath);
      
      const options = await getMessageOptions(
        messageData.body,
        messageData.mediaPath,
        companyId
      );
      if (options) {
        message = await wbot.sendMessage(chatId, {
          ...options
        });
        console.log("✅ Archivo multimedia enviado mediante getMessageOptions");
      }
    }
    // ✅ 8. MENSAJE DE TEXTO
    else {
      const body = `\u200e${messageData.body}`;
      message = await wbot.sendMessage(chatId, { text: body });
      console.log("✅ Mensaje de texto enviado");
    }

    return message;
  } catch (err: any) {
    console.error("❌ Error en SendMessage:", err);
    throw new Error(err);
  }
};