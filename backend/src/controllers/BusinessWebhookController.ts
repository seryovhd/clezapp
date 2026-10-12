import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import { Op } from "sequelize";

export const webhookVerify = (req: Request, res: Response): void => {
  const mode = req.query["hub.mode"] as string;
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"] as string;

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "";
  if (mode === "subscribe" && token === verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send("Verification failed");
  }
};

export const debugWebhookSubscription = async (req: Request, res: Response): Promise<Response> => {
  try {
    const axios = require('axios');

    const USER_ACCESS_TOKEN = process.env.WHATSAPP_SYSTEM_USER_TOKEN || "";
    const PHONE_NUMBER_ID = '888315624362420';

    console.log("🔍 VERIFICANDO ESTADO DEL NÚMERO...");

    const numberResponse = await axios.get(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}`,
      {
        params: {
          fields: 'verified_name,quality_rating,code_verification_status,platform_type,status',
          access_token: USER_ACCESS_TOKEN
        }
      }
    );

    console.log("✅ ESTADO DEL NÚMERO:", numberResponse.data);

    const appResponse = await axios.get(
      `https://graph.facebook.com/v19.0/me`,
      { params: { access_token: USER_ACCESS_TOKEN } }
    );

    console.log("✅ INFO DEL USUARIO/APP:", appResponse.data);

    return res.status(200).json({
      success: true,
      number_status: numberResponse.data,
      app_info: appResponse.data,
      message: "Revisa el estado del número y modo de la app"
    });

  } catch (error: any) {
    console.error("❌ ERROR:", error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
};

export const webhookReceive = async (req: Request, res: Response): Promise<Response> => {
  try {
    console.log("🚨🚨🚨 WEBHOOK LLAMADO - " + new Date().toISOString() + " 🚨🚨🚨");
    console.log("📡 IP:", req.ip || req.connection.remoteAddress);
    console.log("📦 Body recibido:", typeof req.body);

    if (req.body && typeof req.body === 'object') {
      console.log("📨 BODY OBJECT:", JSON.stringify(req.body, null, 2));
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      console.log("❌❌❌ WEBHOOK VACÍO - NO HAY DATOS ❌❌❌");
      return res.status(200).json({ success: false, error: "EMPTY_WEBHOOK" });
    }

    // Extraer companyId del webhook con método mejorado
    const companyId = await extractCompanyIdFromWebhookImproved(req);

    if (!companyId) {
      console.log("❌ No se pudo determinar companyId después de búsqueda exhaustiva");

      const fallbackCompanyId = await findMostRecentBusinessWhatsapp();
      if (fallbackCompanyId) {
        console.log("🆘 Usando companyId de fallback:", fallbackCompanyId);
        return res.status(200).json({ success: true, used_fallback: true, note: "Webhook processing not available" });
      }

      return res.status(200).json({ success: false, error: "COMPANY_ID_NOT_FOUND" });
    }

    console.log("✅ Webhook procesado con companyId:", companyId);
    return res.status(200).json({ success: true, note: "Webhook received but processing not available" });

  } catch (error: any) {
    console.log("❌ ERROR EN WEBHOOK CONTROLLER:", error.message);
    logger.error("Error in Business API webhook controller:", error);
    return res.status(200).json({ success: false });
  }
};

// Función mejorada para extraer companyId
async function extractCompanyIdFromWebhookImproved(req: Request): Promise<number | null> {
  try {
    const payload = req.body;

    // 1. Buscar por phone_number_id
    if (payload.entry && payload.entry.length > 0) {
      for (const entry of payload.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            const phoneNumberId = change.value?.metadata?.phone_number_id;

            if (phoneNumberId) {
              console.log("📱 Buscando por phone_number_id:", phoneNumberId);
              const whatsapp = await Whatsapp.findOne({
                where: {
                  phoneNumberId: phoneNumberId,
                  type: "whatsapp_business"
                }
              });

              if (whatsapp) {
                console.log(`✅ Found company ${whatsapp.companyId} for phone ${phoneNumberId}`);
                return whatsapp.companyId;
              }
            }
          }
        }
      }
    }

    // 2. Buscar por WABA ID (entry.id)
    if (payload.entry && payload.entry.length > 0) {
      const wabaId = payload.entry[0].id;
      console.log("🏢 Buscando por WABA ID:", wabaId);

      const whatsapp = await Whatsapp.findOne({
        where: {
          [Op.or]: [
            { wabaId: wabaId },
            { businessAccountId: wabaId }
          ],
          type: "whatsapp_business"
        }
      });

      if (whatsapp) {
        console.log(`✅ Found company ${whatsapp.companyId} for WABA ${wabaId}`);
        return whatsapp.companyId;
      }
    }

    // 3. Buscar en account_update events
    if (payload.entry && payload.entry[0].changes) {
      for (const change of payload.entry[0].changes) {
        if (change.field === "account_update" && change.value.waba_info) {
          const wabaId = change.value.waba_info.waba_id;
          console.log("🔄 Buscando en account_update:", wabaId);

          const whatsapp = await Whatsapp.findOne({
            where: {
              [Op.or]: [
                { wabaId: wabaId },
                { businessAccountId: wabaId }
              ],
              type: "whatsapp_business"
            }
          });

          if (whatsapp) {
            console.log(`✅ Found company ${whatsapp.companyId} via account_update`);
            return whatsapp.companyId;
          }
        }
      }
    }

    console.log("⚠️ Could not extract company ID from webhook request");
    return null;
  } catch (error) {
    console.log("❌ Error extracting company ID:", error);
    return null;
  }
}

// Función de fallback
async function findMostRecentBusinessWhatsapp(): Promise<number | null> {
  try {
    const whatsapp = await Whatsapp.findOne({
      where: {
        type: "whatsapp_business"
      },
      order: [['updatedAt', 'DESC']]
    });

    return whatsapp ? whatsapp.companyId : null;
  } catch (error) {
    console.log("❌ Error finding fallback companyId:", error);
    return null;
  }
}

// Función auxiliar para extraer companyId del webhook
async function extractCompanyIdFromWebhook(req: Request): Promise<number | null> {
  try {
    // Buscar por phone_number_id en el payload
    if (req.body.entry && req.body.entry.length > 0) {
      for (const entry of req.body.entry) {
        for (const change of entry.changes) {
          const phoneNumberId = change.value?.metadata?.phone_number_id;

          if (phoneNumberId) {
            const whatsapp = await Whatsapp.findOne({
              where: {
                phoneNumberId: phoneNumberId,
                type: "whatsapp_business"
              },
              attributes: ["companyId"]
            });

            if (whatsapp) {
              console.log(`📋 Found company ${whatsapp.companyId} for phone ${phoneNumberId}`);
              return whatsapp.companyId;
            }
          }
        }
      }
    }

    console.log("⚠️ Could not extract company ID from webhook request");
    return null;
  } catch (error) {
    console.log("❌ Error extracting company ID:", error);
    return null;
  }
}