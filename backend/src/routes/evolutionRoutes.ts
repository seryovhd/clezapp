import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as EvolutionWebhookController from "../controllers/EvolutionWebhookController";

const evolutionRoutes = Router();

// Webhook entrante de Evolution API (No requiere auth - llamado por Evolution API)
evolutionRoutes.post(
  "/evolution/webhook/:companyId/:whatsappId",
  EvolutionWebhookController.handleWebhook
);

evolutionRoutes.post(
  "/evolution/webhook",
  EvolutionWebhookController.handleWebhook
);

// Endpoints administrativos desde el panel (Requieren autenticación)
evolutionRoutes.post(
  "/evolution/test-connection",
  isAuth,
  EvolutionWebhookController.testEvolutionConnection
);

evolutionRoutes.post(
  "/evolution/connect/:whatsappId",
  isAuth,
  EvolutionWebhookController.connectEvolution
);

evolutionRoutes.post(
  "/evolution/disconnect/:whatsappId",
  isAuth,
  EvolutionWebhookController.disconnectEvolution
);

export default evolutionRoutes;
