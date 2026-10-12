import express from "express";
import isAuth from "../middleware/isAuth";

import * as UnifiedMessageController from "../controllers/UnifiedMessageController";

const unifiedMessageRoutes = express.Router();

// Enviar mensaje unificado
unifiedMessageRoutes.post(
  "/whatsapp/:whatsappId/send-message",
  isAuth,
  UnifiedMessageController.sendMessage
);

// Obtener estado de conexión
unifiedMessageRoutes.get(
  "/whatsapp/:whatsappId/connection-status",
  isAuth,
  UnifiedMessageController.getConnectionStatus
);

export default unifiedMessageRoutes;