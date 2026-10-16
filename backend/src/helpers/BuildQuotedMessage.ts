import Message from "../models/Message";

interface QuotedOptions {
  isForHttp?: boolean;
}

/**
 * Extrae y valida que un thumbnail sea un Buffer JPEG binario válido (menor a 32KB).
 * - Para Baileys local: retorna un Buffer binario puro.
 * - Para Evolution API (HTTP JSON): retorna una cadena Base64 pura.
 */
const extractJpegThumbnail = (rawThumb: any, isForHttp = false): Buffer | string | undefined => {
  try {
    if (!rawThumb) return undefined;
    let buf: Buffer | undefined;

    if (Buffer.isBuffer(rawThumb)) {
      buf = rawThumb;
    } else if (typeof rawThumb === "string") {
      buf = Buffer.from(rawThumb, "base64");
    } else if (rawThumb?.type === "Buffer" && Array.isArray(rawThumb.data)) {
      buf = Buffer.from(rawThumb.data);
    }

    // Validar cabecera mágica JPEG (0xFF, 0xD8)
    if (buf && buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      // Limitar tamaño máximo para WhatsApp (<= 32KB)
      if (buf.length <= 32768) {
        return isForHttp ? buf.toString("base64") : buf;
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
};

/**
 * Construye un payload limpio de mensaje citado (quotedMessage) tanto para Baileys como para Evolution API.
 * Elimina metadatos de streaming/descarga interna (mediaKey, directPath, url, scansSidecar)
 * que provocan errores de decodificación silenciosos en WhatsApp Web.
 */
export const buildCleanQuotedMessage = (
  chatMessages: Message,
  msgFound?: any,
  options?: QuotedOptions
): any => {
  const isForHttp = options?.isForHttp ?? false;
  const mediaType = chatMessages.mediaType;
  const rawMessage = msgFound?.message;

  // 1. Imagen
  if (mediaType === "image" || rawMessage?.imageMessage) {
    const thumb = extractJpegThumbnail(rawMessage?.imageMessage?.jpegThumbnail, isForHttp);
    return {
      imageMessage: {
        caption: chatMessages.body || rawMessage?.imageMessage?.caption || "",
        mimetype: rawMessage?.imageMessage?.mimetype || "image/jpeg",
        ...(thumb ? { jpegThumbnail: thumb } : {})
      }
    };
  }

  // 2. Video
  if (mediaType === "video" || rawMessage?.videoMessage) {
    const thumb = extractJpegThumbnail(rawMessage?.videoMessage?.jpegThumbnail, isForHttp);
    return {
      videoMessage: {
        caption: chatMessages.body || rawMessage?.videoMessage?.caption || "",
        mimetype: rawMessage?.videoMessage?.mimetype || "video/mp4",
        ...(thumb ? { jpegThumbnail: thumb } : {})
      }
    };
  }

  // 3. Audio / PTT (Nota de voz)
  if (mediaType === "audio" || rawMessage?.audioMessage) {
    return {
      audioMessage: {
        mimetype: rawMessage?.audioMessage?.mimetype || "audio/ogg; codecs=opus",
        seconds: rawMessage?.audioMessage?.seconds || 0,
        ptt: rawMessage?.audioMessage?.ptt ?? true
      }
    };
  }

  // 4. Sticker
  if (mediaType === "sticker" || rawMessage?.stickerMessage) {
    return {
      stickerMessage: {
        mimetype: rawMessage?.stickerMessage?.mimetype || "image/webp"
      }
    };
  }

  // 5. Documento / Archivo
  if (mediaType === "document" || rawMessage?.documentMessage) {
    return {
      documentMessage: {
        title: chatMessages.body || rawMessage?.documentMessage?.title || "Documento",
        mimetype: rawMessage?.documentMessage?.mimetype || "application/pdf"
      }
    };
  }

  // 6. Contacto / VCard
  if (mediaType === "contact" || rawMessage?.contactMessage) {
    return {
      contactMessage: {
        displayName: rawMessage?.contactMessage?.displayName || chatMessages.body || "",
        vcard: rawMessage?.contactMessage?.vcard || ""
      }
    };
  }

  // 7. Texto / Conversación estándar
  return {
    conversation: chatMessages.body || rawMessage?.conversation || rawMessage?.extendedTextMessage?.text || ""
  };
};

export default buildCleanQuotedMessage;
