import Whatsapp from "../../models/Whatsapp";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";

export const StartBusinessSession = async (
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  try {
    logger.info(`🔄 [BusinessAPI] Starting session for: ${whatsapp.name}`);

    if (!whatsapp.businessAccessToken) {
      logger.warn(`⚠️ [BusinessAPI] No access token for WhatsApp ${whatsapp.id} - ${whatsapp.name}`);
      logger.debug(`🔍 [BusinessAPI] WhatsApp details:`, {
        id: whatsapp.id,
        name: whatsapp.name,
        type: whatsapp.type,
        hasToken: !!whatsapp.businessAccessToken,
        status: whatsapp.status
      });

      // Actualizar estado sin error
      await whatsapp.update({
        status: "DISCONNECTED",
        qrcode: ""
      });

      const io = getIO();
      io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-whatsappSession`, {
        action: "update",
        session: whatsapp
      });

      logger.info(`✅ [BusinessAPI] Marked as DISCONNECTED - awaiting OAuth: ${whatsapp.name}`);
      return;
    }

    logger.warn(`⚠️ [BusinessAPI] Service not available for: ${whatsapp.name}`);

    await whatsapp.update({
      status: "DISCONNECTED",
      qrcode: ""
    });

    const io = getIO();
    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-whatsappSession`, {
      action: "update",
      session: whatsapp
    });

    logger.info(`🔄 [BusinessAPI] Service not available - marked as DISCONNECTED: ${whatsapp.name}`);
    return;

  } catch (error: any) {
    logger.error(`💥 [BusinessAPI] Error starting session for ${whatsapp.name}:`, {
      message: error.message,
      stack: error.stack,
      whatsappId: whatsapp.id,
      companyId: companyId
    });

    // Actualizar estado a error
    await whatsapp.update({
      status: "DISCONNECTED",
      qrcode: ""
    });

    throw new AppError(
      `BUSINESS_API_START_FAILED: ${error.message}`,
      400
    );
  }
};