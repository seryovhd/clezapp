import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";

export const connectFacebook = async (req: Request, res: Response): Promise<Response> => {
  throw new AppError("ERR_FACEBOOK_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición", 501);
};

export const facebookCallback = async (req: Request, res: Response): Promise<void> => {
  const { code, state, error, error_reason, error_description } = req.query;

  try {
    if (error) {
      logger.error(`Facebook Messenger authorization failed: ${error_reason} - ${error_description}`);
      res.send(`
        <html>
          <head>
            <title>Facebook Connection Error</title>
          </head>
          <body>
            <script>
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({
                  type: 'FACEBOOK_CONNECTION_ERROR',
                  reason: '${error_reason}'
                }, '${process.env.FRONTEND_URL}');
              }
              window.close();
            </script>
            <p>Facebook connection failed: ${error_reason}. This window will close automatically.</p>
          </body>
        </html>
      `);
      return;
    }

    if (!code || !state) {
      logger.error("Facebook Messenger callback missing code or state");
      res.send(`
        <html>
          <head>
            <title>Facebook Connection Error</title>
          </head>
          <body>
            <script>
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({
                  type: 'FACEBOOK_CONNECTION_ERROR',
                  reason: 'missing_params'
                }, '${process.env.FRONTEND_URL}');
              }
              window.close();
            </script>
            <p>Facebook connection failed: Missing parameters. This window will close automatically.</p>
          </body>
        </html>
      `);
      return;
    }

    const decodedState = JSON.parse(
      Buffer.from(state as string, "base64").toString()
    );

    const { whatsappId, companyId, timestamp, type } = decodedState;

    const stateAge = Date.now() - timestamp;
    if (stateAge > 10 * 60 * 1000) {
      logger.error("Facebook Messenger state expired");
      res.send(`
        <html>
          <head>
            <title>Facebook Connection Error</title>
          </head>
          <body>
            <script>
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({
                  type: 'FACEBOOK_CONNECTION_ERROR',
                  reason: 'state_expired'
                }, '${process.env.FRONTEND_URL}');
              }
              window.close();
            </script>
            <p>Facebook connection failed: State expired. This window will close automatically.</p>
          </body>
        </html>
      `);
      return;
    }

    if (type !== "facebook_messenger") {
      logger.error("Invalid state type in Facebook Messenger callback");
      res.send(`
        <html>
          <head>
            <title>Facebook Connection Error</title>
          </head>
          <body>
            <script>
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({
                  type: 'FACEBOOK_CONNECTION_ERROR',
                  reason: 'invalid_state'
                }, '${process.env.FRONTEND_URL}');
              }
              window.close();
            </script>
            <p>Facebook connection failed: Invalid state. This window will close automatically.</p>
          </body>
        </html>
      `);
      return;
    }

    logger.error("Facebook Messenger callback attempted but service not available");
    res.send(`
      <html>
        <head>
          <title>Facebook Connection Error</title>
        </head>
        <body>
          <script>
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({
                type: 'FACEBOOK_CONNECTION_ERROR',
                reason: 'service_not_available'
              }, '${process.env.FRONTEND_URL}');
            }
            window.close();
          </script>
          <p>Facebook connection failed: Service not available. This window will close automatically.</p>
        </body>
      </html>
    `);
    return;

  } catch (error: any) {
    logger.error("Error in Facebook Messenger callback:", error);

    const errorMessage = error.message || "unknown_error";
    res.send(`
    <html>
      <head>
        <title>Facebook Connection Error</title>
      </head>
      <body>
        <script>
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({
              type: 'FACEBOOK_CONNECTION_ERROR',
              reason: '${error_reason}'
            }, '${process.env.FRONTEND_URL}');
          }
          window.close();
        </script>
        <p>Facebook connection failed! This window will close automatically.</p>
      </body>
    </html>
  `);
    return;
  }
};

export const getFacebookConversations = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  const { limit = 20 } = req.query;

  try {
    const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

    if (whatsapp.type !== "facebook_messenger") {
      throw new AppError("ERR_NOT_FACEBOOK_CONNECTION", 400);
    }

    throw new AppError("ERR_FACEBOOK_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición", 501);

  } catch (error: any) {
    logger.error("Error getting Facebook conversations:", error);
    throw new AppError(error.message || "ERR_FACEBOOK_CONVERSATIONS", 400);
  }
};

export const sendFacebookMessage = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  const { conversationId, message, mediaUrl, mediaType } = req.body;

  try {
    const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

    if (whatsapp.type !== "facebook_messenger") {
      throw new AppError("ERR_NOT_FACEBOOK_CONNECTION", 400);
    }

    if (!conversationId || !message) {
      throw new AppError("ERR_MISSING_PARAMS", 400);
    }

    const ticket = await Ticket.findOne({
      where: {
        companyId: companyId,
        whatsappId: whatsappId,
      },
      include: ["contact"]
    });

    if (!ticket) {
      throw new AppError("ERR_TICKET_NOT_FOUND", 404);
    }

    throw new AppError("ERR_FACEBOOK_NOT_AVAILABLE - Esta funcionalidad no está disponible en esta edición", 501);

  } catch (error: any) {
    logger.error("Error sending Facebook message:", error);
    throw new AppError(error.message || "ERR_FACEBOOK_SEND_MESSAGE", 400);
  }
};

export const disconnectFacebook = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  try {
    const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

    if (whatsapp.type !== "facebook_messenger") {
      throw new AppError("ERR_NOT_FACEBOOK_CONNECTION", 400);
    }

    const [affectedCount] = await Whatsapp.update(
      {
        type: "facebook_messenger",
        facebookPageId: null,
        facebookPageName: null,
        facebookAccessToken: null,
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

    logger.info(`Successfully disconnected Facebook Messenger: ${whatsappId} for company ${companyId}`);

    return res.json({
      success: true,
      message: "Facebook Messenger disconnected successfully",
      whatsapp: updatedWhatsapp
    });

  } catch (error: any) {
    logger.error("Error disconnecting Facebook Messenger:", error);
    throw new AppError(error.message || "ERR_FACEBOOK_DISCONNECT", 400);
  }
};