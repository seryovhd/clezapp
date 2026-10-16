import path from "path";
import mimeTypes from "mime-types";
import Setting from "../../models/Setting";
import Whatsapp from "../../models/Whatsapp";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";

export interface EvolutionConfig {
  url: string;
  apiKey: string;
  enabled: boolean;
}

export class EvolutionApiService {
  private static configCache = new Map<number, { config: EvolutionConfig; expiresAt: number }>();

  /**
   * Obtiene la configuración de Evolution API desde la tabla Settings o .env (con caché en memoria)
   */
  public static async getConfig(companyId: number = 1): Promise<EvolutionConfig> {
    const cached = this.configCache.get(companyId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.config;
    }

    try {
      const urlSetting = await Setting.findOne({
        where: { key: "evolutionApiUrl", companyId }
      });
      const apiKeySetting = await Setting.findOne({
        where: { key: "evolutionApiKey", companyId }
      });
      const enabledSetting = await Setting.findOne({
        where: { key: "evolutionApiEnabled", companyId }
      });

      // Fallback a empresa 1 si no está configurado en una empresa secundaria
      let url = urlSetting?.value?.trim() || "";
      let apiKey = apiKeySetting?.value?.trim() || "";
      let enabledValue = enabledSetting?.value || "";

      if (!url && companyId !== 1) {
        const globalUrl = await Setting.findOne({
          where: { key: "evolutionApiUrl", companyId: 1 }
        });
        url = globalUrl?.value?.trim() || "";
      }

      if (!apiKey && companyId !== 1) {
        const globalKey = await Setting.findOne({
          where: { key: "evolutionApiKey", companyId: 1 }
        });
        apiKey = globalKey?.value?.trim() || "";
      }

      if (!enabledValue && companyId !== 1) {
        const globalEnabled = await Setting.findOne({
          where: { key: "evolutionApiEnabled", companyId: 1 }
        });
        enabledValue = globalEnabled?.value || "";
      }

      // Fallback a variables de entorno si aún no hay en BD
      if (!url) {
        url = process.env.EVOLUTION_API_URL || "http://localhost:8080";
      }
      if (!apiKey) {
        apiKey = process.env.EVOLUTION_API_KEY || "";
      }
      const enabled = enabledValue ? enabledValue === "enabled" : (process.env.EVOLUTION_API_ENABLED !== "false");

      // Remover barra final de la URL si existe
      url = url.replace(/\/+$/, "");

      const result: EvolutionConfig = { url, apiKey, enabled };
      this.configCache.set(companyId, { config: result, expiresAt: Date.now() + 30000 }); // Caché de 30 segundos
      return result;
    } catch (error) {
      logger.error("Error al obtener la configuración de Evolution API:", error);
      return {
        url: (process.env.EVOLUTION_API_URL || "http://localhost:8080").replace(/\/+$/, ""),
        apiKey: process.env.EVOLUTION_API_KEY || "",
        enabled: true
      };
    }
  }

  /**
   * Genera o retorna el nombre de instancia único para Evolution API
   */
  public static getInstanceName(whatsapp: Whatsapp): string {
    if (whatsapp.instanceName && whatsapp.instanceName.trim() !== "") {
      return whatsapp.instanceName.trim();
    }
    // Formato normalizado: chasap_c{companyId}_w{whatsappId}
    const cleanName = (whatsapp.name || `wa_${whatsapp.id}`)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .substring(0, 20);
    const companyId = whatsapp.companyId || 1;
    return `chasap_${companyId}_${whatsapp.id}_${cleanName}`;
  }

  /**
   * Realiza peticiones HTTP al servidor Evolution API con headers de autenticación
   */
  public static async request(
    companyId: number,
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: any
  ): Promise<any> {
    const config = await this.getConfig(companyId);

    if (!config.url) {
      throw new AppError("EVOLUTION_URL_NOT_CONFIGURED", 400);
    }

    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const fullUrl = `${config.url}${cleanEndpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (config.apiKey) {
      headers["apikey"] = config.apiKey;
    }

    const options: RequestInit = {
      method,
      headers
    };

    if (body && (method === "POST" || method === "PUT" || method === "DELETE")) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(fullUrl, options);
      const text = await response.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        logger.warn(`Evolution API HTTP Error [${response.status}] ${method} ${fullUrl}: ${text}`);
      }

      return data;
    } catch (error: any) {
      logger.error(`Error de red al conectar con Evolution API (${fullUrl}):`, error?.message || error);
      throw new AppError(`ERR_EVOLUTION_CONNECTION: ${error?.message || "Servidor no disponible"}`, 502);
    }
  }

  /**
   * Crea una nueva instancia en Evolution API v2 y configura el webhook
   */
  public static async createInstance(whatsapp: Whatsapp): Promise<any> {
    const instanceName = this.getInstanceName(whatsapp);
    const backendUrl = (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/+$/, "");
    const webhookUrl = `${backendUrl}/evolution/webhook/${whatsapp.companyId}/${whatsapp.id}`;

    logger.info(`[Evolution] Creando instancia: ${instanceName} con webhook: ${webhookUrl}`);

    const payload = {
      instanceName,
      token: whatsapp.token || "",
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      webhook: {
        url: webhookUrl,
        byEvents: false,
        base64: true,
        events: [
          "APPLICATION_STARTUP",
          "QRCODE_UPDATED",
          "MESSAGES_SET",
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "MESSAGES_DELETE",
          "SEND_MESSAGE",
          "CONNECTION_UPDATE",
          "CALL"
        ]
      }
    };

    let result: any = null;
    try {
      result = await this.request(whatsapp.companyId, "/instance/create", "POST", payload);
    } catch (err: any) {
      logger.warn(`[Evolution] Instancia ${instanceName} create retorno error o ya existe: ${err?.message}`);
    }

    // Guardar instanceName en la base de datos
    await whatsapp.update({
      instanceName,
      connectionType: "evolution"
    });

    // Asegurar webhook en Evolution v2
    try {
      await this.setWebhook(whatsapp);
    } catch (err: any) {
      logger.warn(`[Evolution] Error actualizando webhook: ${err?.message}`);
    }

    return result;
  }

  /**
   * Configura o actualiza el webhook de una instancia en Evolution API
   */
  public static async setWebhook(whatsapp: Whatsapp): Promise<any> {
    const instanceName = this.getInstanceName(whatsapp);
    const backendUrl = (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/+$/, "");
    const webhookUrl = `${backendUrl}/evolution/webhook/${whatsapp.companyId}/${whatsapp.id}`;

    const payload = {
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: false,
        base64: true,
        events: [
          "APPLICATION_STARTUP",
          "QRCODE_UPDATED",
          "MESSAGES_SET",
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "MESSAGES_DELETE",
          "SEND_MESSAGE",
          "CONNECTION_UPDATE",
          "CALL"
        ]
      }
    };

    return await this.request(
      whatsapp.companyId,
      `/webhook/set/${encodeURIComponent(instanceName)}`,
      "POST",
      payload
    );
  }

  /**
   * Conecta la instancia y obtiene el código QR
   */
  public static async connectInstance(whatsapp: Whatsapp): Promise<any> {
    const instanceName = this.getInstanceName(whatsapp);

    // Primero verificamos el estado
    const state = await this.getConnectionState(whatsapp);
    if (state?.instance?.state === "open" || state?.state === "open") {
      logger.info(`[Evolution] La instancia ${instanceName} ya está conectada (open)`);
      return { state: "open" };
    }

    logger.info(`[Evolution] Solicitando conexión / QR para ${instanceName}`);
    const result = await this.request(
      whatsapp.companyId,
      `/instance/connect/${encodeURIComponent(instanceName)}`,
      "GET"
    );

    return result;
  }

  /**
   * Obtiene el estado de conexión de la instancia
   */
  public static async getConnectionState(whatsapp: Whatsapp): Promise<any> {
    const instanceName = this.getInstanceName(whatsapp);
    return await this.request(
      whatsapp.companyId,
      `/instance/connectionState/${encodeURIComponent(instanceName)}`,
      "GET"
    );
  }

  /**
   * Desconecta (logout) de WhatsApp
   */
  public static async logoutInstance(whatsapp: Whatsapp): Promise<any> {
    const instanceName = this.getInstanceName(whatsapp);
    return await this.request(
      whatsapp.companyId,
      `/instance/logout/${encodeURIComponent(instanceName)}`,
      "DELETE"
    );
  }

  /**
   * Elimina la instancia de Evolution API
   */
  public static async deleteInstance(whatsapp: Whatsapp): Promise<any> {
    const instanceName = this.getInstanceName(whatsapp);
    return await this.request(
      whatsapp.companyId,
      `/instance/delete/${encodeURIComponent(instanceName)}`,
      "DELETE"
    );
  }

  /**
   * Limpia el número o JID para enviarlo a Evolution API v2
   * Para grupos mantiene @g.us; para chats individuales devuelve solo los dígitos (ej. 51999999999).
   */
  public static cleanNumberForEvolution(number: string): string {
    if (!number) return "";
    const trimmed = number.trim();
    if (trimmed.endsWith("@g.us") || trimmed.endsWith("@lid")) {
      return trimmed;
    }
    const digitsOnly = trimmed.replace(/@.*$/, "").replace(/[^0-9]/g, "");
    if (digitsOnly.length >= 15) {
      return `${digitsOnly}@lid`;
    }
    return digitsOnly;
  }

  /**
   * Envía un mensaje de texto a través de Evolution API v2
   */
  public static async sendTextMessage(
    whatsapp: Whatsapp,
    number: string,
    text: string,
    options?: { quoted?: any; quotedMessageId?: string; delay?: number }
  ): Promise<any> {
    const instanceName = this.getInstanceName(whatsapp);
    const cleanNumber = this.cleanNumberForEvolution(number);

    const payload: any = {
      number: cleanNumber,
      text,
      delay: options?.delay ?? 0
    };

    if (options?.quoted) {
      payload.quoted = options.quoted;
    } else if (options?.quotedMessageId) {
      payload.quoted = {
        key: {
          id: options.quotedMessageId
        }
      };
    }

    return await this.request(
      whatsapp.companyId,
      `/message/sendText/${encodeURIComponent(instanceName)}`,
      "POST",
      payload
    );
  }

  /**
   * Actualiza/edita un mensaje de texto en Evolution API
   */
  public static async updateMessage(
    whatsapp: Whatsapp,
    number: string,
    messageId: string,
    text: string,
    remoteJid?: string
  ): Promise<any> {
    const instanceName = this.getInstanceName(whatsapp);
    const cleanNumber = this.cleanNumberForEvolution(number);
    const jid = remoteJid || (number.includes("@") ? number : `${cleanNumber}@s.whatsapp.net`);

    const payload = {
      number: cleanNumber,
      text,
      key: {
        remoteJid: jid,
        fromMe: true,
        id: messageId
      }
    };

    try {
      return await this.request(
        whatsapp.companyId,
        `/chat/updateMessage/${encodeURIComponent(instanceName)}`,
        "POST",
        payload
      );
    } catch (err) {
      return await this.request(
        whatsapp.companyId,
        `/message/update/${encodeURIComponent(instanceName)}`,
        "POST",
        payload
      );
    }
  }

  /**
   * Envía un archivo multimedia (imagen, video, audio o documento) a través de Evolution API v2
   */
  public static async sendMediaMessage(
    whatsapp: Whatsapp,
    number: string,
    mediaData: {
      media: string;
      mediaType: "image" | "video" | "audio" | "document";
      caption?: string;
      fileName?: string;
      mimetype?: string;
      gifPlayback?: boolean;
    },
    options?: { quoted?: any; quotedMessageId?: string; delay?: number }
  ): Promise<any> {
    const instanceName = this.getInstanceName(whatsapp);
    const cleanNumber = this.cleanNumberForEvolution(number);
    const isUrl = typeof mediaData.media === "string" && (mediaData.media.startsWith("http://") || mediaData.media.startsWith("https://"));
    
    // Evolution API v2 usa el validador @IsUrlOrBase64() de class-validator, el cual requiere:
    // 1. Una URL válida (http/https), O
    // 2. Base64 PURO (sin prefijo "data:image/...;base64,")
    const pureMedia = isUrl
      ? mediaData.media.trim()
      : mediaData.media.replace(/^data:[^;]+;base64,/, "").trim();

    const rawMime = mediaData.mimetype || (
      mediaData.mediaType === "image" ? "image/jpeg" :
      mediaData.mediaType === "video" ? "video/mp4" :
      mediaData.mediaType === "audio" ? "audio/ogg" : "application/octet-stream"
    );
    const mime = rawMime.split(";")[0].trim();

    // Si es audio de voz (PTT), Evolution API v2 tiene un endpoint dedicado que lo envía como nota de voz
    if (mediaData.mediaType === "audio") {
      const audioPayload = {
        number: cleanNumber,
        audio: pureMedia,
        delay: 0
      };

      try {
        logger.info(`[Evolution] Enviando sendWhatsAppAudio a ${cleanNumber}`);
        const audioRes = await this.request(
          whatsapp.companyId,
          `/message/sendWhatsAppAudio/${encodeURIComponent(instanceName)}`,
          "POST",
          audioPayload
        );
        logger.info(`[Evolution] Resultado sendWhatsAppAudio a ${cleanNumber}: ${JSON.stringify(audioRes)}`);
        if (audioRes && !audioRes.error && audioRes.status !== 400) {
          return audioRes;
        }
      } catch (e) {
        logger.warn("[Evolution] Fallback de sendWhatsAppAudio a sendMedia:", e);
      }
    }

    let defaultExt = ".bin";
    if (mime.includes("png")) defaultExt = ".png";
    else if (mime.includes("jpeg") || mime.includes("jpg")) defaultExt = ".jpg";
    else if (mime.includes("webp")) defaultExt = ".webp";
    else if (mime.includes("gif")) defaultExt = ".gif";
    else if (mime.includes("ogg") || mime.includes("opus")) defaultExt = ".ogg";
    else if (mime.includes("mp4")) defaultExt = ".mp4";
    else if (mime.includes("mpeg") || mime.includes("mp3")) defaultExt = ".mp3";
    else if (mime.includes("wav")) defaultExt = ".wav";
    else if (mime.includes("pdf")) defaultExt = ".pdf";
    else {
      const lookedUp = mimeTypes.extension(mime);
      if (lookedUp) defaultExt = `.${lookedUp}`;
      else if (mediaData.mediaType === "image") defaultExt = ".jpg";
      else if (mediaData.mediaType === "video") defaultExt = ".mp4";
      else if (mediaData.mediaType === "audio") defaultExt = ".ogg";
    }

    let fileName = mediaData.fileName || (mediaData.gifPlayback ? "animacion.mp4" : `archivo_${Date.now()}`);
    if (!path.extname(fileName)) {
      fileName = `${fileName}${defaultExt}`;
    }

    const companyId = whatsapp.companyId || 1;
    const payload: any = {
      number: cleanNumber,
      mediatype: mediaData.mediaType,
      mimetype: mime,
      caption: mediaData.caption || "",
      media: pureMedia,
      fileName
    };

    if (mediaData.gifPlayback) {
      payload.gifPlayback = true;
    }

    if (options?.quoted) {
      payload.quoted = options.quoted;
    } else if (options?.quotedMessageId) {
      payload.quoted = {
        key: {
          id: options.quotedMessageId
        }
      };
    }

    logger.info(`[Evolution] Enviando sendMedia a ${cleanNumber} (${mediaData.mediaType}): mime=${mime}, isUrl=${isUrl}, mediaLength=${pureMedia.length}`);
    const res = await this.request(
      companyId,
      `/message/sendMedia/${encodeURIComponent(instanceName)}`,
      "POST",
      payload
    );
    logger.info(`[Evolution] Respuesta sendMedia de ${cleanNumber}: ${JSON.stringify(res)}`);
    return res;
  }

  /**
   * Marca mensajes como leídos en Evolution API v2 (sincronizando WhatsApp Móvil y Web)
   */
  public static async markMessagesAsRead(
    whatsapp: Whatsapp,
    messages: Array<{ id: string; fromMe?: boolean; remoteJid: string }>
  ): Promise<any> {
    try {
      if (!messages || messages.length === 0) return;
      const instanceName = this.getInstanceName(whatsapp);
      const payload = {
        readMessages: messages.map(m => ({
          id: m.id,
          fromMe: m.fromMe ?? false,
          remoteJid: m.remoteJid
        }))
      };

      try {
        return await this.request(
          whatsapp.companyId,
          `/chat/markMessageAsRead/${encodeURIComponent(instanceName)}`,
          "POST",
          payload
        );
      } catch (err: any) {
        return await this.request(
          whatsapp.companyId,
          `/chat/readMessages/${encodeURIComponent(instanceName)}`,
          "POST",
          payload
        );
      }
    } catch (error: any) {
      logger.warn(`[Evolution] Error marcando mensajes como leídos: ${error?.message || error}`);
    }
  }

  /**
   * Rechaza una llamada entrante en Evolution API v2
   */
  public static async rejectCall(whatsapp: Whatsapp, callId: string, from: string): Promise<any> {
    try {
      const instanceName = this.getInstanceName(whatsapp);
      const cleanNumber = this.cleanNumberForEvolution(from);
      return await this.request(
        whatsapp.companyId,
        `/chat/rejectCall/${encodeURIComponent(instanceName)}`,
        "POST",
        { callId, from: cleanNumber }
      );
    } catch (err: any) {
      logger.warn(`[Evolution] No se pudo rechazar llamada: ${err?.message}`);
    }
  }

  /**
   * Elimina un mensaje para todos en WhatsApp vía Evolution API v2
   */
  public static async deleteMessage(
    whatsapp: Whatsapp,
    message: Message
  ): Promise<any> {
    try {
      const instanceName = this.getInstanceName(whatsapp);
      const companyId = whatsapp.companyId || 1;

      let remoteJid = message.remoteJid;
      if (!remoteJid || remoteJid.includes("null")) {
        const ticket = message.ticket || await Ticket.findByPk(message.ticketId, { include: ["contact"] });
        remoteJid = ticket?.isGroup ? `${ticket?.contact?.number}@g.us` : `${ticket?.contact?.number}@s.whatsapp.net`;
      }

      if (remoteJid?.endsWith("@lid")) {
        const ticket = message.ticket || await Ticket.findByPk(message.ticketId, { include: ["contact"] });
        const cleanNumber = ticket?.contact?.number ? ticket.contact.number.replace(/\D/g, "") : "";
        if (cleanNumber && !ticket?.isGroup) {
          remoteJid = `${cleanNumber}@s.whatsapp.net`;
        }
      }

      const payload: any = {
        id: message.id,
        remoteJid,
        fromMe: message.fromMe
      };

      if (message.participant && typeof message.participant === "string" && message.participant.trim() !== "") {
        payload.participant = message.participant;
      }

      logger.info(`[Evolution] Solicitando deleteMessageForEveryone para ID: ${message.id} en ${remoteJid}`);
      try {
        const res = await this.request(
          companyId,
          `/chat/deleteMessageForEveryone/${encodeURIComponent(instanceName)}`,
          "DELETE",
          payload
        );
        logger.info(`[Evolution] Mensaje ${message.id} revocado para todos con éxito: ${JSON.stringify(res)}`);
        return res;
      } catch (err: any) {
        logger.warn(`[Evolution] Error en deleteMessageForEveryone (${err?.message}), probando endpoint alternativo...`);
        const altRes = await this.request(
          companyId,
          `/message/delete/${encodeURIComponent(instanceName)}`,
          "DELETE",
          payload
        );
        logger.info(`[Evolution] Mensaje ${message.id} eliminado con endpoint alternativo: ${JSON.stringify(altRes)}`);
        return altRes;
      }
    } catch (err: any) {
      logger.warn(`[Evolution] No se pudo eliminar el mensaje en WhatsApp vía Evolution API: ${err?.message}`);
    }
  }

  /**
   * Prueba la conectividad con el servidor de Evolution API
   */
  public static async testConnection(url: string, apiKey: string): Promise<{ success: boolean; message: string; instances?: any }> {
    try {
      const cleanUrl = url.replace(/\/+$/, "");
      const fullUrl = `${cleanUrl}/instance/fetchInstances`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (apiKey) {
        headers["apikey"] = apiKey;
      }

      const response = await fetch(fullUrl, {
        method: "GET",
        headers
      });

      if (!response.ok) {
        return {
          success: false,
          message: `El servidor respondió con código HTTP ${response.status} (${response.statusText}). Verifica tu API Key.`
        };
      }

      const data = await response.json();
      return {
        success: true,
        message: "¡Conexión exitosa con Evolution API v2!",
        instances: data
      };
    } catch (error: any) {
      return {
        success: false,
        message: `No se pudo conectar al servidor Evolution API: ${error?.message || "Error desconocido"}`
      };
    }
  }
}

export default EvolutionApiService;
