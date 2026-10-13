import axios, { AxiosRequestConfig } from "axios";
import Ticket from "../../models/Ticket";
import QueueIntegrations from "../../models/QueueIntegrations";
import { WASocket, delay, proto } from "@whiskeysockets/baileys";
import { getBodyMessage } from "../WbotServices/wbotMessageListener";
import { logger } from "../../utils/logger";
import { isNil } from "lodash";
import UpdateTicketService from "../TicketServices/UpdateTicketService";

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
    const number = msg.key.remoteJid.replace(/\D/g, '');

    const safePresence = async (presence: 'composing' | 'paused') => {
        try {
            if (typeof wbot?.sendPresenceUpdate === 'function') {
                await wbot.sendPresenceUpdate(presence, msg.key.remoteJid);
            }
        } catch (e) {
            // Ignorar fallas de presencia
        }
    };

    const safeSubscribe = async () => {
        try {
            if (typeof wbot?.presenceSubscribe === 'function') {
                await wbot.presenceSubscribe(msg.key.remoteJid);
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
                    await wbot.sendMessage(msg.key.remoteJid, { text: typebotUnknownMessage });
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

                        await wbot.sendMessage(msg.key.remoteJid, { text: formattedText });
                    }

                    if (message.type === 'audio') {
                        await safeSubscribe();
                        await safePresence('composing');
                        await delay(typebotDelayMessage || 1000);
                        await safePresence('paused');
                        
                        const media = {
                            audio: {
                                url: message.content.url,
                                mimetype: 'audio/mp4',
                                ptt: true
                            },
                        };
                        await wbot.sendMessage(msg.key.remoteJid, media);
                    }

                    if (message.type === 'image') {
                        await safeSubscribe();
                        await safePresence('composing');
                        await delay(typebotDelayMessage || 1000);
                        await safePresence('paused');
                        
                        const media = {
                            image: {
                                url: message.content.url,
                            },
                        };
                        await wbot.sendMessage(msg.key.remoteJid, media);
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
                        
                        await wbot.sendMessage(msg.key.remoteJid, { text: formattedText });
                    }
                }
            }
        }
        
        if (body === typebotKeywordRestart) {
            await ticket.update({
                isBot: true,
                typebotSessionId: null
            });
            await ticket.reload();
            await wbot.sendMessage(msg.key.remoteJid, { text: typebotRestartMessage || "Reiniciando..." });
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