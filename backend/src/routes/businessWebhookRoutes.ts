import express from "express";
import * as BusinessWebhookController from "../controllers/BusinessWebhookController";

const businessWebhookRoutes = express.Router();

// Webhook verification (GET)
businessWebhookRoutes.get(
  "/webhook/whatsapp-business",
  BusinessWebhookController.webhookVerify
);

// Webhook reception (POST)
businessWebhookRoutes.post(
  "/webhook/whatsapp-business",
  BusinessWebhookController.webhookReceive
);

// ✅ RUTA TEMPORAL PARA DIAGNÓSTICO - ELIMINAR DESPUÉS
businessWebhookRoutes.get(
  "/debug-subscription",
  BusinessWebhookController.debugWebhookSubscription
);

export default businessWebhookRoutes;