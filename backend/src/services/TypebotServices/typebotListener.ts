import axios, { AxiosRequestConfig } from "axios";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import ffmpegPath from "ffmpeg-static";
import mimeTypes from "mime-types";
import Ticket from "../../models/Ticket";
import QueueIntegrations from "../../models/QueueIntegrations";
import { WASocket, delay, proto } from "@whiskeysockets/baileys";
import { getBodyMessage, verifyMessage } from "../WbotServices/wbotMessageListener";
import { logger } from "../../utils/logger";
import { isNil } from "lodash";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import Contact from "../../models/Contact";
import CreateMessageService from "../MessageServices/CreateMessageService";

type Session = WASocket & {
    id?: number;
};

interface Request {
    wbot: Session;
    msg: proto.IWebMessageInfo;
    ticket: Ticket;
    typebot: QueueIntegrations;
}

const typebotListener = async ({
    wbot,
    msg,
    ticket,
    typebot
}: Request): Promise<void> => {

    if (msg.key.remoteJid === 'status@broadcast') return;

    const { 
        urlN8N: url,
        typebotExpires,
        typebotKeywordFinish,
        typebotKeywordRestart,
        typebotUnknownMessage,
        typebotSlug,
        typebotDelayMessage,
        typebotRestartMessage
    } = typebot;

    if (!url || !typebotSlug) {
        logger.warn(`[Typebot] Integración ID ${typebot.id} (${typebot.name}) no tiene URL o Slug configurado.`);
        return;
    }

    const cleanUrl = url.trim().replace(/\/+$/, "");
    const contact = ticket.contact || (await Contact.findByPk(ticket.contactId));

    // Determinar número real y JID deliverable respetando grupos y usuarios con @lid (alias de privacidad)
    const isGroup = ticket.isGroup || msg.key.remoteJid?.endsWith("@g.us");
    const cleanLid = contact?.lid ? contact.lid.replace(/\D/g, "") : "";
    const rawDigits = (contact?.number || "").replace(/\D/g, "");
    const isLid = !isGroup && (
      msg.key.remoteJid?.endsWith("@lid") ||
      !!cleanLid ||
      rawDigits.length >= 15 ||
      contact?.number?.endsWith("@lid")
    );

    const lidTarget = (msg.key.remoteJid?.endsWith("@lid") ? msg.key.remoteJid.replace("@lid", "").replace(/\D/g, "") : "") || cleanLid || (rawDigits.length >= 15 ? rawDigits : "");

    const targetRemoteJid = isGroup
      ? msg.key.remoteJid
      : (isLid && lidTarget ? `${lidTarget}@lid` : (rawDigits ? `${rawDigits}@s.whatsapp.net` : msg.key.remoteJid));
    const number = rawDigits || msg.key.remoteJid.replace(/\D/g, "");

    const sendAndSaveMessage = async (text: string) => {
        const sentMessage = await wbot.sendMessage(targetRemoteJid, { text });
        if (sentMessage && contact) {
            if (sentMessage.key) {
                sentMessage.key.fromMe = true;
            }
            try {
                await verifyMessage(sentMessage, ticket, contact);
            } catch (errVerify) {
                logger.warn("[Typebot] verifyMessage falló, usando CreateMessageService:", errVerify);
                try {
                    await CreateMessageService({
                        messageData: {
                            id: sentMessage?.key?.id || `typebot_${Date.now()}`,
                            ticketId: ticket.id,
                            contactId: undefined,
                            body: text,
                            fromMe: true,
                            mediaType: "conversation",
                            read: true,
                            ack: 1
                        },
                        companyId: ticket.companyId
                    });
                    await ticket.update({ lastMessage: text });
                } catch (fallbackErr) {
                    logger.error("[Typebot] Error al guardar mensaje saliente:", fallbackErr);
                }
            }
        }
        return sentMessage;
    };

    const extractMediaUrl = (content: any): string | null => {
        if (!content) return null;
        if (typeof content === 'string') {
            const trimmed = content.trim();
            if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/') || trimmed.startsWith('data:')) {
                return trimmed;
            }
            return trimmed;
        }
        if (typeof content === 'object') {
            if (typeof content.url === 'string') return content.url.trim();
            if (typeof content.src === 'string') return content.src.trim();
            if (typeof content.link === 'string') return content.link.trim();
            if (typeof content.mediaUrl === 'string') return content.mediaUrl.trim();
            if (typeof content.embed === 'string') return content.embed.trim();
            if (Array.isArray(content.richText)) {
                for (const block of content.richText) {
                    for (const el of block.children || []) {
                        if (el.url && typeof el.url === 'string') return el.url.trim();
                    }
                }
            }
        }
        return null;
    };

    const downloadMediaBuffer = async (rawUrl: any): Promise<{ buffer: Buffer; mimetype: string } | null> => {
        try {
            const mediaUrl = extractMediaUrl(rawUrl);
            if (!mediaUrl) return null;
            let targetUrl = mediaUrl.trim();
            if (targetUrl.startsWith('/') && cleanUrl) {
                targetUrl = `${cleanUrl}${targetUrl}`;
            }

            // Resolver páginas de Tenor o Giphy si no tienen extensión directa
            if ((targetUrl.includes('tenor.com') || targetUrl.includes('giphy.com')) && !targetUrl.match(/\.(gif|mp4|webp)$/i)) {
                try {
                    const pageRes = await axios.get(targetUrl, {
                        timeout: 10000,
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                    });
                    const html = typeof pageRes.data === 'string' ? pageRes.data : '';
                    const match = html.match(/<meta property=["']og:(?:video:secure_url|video|image)["'] content=["']([^"']+)["']/i);
                    if (match && match[1]) {
                        targetUrl = match[1];
                    }
                } catch (e) {
                    // Continuar con targetUrl original si falla el scrape
                }
            }

            const response = await axios.get(targetUrl, {
                responseType: 'arraybuffer',
                timeout: 35000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                    'Accept': '*/*'
                }
            });
            let contentType = (response.headers['content-type'] || '').split(';')[0].trim();
            if (!contentType || contentType === 'application/octet-stream') {
                const lookedUp = mimeTypes.lookup(targetUrl.split('?')[0]);
                if (lookedUp) contentType = lookedUp;
            }
            return {
                buffer: Buffer.from(response.data),
                mimetype: contentType
            };
        } catch (error: any) {
            logger.warn(`[Typebot] Error al descargar buffer de media (${rawUrl}): ${error?.message || error}`);
            return null;
        }
    };

    const saveMediaLocally = async (
        buffer: Buffer,
        mimetype: string,
        prefix: string = "typebot"
    ): Promise<string | null> => {
        try {
            const folder = path.join(__dirname, "..", "..", "..", "public", `company${ticket.companyId}`);
            if (!fs.existsSync(folder)) {
                fs.mkdirSync(folder, { recursive: true });
                fs.chmodSync(folder, 0o777);
            }

            let ext = ".jpeg";
            if (mimetype.includes("png")) ext = ".png";
            else if (mimetype.includes("webp")) ext = ".webp";
            else if (mimetype.includes("gif")) ext = ".gif";
            else if (mimetype.includes("ogg") || mimetype.includes("opus")) ext = ".ogg";
            else if (mimetype.includes("mp4")) ext = ".mp4";
            else if (mimetype.includes("video") || mimetype.includes("webm")) ext = ".mp4";
            else if (mimetype.includes("mpeg") || mimetype.includes("mp3")) ext = ".mp3";
            else if (mimetype.includes("wav")) ext = ".wav";
            else if (mimetype.includes("pdf")) ext = ".pdf";
            else if (mimetype.includes("word") || mimetype.includes("docx")) ext = ".docx";
            else if (mimetype.includes("sheet") || mimetype.includes("xlsx")) ext = ".xlsx";
            else if (mimetype.includes("presentation") || mimetype.includes("pptx")) ext = ".pptx";
            else if (mimetype.includes("zip")) ext = ".zip";
            else if (mimetype.includes("rar")) ext = ".rar";
            else {
                const lookedUpExt = mimeTypes.extension(mimetype);
                if (lookedUpExt) ext = `.${lookedUpExt}`;
            }

            const fileName = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
            const filePath = path.join(folder, fileName);

            await fs.promises.writeFile(filePath, buffer);
            return fileName;
        } catch (err) {
            logger.error(`[Typebot] Error al guardar archivo localmente:`, err);
            return null;
        }
    };

    const sendMediaMessage = async (message: any) => {
        await safeSubscribe();
        await safePresence('composing');
        await delay(typebotDelayMessage || 1000);
        await safePresence('paused');

        const mediaUrl = extractMediaUrl(message.content) || extractMediaUrl(message);
        if (!mediaUrl) {
            logger.warn("[Typebot] Mensaje de tipo multimedia sin URL válida:", message);
            return;
        }

        let targetUrl = mediaUrl.trim();
        if (targetUrl.startsWith('/') && cleanUrl) {
            targetUrl = `${cleanUrl}${targetUrl}`;
        }

        const downloaded = await downloadMediaBuffer(targetUrl);
        if (!downloaded) {
            logger.warn(`[Typebot] No se pudo descargar el archivo de: ${targetUrl}`);
            return;
        }

        let mimeType = (downloaded.mimetype || '').toLowerCase();
        if (!mimeType || mimeType === 'application/octet-stream') {
            const lookedUp = mimeTypes.lookup(targetUrl.split('?')[0]);
            if (lookedUp) mimeType = lookedUp.toLowerCase();
        }

        const cleanExtUrl = targetUrl.split('?')[0].toLowerCase();
        const msgType = (message.type || '').toLowerCase();

        const isGif = mimeType.includes('gif') ||
                      cleanExtUrl.endsWith('.gif') ||
                      msgType === 'animation' ||
                      msgType === 'gif';

        const isAudio = !isGif && (
            mimeType.includes('audio') ||
            cleanExtUrl.match(/\.(mp3|wav|ogg|opus|m4a|aac|wma|oga)$/i) !== null ||
            msgType === 'audio'
        );

        const isVideo = !isGif && !isAudio && (
            mimeType.includes('video') ||
            cleanExtUrl.match(/\.(mp4|wmv|mov|avi|mkv|webm|3gp)$/i) !== null ||
            msgType === 'video'
        );

        const isImage = !isGif && !isAudio && !isVideo && (
            mimeType.includes('image') ||
            cleanExtUrl.match(/\.(png|jpe?g|webp|bmp|svg)$/i) !== null ||
            msgType === 'image' ||
            msgType === 'picture'
        );

        const companyId = ticket.companyId;
        const folder = path.join(__dirname, "..", "..", "..", "public", `company${companyId}`);
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
            fs.chmodSync(folder, 0o777);
        }

        let sentMessage: any = null;
        let localFileName: string | null = null;
        let dbMediaType = "document";
        let lastMessageText = "Archivo";

        // ==========================================
        // 1. GIF ANIMADO (WhatsApp requiere MP4 con gifPlayback: true)
        // ==========================================
        if (isGif) {
            dbMediaType = "video";
            lastMessageText = "GIF";
            const tempGif = path.join(folder, `temp_${Date.now()}_${Math.floor(Math.random() * 10000)}.gif`);
            const outMp4Name = `typebot_gif_${Date.now()}_${Math.floor(Math.random() * 10000)}.mp4`;
            const outMp4Path = path.join(folder, outMp4Name);

            try {
                await fs.promises.writeFile(tempGif, downloaded.buffer);
                const converted = await new Promise<boolean>((resolve) => {
                    exec(
                        `"${ffmpegPath}" -i "${tempGif}" -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${outMp4Path}" -y`,
                        (error) => {
                            if (error) {
                                logger.warn(`[Typebot] No se pudo convertir GIF a MP4 con ffmpeg: ${error.message}`);
                                resolve(false);
                            } else {
                                resolve(true);
                            }
                        }
                    );
                });

                if (converted && fs.existsSync(outMp4Path)) {
                    localFileName = outMp4Name;
                    sentMessage = await wbot.sendMessage(targetRemoteJid, {
                        video: fs.readFileSync(outMp4Path),
                        gifPlayback: true,
                        mimetype: 'video/mp4',
                        fileName: outMp4Name
                    });
                } else {
                    localFileName = await saveMediaLocally(downloaded.buffer, 'image/gif', 'typebot_gif');
                    sentMessage = await wbot.sendMessage(targetRemoteJid, {
                        video: downloaded.buffer,
                        gifPlayback: true,
                        mimetype: 'video/mp4',
                        fileName: localFileName || 'animacion.mp4'
                    });
                }
            } catch (errGif) {
                logger.warn(`[Typebot] Error enviando GIF como video, fallback:`, errGif);
                localFileName = await saveMediaLocally(downloaded.buffer, 'image/gif', 'typebot_gif');
                sentMessage = await wbot.sendMessage(targetRemoteJid, {
                    document: downloaded.buffer,
                    mimetype: 'image/gif',
                    fileName: 'animacion.gif'
                });
            } finally {
                if (fs.existsSync(tempGif)) {
                    try { fs.unlinkSync(tempGif); } catch (e) {}
                }
            }
        }
        // ==========================================
        // 2. AUDIO (wav, mp3, ogg, opus, wma, aac, etc.)
        // ==========================================
        else if (isAudio) {
            dbMediaType = "audio";
            lastMessageText = "Audio";
            const tempAudio = path.join(folder, `temp_${Date.now()}_${Math.floor(Math.random() * 10000)}.raw`);
            const outOggName = `typebot_audio_${Date.now()}_${Math.floor(Math.random() * 10000)}.ogg`;
            const outOggPath = path.join(folder, outOggName);

            try {
                await fs.promises.writeFile(tempAudio, downloaded.buffer);
                const converted = await new Promise<boolean>((resolve) => {
                    exec(
                        `"${ffmpegPath}" -i "${tempAudio}" -vn -c:a libopus -b:a 128k "${outOggPath}" -y`,
                        (error) => {
                            if (error) {
                                logger.warn(`[Typebot] Conversión a Opus falló: ${error.message}`);
                                resolve(false);
                            } else {
                                resolve(true);
                            }
                        }
                    );
                });

                if (converted && fs.existsSync(outOggPath)) {
                    localFileName = outOggName;
                    sentMessage = await wbot.sendMessage(targetRemoteJid, {
                        audio: fs.readFileSync(outOggPath),
                        mimetype: 'audio/ogg; codecs=opus',
                        fileName: outOggName,
                        ptt: true
                    });
                } else {
                    localFileName = await saveMediaLocally(downloaded.buffer, mimeType || 'audio/mp4', 'typebot_audio');
                    sentMessage = await wbot.sendMessage(targetRemoteJid, {
                        audio: downloaded.buffer,
                        mimetype: mimeType || 'audio/mp4',
                        fileName: localFileName || 'audio.mp3',
                        ptt: false
                    });
                }
            } catch (errAudio) {
                logger.error(`[Typebot] Error enviando audio:`, errAudio);
            } finally {
                if (fs.existsSync(tempAudio)) {
                    try { fs.unlinkSync(tempAudio); } catch (e) {}
                }
            }
        }
        // ==========================================
        // 3. VIDEO (mp4, wmv, mov, avi, mkv, webm, etc.)
        // ==========================================
        else if (isVideo) {
            dbMediaType = "video";
            lastMessageText = "Video";
            const needsConversion = !mimeType.includes('mp4') || cleanExtUrl.match(/\.(wmv|mov|avi|mkv|webm|3gp)$/i) !== null;

            if (needsConversion) {
                const tempVid = path.join(folder, `temp_${Date.now()}_${Math.floor(Math.random() * 10000)}.rawvid`);
                const outMp4Name = `typebot_video_${Date.now()}_${Math.floor(Math.random() * 10000)}.mp4`;
                const outMp4Path = path.join(folder, outMp4Name);

                try {
                    await fs.promises.writeFile(tempVid, downloaded.buffer);
                    const converted = await new Promise<boolean>((resolve) => {
                        exec(
                            `"${ffmpegPath}" -i "${tempVid}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${outMp4Path}" -y`,
                            (error) => {
                                if (error) {
                                    logger.warn(`[Typebot] Conversión a MP4 falló: ${error.message}`);
                                    resolve(false);
                                } else {
                                    resolve(true);
                                }
                            }
                        );
                    });

                    if (converted && fs.existsSync(outMp4Path)) {
                        localFileName = outMp4Name;
                        sentMessage = await wbot.sendMessage(targetRemoteJid, {
                            video: fs.readFileSync(outMp4Path),
                            mimetype: 'video/mp4',
                            fileName: outMp4Name
                        });
                    } else {
                        localFileName = await saveMediaLocally(downloaded.buffer, 'video/mp4', 'typebot_video');
                        sentMessage = await wbot.sendMessage(targetRemoteJid, {
                            video: downloaded.buffer,
                            mimetype: 'video/mp4',
                            fileName: localFileName || 'video.mp4'
                        });
                    }
                } catch (errVid) {
                    logger.error(`[Typebot] Error procesando video:`, errVid);
                } finally {
                    if (fs.existsSync(tempVid)) {
                        try { fs.unlinkSync(tempVid); } catch (e) {}
                    }
                }
            } else {
                localFileName = await saveMediaLocally(downloaded.buffer, 'video/mp4', 'typebot_video');
                sentMessage = await wbot.sendMessage(targetRemoteJid, {
                    video: downloaded.buffer,
                    mimetype: 'video/mp4',
                    fileName: localFileName || 'video.mp4'
                });
            }
        }
        // ==========================================
        // 4. IMÁGENES ESTÁTICAS (png, jpg, jpeg, webp, bmp, svg)
        // ==========================================
        else if (isImage) {
            dbMediaType = "image";
            lastMessageText = "Imagen";
            let mime = mimeType || 'image/jpeg';
            if (mime === 'image/jpg' || mime === 'image/pjpeg') mime = 'image/jpeg';

            localFileName = await saveMediaLocally(downloaded.buffer, mime, 'typebot_img');
            sentMessage = await wbot.sendMessage(targetRemoteJid, {
                image: downloaded.buffer,
                mimetype: mime,
                fileName: localFileName || 'imagen.png'
            });
        }
        // ==========================================
        // 5. DOCUMENTOS Y OTROS ARCHIVOS (pdf, docx, xlsx, zip, etc.)
        // ==========================================
        else {
            dbMediaType = "document";
            lastMessageText = "Documento";
            const parsedUrl = targetUrl.split('?')[0];
            const originalName = path.basename(parsedUrl) || `archivo_${Date.now()}`;
            localFileName = await saveMediaLocally(downloaded.buffer, mimeType || 'application/octet-stream', 'typebot_doc');

            sentMessage = await wbot.sendMessage(targetRemoteJid, {
                document: downloaded.buffer,
                mimetype: mimeType || 'application/octet-stream',
                fileName: originalName
            });
        }

        // Guardar mensaje en base de datos para Clezapp
        if (sentMessage && contact) {
            try {
                await CreateMessageService({
                    messageData: {
                        id: sentMessage?.key?.id || `typebot_media_${Date.now()}`,
                        ticketId: ticket.id,
                        contactId: undefined,
                        body: localFileName || targetUrl,
                        fromMe: true,
                        mediaUrl: localFileName || targetUrl,
                        mediaType: dbMediaType,
                        read: true,
                        ack: 1
                    },
                    companyId: ticket.companyId
                });
                await ticket.update({ lastMessage: lastMessageText });
            } catch (errSave) {
                logger.error("[Typebot] Error al guardar mensaje multimedia saliente en BD:", errSave);
            }
        }
    };

    const safePresence = async (presence: 'composing' | 'paused') => {
        try {
            if (typeof wbot?.sendPresenceUpdate === 'function') {
                await wbot.sendPresenceUpdate(presence, targetRemoteJid);
            }
        } catch (e) {
            // Ignorar fallas de presencia
        }
    };

    const safeSubscribe = async () => {
        try {
            if (typeof wbot?.presenceSubscribe === 'function') {
                await wbot.presenceSubscribe(targetRemoteJid);
            }
        } catch (e) {
            // Ignorar
        }
    };

    let body = getBodyMessage(msg);

    async function createSession(msg: proto.IWebMessageInfo, typebot: QueueIntegrations, number: string) {
        try {
            const reqData = JSON.stringify({
                "isStreamEnabled": true,
                "message": "string",
                "resultId": "string",
                "isOnlyRegistering": false,
                "prefilledVariables": {
                    "number": number,
                    "pushName": msg.pushName || ""
                },
            });

            const config: AxiosRequestConfig = {
                method: 'post',
                maxBodyLength: Infinity,
                url: `${cleanUrl}/api/v1/typebots/${encodeURIComponent(typebotSlug)}/startChat`,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                data: reqData
            };

            const request = await axios.request(config);
            logger.info(`[Typebot] Sesión creada con éxito para ${number}. Mensajes recibidos: ${request.data?.messages?.length || 0}`);
            return request.data;

        } catch (err) {
            logger.error("❌ ERROR AL CREAR SESIÓN DEL TYPEBOT: ", err);
            throw err;
        }
    }

    let sessionId: string;
    let dataStart: any;
    let status = false;
    
    try {
        const dataLimite = new Date();
        dataLimite.setMinutes(dataLimite.getMinutes() - Number(typebotExpires));

        if (typebotExpires > 0 && ticket.updatedAt < dataLimite) {
            await ticket.update({
                typebotSessionId: null,
                isBot: true
            });
            await ticket.reload();
        }

        if (isNil(ticket.typebotSessionId)) {            
            dataStart = await createSession(msg, typebot, number);
            sessionId = dataStart?.sessionId;
            status = true;
            await ticket.update({
                typebotSessionId: sessionId,
                typebotStatus: true,
                useIntegration: true,
                integrationId: typebot.id
            });
        } else {
            sessionId = ticket.typebotSessionId;
            status = ticket.typebotStatus;
        }

        if (!status || !sessionId) return;

        if (body !== typebotKeywordFinish && body !== typebotKeywordRestart) {
            let requestContinue: any;
            let messages: any[];
            let input: any;
            
            if (dataStart?.messages?.length === 0 || dataStart === undefined) {
                const reqData = JSON.stringify({
                    "message": body
                });

                const config: AxiosRequestConfig = {
                    method: 'post',
                    maxBodyLength: Infinity,
                    url: `${cleanUrl}/api/v1/sessions/${encodeURIComponent(sessionId)}/continueChat`,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    data: reqData
                };
                
                requestContinue = await axios.request(config);
                messages = requestContinue.data?.messages;
                input = requestContinue.data?.input;
                logger.info(`[Typebot] Continuación para ${number}. Mensajes devueltos: ${messages?.length || 0}`);
            } else {
                messages = dataStart?.messages;
                input = dataStart?.input;
            }

            if (messages?.length === 0) {
                if (typebotUnknownMessage) {
                    await sendAndSaveMessage(typebotUnknownMessage);
                }
            } else if (messages) {
                for (const message of messages) {
                    if (message.type === 'text') {
                        let formattedText = '';
                        let linkPreview = false;
                        
                        if (message.content?.richText) {
                            for (const richText of message.content.richText) {
                                for (const element of richText.children) {
                                    let text = '';

                                    if (element.text) {
                                        text = element.text;
                                    }
                                    
                                    if (element.type && element.children) {
                                        for (const subelement of element.children) {
                                            let text = '';

                                            if (subelement.text) {
                                                text = subelement.text;
                                            }

                                            if (subelement.type && subelement.children) {
                                                for (const subelement2 of subelement.children) {
                                                    let text = '';

                                                    if (subelement2.text) {
                                                        text = subelement2.text;
                                                    }

                                                    if (subelement2.bold) {
                                                        text = `*${text}*`;
                                                    }
                                                    if (subelement2.italic) {
                                                        text = `_${text}_`;
                                                    }
                                                    if (subelement2.underline) {
                                                        text = `~${text}~`;
                                                    }
                                                    if (subelement2.url) {
                                                        const linkText = subelement2.children[0]?.text || subelement2.url;
                                                        text = `[${linkText}](${subelement2.url})`;
                                                        linkPreview = true;
                                                    }
                                                    formattedText += text;
                                                }
                                            }
                                            
                                            if (subelement.bold) {
                                                text = `*${text}*`;
                                            }
                                            if (subelement.italic) {
                                                text = `_${text}_`;
                                            }
                                            if (subelement.underline) {
                                                text = `~${text}~`;
                                            }
                                            if (subelement.url) {
                                                const linkText = subelement.children[0]?.text || subelement.url;
                                                text = `[${linkText}](${subelement.url})`;
                                                linkPreview = true;
                                            }
                                            formattedText += text;
                                        }
                                    }

                                    if (element.bold) {
                                        text = `*${text}*`;
                                    }
                                    if (element.italic) {
                                        text = `_${text}_`;
                                    }
                                    if (element.underline) {
                                        text = `~${text}~`;
                                    }

                                    if (element.url) {
                                        const linkText = element.children[0]?.text || element.url;
                                        text = `[${linkText}](${element.url})`;
                                        linkPreview = true;
                                    }

                                    formattedText += text;
                                }
                                formattedText += '\n';
                            }
                        }
                        
                        formattedText = formattedText.replace('**', '').replace(/\n$/, '');

                        if (formattedText === "Invalid message. Please, try again.") {
                            formattedText = typebotUnknownMessage || formattedText;
                        }

                        if (formattedText.startsWith("#")) {
                            let gatilho = formattedText.replace("#", "");

                            try {
                                let jsonGatilho = JSON.parse(gatilho);

                                if (jsonGatilho.stopBot && isNil(jsonGatilho.userId) && isNil(jsonGatilho.queueId)) {
                                    await ticket.update({
                                        useIntegration: false,
                                        isBot: false
                                    });
                                    return;
                                }

                                if (!isNil(jsonGatilho.queueId) && jsonGatilho.queueId > 0 && isNil(jsonGatilho.userId)) {
                                    await UpdateTicketService({
                                        ticketData: {
                                            queueId: jsonGatilho.queueId,
                                            chatbot: false,
                                            useIntegration: false,
                                            integrationId: null
                                        },
                                        ticketId: ticket.id,
                                        companyId: ticket.companyId
                                    });
                                    return;
                                }

                                if (!isNil(jsonGatilho.queueId) && jsonGatilho.queueId > 0 && !isNil(jsonGatilho.userId) && jsonGatilho.userId > 0) {
                                    await UpdateTicketService({
                                        ticketData: {
                                            queueId: jsonGatilho.queueId,
                                            userId: jsonGatilho.userId,
                                            chatbot: false,
                                            useIntegration: false,
                                            integrationId: null
                                        },
                                        ticketId: ticket.id,
                                        companyId: ticket.companyId
                                    });
                                    return;
                                }
                            } catch (err) {
                                throw err;
                            }
                        }

                        await safeSubscribe();
                        await safePresence('composing');
                        await delay(typebotDelayMessage || 1000);
                        await safePresence('paused');

                        await sendAndSaveMessage(formattedText);
                    } else {
                        await sendMediaMessage(message);
                    }
                }
                }
                
                if (input) {
                    if (input.type === 'choice input') {
                        let formattedText = '';
                        const items = input.items || [];
                        for (const item of items) {
                            formattedText += `▶️ ${item.content}\n`;
                        }
                        formattedText = formattedText.replace(/\n$/, '');
                        
                        await safeSubscribe();
                        await safePresence('composing');
                        await delay(typebotDelayMessage || 1000);
                        await safePresence('paused');
                        
                        await sendAndSaveMessage(formattedText);
                    }
                }
            }
        
        if (body === typebotKeywordRestart) {
            await ticket.update({
                isBot: true,
                typebotSessionId: null
            });
            await ticket.reload();
            await sendAndSaveMessage(typebotRestartMessage || "Reiniciando...");
        }
        
        if (body === typebotKeywordFinish) {
            await UpdateTicketService({
                ticketData: {
                    status: "closed",
                    useIntegration: false,
                    integrationId: null                   
                },
                ticketId: ticket.id,
                companyId: ticket.companyId
            });
            return;
        }
    } catch (error) {
        logger.error("Error on typebotListener: ", error);
        await ticket.update({
            typebotSessionId: null
        });
        throw error;
    }
}

export default typebotListener;