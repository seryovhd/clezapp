import express from "express";
import isAuth from "../middleware/isAuth";

import * as BusinessWhatsAppController from "../controllers/BusinessWhatsAppController";

const businessWhatsappRoutes = express.Router();

// Iniciar proceso de conexión Business API
businessWhatsappRoutes.get(
  "/whatsapp/:whatsappId/business/connect",
  isAuth,
  BusinessWhatsAppController.connectBusiness
);

// Callback de Facebook OAuth (NO requiere auth - es llamado por Facebook)
businessWhatsappRoutes.get(
  "/whatsapp/business/callback",
  BusinessWhatsAppController.businessCallback
);

// Desconectar Business API
businessWhatsappRoutes.post(
  "/whatsapp/:whatsappId/business/disconnect",
  isAuth,
  BusinessWhatsAppController.disconnectBusiness
);

// Obtener estado de conexión Business API
businessWhatsappRoutes.get(
  "/whatsapp/:whatsappId/business/status",
  isAuth,
  BusinessWhatsAppController.getBusinessStatus
);

export default businessWhatsappRoutes;