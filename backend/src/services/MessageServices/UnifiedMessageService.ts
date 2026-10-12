import Whatsapp from "../../models/Whatsapp";
import { getWbot } from "../../libs/wbot";
import { WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import { logger } from "../../utils/logger";

interface SendMessageResult {
    success: boolean;
    messageId?: string;
    error?: string;
    type: string;
}

export class UnifiedMessageService {
    /**
     * Envía mensaje usando la conexión apropiada (Baileys o Business API)
     */
    async sendMessage(
        whatsapp: Whatsapp,
        to: string,
        content: any,
        messageType: "text" | "image" | "document" | "template" | "interactive" = "text"
    ): Promise<SendMessageResult> {
        try {
            if (whatsapp.type === "whatsapp_business") {
                return await this.sendViaBusinessAPI(whatsapp, to, content, messageType);
            } else {
                return await this.sendViaBaileys(whatsapp, to, content, messageType);
            }
        } catch (error: any) {
            logger.error(`Error sending message via ${whatsapp.type}:`, error);
            throw new AppError(
                `ERR_SEND_MESSAGE_${whatsapp.type?.toUpperCase()}: ${error.message}`,
                400
            );
        }
    }

    /**
     * Envía mensaje via WhatsApp Business API
     */
    private async sendViaBusinessAPI(
        whatsapp: Whatsapp,
        to: string,
        content: any,
        messageType: string
    ): Promise<SendMessageResult> {
        throw new Error("ERR_BUSINESS_API_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición");
    }

    /**
     * Envía mensaje via Baileys (conexión tradicional)
     */
    private async sendViaBaileys(
        whatsapp: Whatsapp,
        to: string,
        content: any,
        messageType: string
    ): Promise<SendMessageResult> {
        const wbot = getWbot(whatsapp.id);

        // Formatear número para Baileys
        const formattedTo = to.includes("@") ? to : `${to}@s.whatsapp.net`;

        let messageResult;

        switch (messageType) {
            case "text":
                messageResult = await wbot.sendMessage(formattedTo, { text: content.text });
                break;

            case "image":
                messageResult = await wbot.sendMessage(formattedTo, {
                    image: { url: content.imageUrl },
                    caption: content.caption
                });
                break;

            case "document":
                messageResult = await wbot.sendMessage(formattedTo, {
                    document: { url: content.documentUrl },
                    fileName: content.filename,
                    caption: content.caption,
                    mimetype: content.mimetype || "application/octet-stream"
                });
                break;

            default:
                throw new Error(`Unsupported message type for Baileys: ${messageType}`);
        }

        return {
            success: true,
            messageId: messageResult?.key?.id,
            type: "baileys"
        };
    }

    /**
     * Verifica el estado de conexión de un WhatsApp
     */
    async checkConnectionStatus(whatsapp: Whatsapp): Promise<{
        isConnected: boolean;
        type: string;
        status: string;
        details?: any;
    }> {
        try {
            if (whatsapp.type === "whatsapp_business") {
                return {
                    isConnected: false,
                    type: "whatsapp_business",
                    status: whatsapp.status,
                    details: {
                        businessAccountId: whatsapp.businessAccountId,
                        phoneNumber: whatsapp.number,
                        tokenValid: false,
                        tokenExpiresAt: whatsapp.businessTokenExpiresAt,
                        note: "Service not available"
                    }
                };
            } else {
                // Para Baileys, verificar si la sesión está activa
                try {
                    const wbot = getWbot(whatsapp.id);
                    const isConnected = wbot && wbot.user?.id !== undefined;

                    return {
                        isConnected,
                        type: "baileys",
                        status: whatsapp.status,
                        details: {
                            sessionActive: isConnected,
                            user: wbot.user
                        }
                    };
                } catch {
                    return {
                        isConnected: false,
                        type: "baileys",
                        status: "DISCONNECTED"
                    };
                }
            }
        } catch (error) {
            logger.error("Error checking connection status:", error);
            return {
                isConnected: false,
                type: whatsapp.type,
                status: "ERROR"
            };
        }
    }
}

export default UnifiedMessageService;