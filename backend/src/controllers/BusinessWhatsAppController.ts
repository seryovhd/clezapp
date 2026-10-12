import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { logger } from "../utils/logger";

interface BusinessConnectionData {
  businessAccountId: string;
  phoneNumberId: string;
  phoneNumber: string;
  businessName: string;
  verificationStatus: string;
  accessToken: string;
  expiresIn: number;
}

export const connectBusiness = async (req: Request, res: Response): Promise<Response> => {
  throw new AppError("ERR_BUSINESS_API_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición", 501);
};

export const businessCallback = async (req: Request, res: Response): Promise<void> => {
  console.log("🔄 CALLBACK EJECUTADO ===================================");
  console.log("📋 Query params:", req.query);
  console.log("🌐 URL completa:", req.url);
  console.log("🔗 Headers:", req.headers);
  console.log("======================================================");

  const { code, state, error, error_reason, error_description } = req.query;

  try {
    if (error) {
      console.log("❌ ERROR EN CALLBACK:", { error, error_reason, error_description });
      logger.error(`Business API authorization failed: ${error_reason} - ${error_description}`);
      res.redirect(
        `${process.env.FRONTEND_URL}/connections?business=error&reason=${error_reason}`
      );
      return;
    }

    if (!code || !state) {
      console.log("❌ CALLBACK SIN CODE O STATE:", { code, state });
      logger.error("Business API callback missing code or state");
      res.redirect(
        `${process.env.FRONTEND_URL}/connections?business=error&reason=missing_params`
      );
      return;
    }

    console.log("✅ CALLBACK CON CODE Y STATE - PROCESANDO...");

    let decodedState;
    try {
      decodedState = JSON.parse(
        Buffer.from(state as string, "base64").toString()
      );
      console.log("✅ State decodificado correctamente:", decodedState);
    } catch (stateError) {
      console.log("❌ ERROR DECODIFICANDO STATE:", stateError.message);
      console.log("❌ STATE RECIBIDO:", state);
      logger.error("Invalid state format in Business API callback");
      res.redirect(
        `${process.env.FRONTEND_URL}/connections?business=error&reason=invalid_state_format`
      );
      return;
    }

    const { whatsappId, companyId, timestamp, type } = decodedState;

    const stateAge = Date.now() - timestamp;
    if (stateAge > 10 * 60 * 1000) {
      logger.error("Business API state expired");
      res.redirect(
        `${process.env.FRONTEND_URL}/connections?business=error&reason=state_expired`
      );
      return;
    }

    if (type !== "whatsapp_business") {
      logger.error("Invalid state type in Business API callback");
      res.redirect(
        `${process.env.FRONTEND_URL}/connections?business=error&reason=invalid_state`
      );
      return;
    }

    console.log("✅ State decodificado:", { whatsappId, companyId });

    logger.error("Business API callback attempted but service not available");
    res.redirect(
      `${process.env.FRONTEND_URL}/connections?business=error&reason=service_not_available`
    );
    return;

  } catch (error: any) {
    console.log("❌ ERROR EN PROCESAMIENTO DEL CALLBACK:", error);
    console.log("❌ STACK:", error.stack);

    logger.error("Error in Business API callback:", error);

    const errorMessage = error.message || "unknown_error";
    res.redirect(
      `${process.env.FRONTEND_URL}/connections?business=error&reason=${errorMessage}`
    );
    return;
  }
};

export const disconnectBusiness = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  try {
    const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

    if (whatsapp.type !== "whatsapp_business") {
      throw new AppError("ERR_NOT_BUSINESS_CONNECTION", 400);
    }

    const [affectedCount] = await Whatsapp.update(
      {

        type: "whatsapp_business",
        businessAccountId: null,
        phoneNumberId: null,
        businessName: null,
        businessVerificationStatus: null,
        businessAccessToken: null,
        businessTokenExpiresAt: null,
        status: "DISCONNECTED",
        token: ""
      },
      {
        where: {
          id: whatsappId,
          companyId: companyId
        }
      }
    );

    if (affectedCount === 0) {
      throw new AppError("ERR_WHATSAPP_NOT_FOUND", 404);
    }

    const io = getIO();
    const updatedWhatsapp = await ShowWhatsAppService(whatsappId, companyId);

    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-whatsapp`, {
      action: "update",
      whatsapp: updatedWhatsapp
    });

    logger.info(`Successfully disconnected WhatsApp Business: ${whatsappId} for company ${companyId}`);

    return res.json({
      success: true,
      message: "WhatsApp Business disconnected successfully",
      whatsapp: updatedWhatsapp
    });

  } catch (error: any) {
    logger.error("Error disconnecting Business API:", error);
    throw new AppError(error.message || "ERR_BUSINESS_API_DISCONNECT", 400);
  }
};

export const getBusinessStatus = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  throw new AppError("ERR_BUSINESS_API_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición", 501);
};