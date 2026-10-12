import { initWASocket } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import { wbotMessageListener } from "./wbotMessageListener";
import { getIO } from "../../libs/socket";
import wbotMonitor from "./wbotMonitor";
import { StartBusinessSession } from "./StartBusinessSession";
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";
import * as Sentry from "@sentry/node";
import EvolutionApiService from "../EvolutionApiServices/EvolutionApiService";

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  if (whatsapp.type === "facebook_messenger") {
    logger.info(`✅ Facebook Messenger connection "${whatsapp.name}" - No WhatsApp session required`);

    // Solo actualizar estado a CONNECTED
    await whatsapp.update({
      status: "CONNECTED",
      qrcode: ""
    });

    const io = getIO();
    io.emit(`company-${companyId}-whatsappSession`, {
      action: "update",
      session: whatsapp
    });

    return; // ← IMPORTANTE: Salir sin iniciar sesión de WhatsApp
  }
  await whatsapp.update({ status: "OPENING" });

  const io = getIO();
  io.emit(`company-${companyId}-whatsappSession`, {
    action: "update",
    session: whatsapp
  });

  try {
    logger.info(`Starting WhatsApp session for: ${whatsapp.name}, type: ${whatsapp.type}`);

    if (whatsapp.type === "whatsapp_business") {
      await StartBusinessSession(whatsapp, companyId);
    } else {
      const evolutionConfig = await EvolutionApiService.getConfig(companyId);
      const isEvolution = whatsapp.type === "evolution" ||
        whatsapp.connectionType === "evolution" ||
        (evolutionConfig.enabled && whatsapp.connectionType !== "baileys" && whatsapp.type !== "baileys");

      if (isEvolution) {
        logger.info(`🚀 [Evolution API] Iniciando sesión para: ${whatsapp.name}`);
        const createResult = await EvolutionApiService.createInstance(whatsapp);
        let connectResult = createResult;

        let code = createResult?.qrcode?.code || createResult?.qrcode?.base64 || createResult?.code || createResult?.base64;

        if (!code) {
          connectResult = await EvolutionApiService.connectInstance(whatsapp);
          code = connectResult?.code || connectResult?.qrcode?.code || connectResult?.base64 || connectResult?.qrcode?.base64;
        }

        logger.info(`[Evolution] Código QR obtenido: ${code ? "SÍ" : "NO"}`);

        if (code) {
          await whatsapp.update({
            qrcode: code,
            status: "qrcode"
          });
        } else if (connectResult?.state === "open" || connectResult?.instance?.state === "open" || createResult?.instance?.state === "open") {
          await whatsapp.update({
            status: "CONNECTED",
            qrcode: ""
          });
        }

        io.emit(`company-${companyId}-whatsappSession`, {
          action: "update",
          session: whatsapp
        });
        io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-whatsapp`, {
          action: "update",
          whatsapp
        });
      } else {
        // ✅ CONEXIÓN BAILEYS TRADICIONAL - MANTENER LO QUE TENÍAS ANTES
        const wbot = await initWASocket(whatsapp);

        // ✅ INICIALIZAR LISTENERS Y MONITOR
        wbotMessageListener(wbot, companyId);
        await wbotMonitor(wbot, whatsapp, companyId);
      }
    }

    logger.info(`WhatsApp session started successfully: ${whatsapp.name}`);
  } catch (error: any) {
    logger.error(`Error starting WhatsApp session for ${whatsapp.name}:`, error);

    // Actualizar estado a error
    await whatsapp.update({
      status: "DISCONNECTED",
      qrcode: ""
    });

    // Manejo específico de errores de Business API
    if (whatsapp.type === "whatsapp_business" && error.message.includes("BUSINESS")) {
      logger.warn(`Business API connection deferred for ${whatsapp.name}`);
      // No lanzar error para evitar crash del servidor
    } else {
      // Para errores de Baileys, mantener el comportamiento original
      Sentry.captureException(error);
      throw new AppError(
        `ERR_START_SESSION_${whatsapp.type?.toUpperCase()}: ${error.message}`,
        400
      );
    }
  }
};