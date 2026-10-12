import express from "express";
import isAuth from "../middleware/isAuth";

import * as FacebookWebhookController from "../controllers/FacebookWebhookController";

const facebookWebhookRoutes = express.Router();

// 📍 RUTAS PÚBLICAS PARA WEBHOOK DE FACEBOOK (sin autenticación)
// Estas rutas deben ser accesibles públicamente para que Facebook pueda enviar webhooks

// Ruta para verificación del webhook (GET)
facebookWebhookRoutes.get(
  "/webhook/facebook",
  FacebookWebhookController.facebookWebhookVerification
);

// Ruta para recepción de webhooks (POST)
facebookWebhookRoutes.post(
  "/webhook/facebook",
  FacebookWebhookController.facebookWebhookHandler
);

// 📍 RUTAS PROTEGIDAS PARA GESTIÓN DEL WEBHOOK (requieren autenticación)

// Obtener estado del webhook para una conexión específica
facebookWebhookRoutes.get(
  "/whatsapp/:whatsappId/facebook/webhook/status",
  isAuth,
  FacebookWebhookController.getWebhookStatus
);

// Configurar webhook automáticamente
facebookWebhookRoutes.post(
  "/whatsapp/:whatsappId/facebook/webhook/setup",
  isAuth,
  FacebookWebhookController.setupWebhook
);

export default facebookWebhookRoutes;