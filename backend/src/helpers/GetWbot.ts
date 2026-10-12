import { WASocket } from "@whiskeysockets/baileys";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import { getWbot as getWbotLib } from "../libs/wbot";
import { logger } from "../utils/logger";

const GetWbot = async (whatsappId: number): Promise<WASocket> => {
  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    
    if (!whatsapp) {
      throw new AppError("ERR_WAPP_NOT_FOUND", 404);
    }

    if (whatsapp.type === "facebook_messenger") {
      throw new AppError("ERR_FACEBOOK_NO_WBOT", 400);
    }

    const wbot = getWbotLib(whatsappId);
    
    if (!wbot) {
      throw new AppError("ERR_WAPP_NOT_INITIALIZED", 400);
    }

    return wbot;
  } catch (error: any) {
    if (error.message?.includes("ERR_FACEBOOK_NO_WBOT")) {
      throw error;
    }
    logger.error(`GetWbot | Error: ${error.message}`);
    throw new AppError("ERR_WAPP_NOT_INITIALIZED", 400);
  }
};

export default GetWbot;