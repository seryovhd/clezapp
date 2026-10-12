import { Request, Response } from "express";
import { logger } from "../utils/logger";
import AppError from "../errors/AppError";

export const facebookWebhookVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      "hub.mode": mode, 
      "hub.verify_token": token, 
      "hub.challenge": challenge 
    } = req.query;

    logger.info(`🔐 Facebook webhook verification request: mode=${mode}, token=${token}`);

    if (!mode || !token || !challenge) {
      logger.warn("Missing verification parameters");
      res.status(400).json({ error: "Missing verification parameters" });
      return;
    }

    const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || "";
    if (mode === "subscribe" && token === verifyToken) {
      logger.info("✅ Facebook webhook verified successfully");
      res.status(200).send(challenge);
    } else {
      logger.warn("❌ Facebook webhook verification failed");
      res.status(403).json({ error: "Verification failed" });
    }
  } catch (error: any) {
    logger.error("Error in Facebook webhook verification:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const facebookWebhookHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info("📨 Received Facebook webhook payload");

    // Verificar que el payload tenga la estructura esperada
    if (!req.body || !req.body.object) {
      logger.warn("Invalid webhook payload: missing object");
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    // Extraer companyId del payload o headers
    // En una implementación real, podrías identificar la compañía por:
    // - Page ID en el payload
    // - Token en headers
    // - Parámetro en la URL
    const companyId = await extractCompanyIdFromWebhook(req);
    
    if (!companyId) {
      logger.warn("Could not determine company ID from webhook");
      res.status(400).json({ error: "Company ID not found" });
      return;
    }

    logger.info("✅ Facebook webhook accepted for processing");
    res.status(200).json({ status: "ok" });

  } catch (error: any) {
    logger.error("Error in Facebook webhook handler:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Función auxiliar para extraer companyId del webhook
async function extractCompanyIdFromWebhook(req: Request): Promise<number | null> {
  try {
    // Método 1: Buscar por page ID en el payload
    if (req.body.entry && req.body.entry.length > 0) {
      const pageId = req.body.entry[0].id;
      
      if (pageId) {
        const { default: Whatsapp } = await import("../models/Whatsapp");
        const whatsapp = await Whatsapp.findOne({
          where: { 
            facebookPageId: pageId,
            type: "facebook_messenger"
          },
          attributes: ["companyId"]
        });
        
        if (whatsapp) {
          logger.info(`📋 Found company ${whatsapp.companyId} for page ${pageId}`);
          return whatsapp.companyId;
        }
      }
    }

    // Método 2: Buscar por token en headers (si se usa)
    const authHeader = req.headers.authorization;
    if (authHeader) {
      // Lógica para extraer companyId del token
      // Esto depende de tu implementación de autenticación
    }

    // Método 3: Parámetro en la URL (si se configura así)
    const { companyId } = req.params;
    if (companyId) {
      return parseInt(companyId, 10);
    }

    logger.warn("Could not extract company ID from webhook request");
    return null;
  } catch (error) {
    logger.error("Error extracting company ID:", error);
    return null;
  }
}

// Controlador para obtener el estado del webhook
export const getWebhookStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { whatsappId } = req.params;
    const { companyId } = req.user;

    const { default: Whatsapp } = await import("../models/Whatsapp");
    
    const whatsapp = await Whatsapp.findOne({
      where: { 
        id: whatsappId,
        companyId: companyId,
        type: "facebook_messenger"
      },
      attributes: ["facebookPageId", "facebookWebhookEnabled", "facebookPageName"]
    });

    if (!whatsapp) {
      throw new AppError("Facebook Messenger connection not found", 404);
    }

    res.json({
      success: true,
      webhookEnabled: whatsapp.facebookWebhookEnabled || false,
      pageId: whatsapp.facebookPageId,
      pageName: whatsapp.facebookPageName,
      webhookUrl: `${process.env.BACKEND_URL}/webhook/facebook`
    });

  } catch (error: any) {
    logger.error("Error getting webhook status:", error);
    throw new AppError(error.message || "ERR_FACEBOOK_WEBHOOK_STATUS", 400);
  }
};

// Controlador para configurar el webhook automáticamente
export const setupWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { whatsappId } = req.params;
    const { companyId } = req.user;

    // Aquí iría la lógica para configurar el webhook en Facebook automáticamente
    // usando la Graph API

    logger.info(`🔄 Setting up Facebook webhook for whatsapp ${whatsappId}, company ${companyId}`);

    // Por ahora, solo marcamos que el webhook está habilitado
    const { default: Whatsapp } = await import("../models/Whatsapp");
    
    await Whatsapp.update(
      { facebookWebhookEnabled: true },
      { 
        where: { 
          id: whatsappId,
          companyId: companyId 
        } 
      }
    );

    res.json({
      success: true,
      message: "Webhook configuration initiated",
      webhookUrl: `${process.env.BACKEND_URL}/webhook/facebook`,
      instructions: "Configure this URL in your Facebook App webhook settings"
    });

  } catch (error: any) {
    logger.error("Error setting up webhook:", error);
    throw new AppError(error.message || "ERR_FACEBOOK_WEBHOOK_SETUP", 400);
  }
};