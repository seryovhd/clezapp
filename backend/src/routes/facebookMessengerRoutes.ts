import express from "express";
import isAuth from "../middleware/isAuth";

import * as FacebookMessengerController from "../controllers/FacebookMessengerController";

const facebookMessengerRoutes = express.Router();

facebookMessengerRoutes.get(
  "/whatsapp/:whatsappId/facebook/connect",
  isAuth,
  FacebookMessengerController.connectFacebook
);

facebookMessengerRoutes.get(
  "/whatsapp/facebook/callback",
  FacebookMessengerController.facebookCallback
);

facebookMessengerRoutes.get(
  "/whatsapp/:whatsappId/facebook/conversations",
  isAuth,
  FacebookMessengerController.getFacebookConversations
);

facebookMessengerRoutes.post(
  "/whatsapp/:whatsappId/facebook/send",
  isAuth,
  FacebookMessengerController.sendFacebookMessage
);

facebookMessengerRoutes.post(
  "/whatsapp/:whatsappId/facebook/disconnect",
  isAuth,
  FacebookMessengerController.disconnectFacebook
);

export default facebookMessengerRoutes;