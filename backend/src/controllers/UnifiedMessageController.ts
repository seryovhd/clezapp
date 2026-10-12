import { Request, Response } from "express";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import UnifiedMessageService from "../services/MessageServices/UnifiedMessageService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { logger } from "../utils/logger";

export const sendMessage = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  const { to, content, messageType = "text" } = req.body;

  try {
    const whatsapp = await ShowWhatsAppService(whatsappId, companyId);
    
    // Verificar que el WhatsApp esté conectado
    if (whatsapp.status !== "CONNECTED") {
      throw new AppError("ERR_WHATSAPP_DISCONNECTED", 400);
    }

    const messageService = new UnifiedMessageService();
    const result = await messageService.sendMessage(whatsapp, to, content, messageType);

    logger.info(`Message sent via ${result.type} to ${to}, type: ${messageType}`);

    return res.json({
      success: true,
      messageId: result.messageId,
      type: result.type
    });

  } catch (error: any) {
    logger.error("Error sending unified message:", error);
    throw new AppError(error.message || "ERR_SEND_MESSAGE", 400);
  }
};

export const getConnectionStatus = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  try {
    const whatsapp = await ShowWhatsAppService(whatsappId, companyId);
    const messageService = new UnifiedMessageService();
    const status = await messageService.checkConnectionStatus(whatsapp);

    return res.json({
      success: true,
      whatsappId: whatsapp.id,
      name: whatsapp.name,
      ...status
    });

  } catch (error: any) {
    logger.error("Error getting connection status:", error);
    throw new AppError(error.message || "ERR_CONNECTION_STATUS", 400);
  }
};