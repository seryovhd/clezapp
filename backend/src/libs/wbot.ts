import * as Sentry from "@sentry/node";
import makeWASocket, {
  WASocket,
  Browsers,
  WAMessage,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  WAMessageKey,
  jidNormalizedUser,
  CacheStore
} from "@whiskeysockets/baileys";
import makeInMemoryStore from "./in-memory-store";
import { Op } from "sequelize";
import { FindOptions } from "sequelize/types";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import MAIN_LOGGER from "@whiskeysockets/baileys/lib/Utils/logger";
import authState from "../helpers/authState";
import { Boom } from "@hapi/boom";
import AppError from "../errors/AppError";
import { getIO } from "./socket";
import { Store } from "./store";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import NodeCache from 'node-cache';
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
const loggerBaileys = MAIN_LOGGER.child({});
loggerBaileys.level = "error";

// Caché para contar reintentos de mensajes, con duración estándar de 10 minutos
const msgRetryCounterCache = new NodeCache({
  stdTTL: 600,           // Tiempo de vida estándar (600 segundos = 10 minutos)
  maxKeys: 1000,         // Máximo de claves almacenadas
  checkperiod: 300,      // Intervalo para limpieza automática (cada 5 minutos)
  useClones: false       // No clonar objetos almacenados (mejora rendimiento)
});

// Caché para almacenamiento temporal de mensajes, con duración de 60 segundos
const msgCache = new NodeCache({
  stdTTL: 60,            // Tiempo de vida estándar (60 segundos)
  maxKeys: 1000,         // Máximo de claves almacenadas
  checkperiod: 300,      // Intervalo para limpieza automática (cada 5 minutos)
  useClones: false       // No clonar objetos almacenados
});

type Session = WASocket & {
  id?: number;
  store?: Store;
};

export default function msg() {
  return {
    get: (key: WAMessageKey) => {
      const { id } = key;
      if (!id) return;
      let data = msgCache.get(id);
      if (data) {
        try {
          let msg = JSON.parse(data as string);
          return msg?.message;
        } catch (error) {
          logger.error(error);
        }
      }
    },
    save: (msg: WAMessage) => {
      const { id } = msg.key;
      const msgtxt = JSON.stringify(msg);
      try {
        msgCache.set(id as string, msgtxt);
      } catch (error) {
        logger.error(error);
      }
    }
  }
}

const sessions: Session[] = [];

const retriesQrCodeMap = new Map<number, number>();

export const getWbot = (whatsappId: number): Session => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);

  if (sessionIndex === -1) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  return sessions[sessionIndex];
};

export const removeWbot = async (
  whatsappId: number,
  isLogout = true
): Promise<void> => {
  try {
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex !== -1) {
      const session = sessions[sessionIndex];
      // Remover de la lista inmediatamente para cortar procesamiento de mensajes entrantes o bucles de error
      sessions.splice(sessionIndex, 1);

      if (isLogout && session) {
        try {
          if (typeof session.logout === "function") {
            await session.logout();
          }
        } catch (e) {
          logger.warn(`Aviso al hacer logout de sesión ${whatsappId}: ${e}`);
        }

        try {
          if (session.ws && typeof session.ws.close === "function") {
            session.ws.close();
          }
        } catch (e) {
          logger.warn(`Aviso al cerrar ws de sesión ${whatsappId}: ${e}`);
        }
      }
    }
    retriesQrCodeMap.delete(whatsappId);
  } catch (err) {
    logger.error("Error en removeWbot:", err);
  }
};

export const restartWbot = async (
  companyId: number,
  session?: any
): Promise<void> => {
  try {
    const options: FindOptions = {
      where: {
        companyId,
      },
      attributes: ["id"],
    }

    const whatsapp = await Whatsapp.findAll(options);

    whatsapp.map(async c => {
      const sessionIndex = sessions.findIndex(s => s.id === c.id);
      if (sessionIndex !== -1) {
        sessions[sessionIndex].ws.close();
      }

    });

  } catch (err) {
    logger.error(err);
  }
};

export const msgDB = msg();

export const initWASocket = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise(async (resolve, reject) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      (async () => {
        const io = getIO();

        retriesQrCodeMap.delete(whatsapp.id);

        const existingSessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
        if (existingSessionIndex !== -1) {
          const existing = sessions[existingSessionIndex];
          if ((existing as any)?.user?.id) {
            logger.info(`✅ Reutilizando sesión conectada para: ${whatsapp.name}`);
            resolve(existing);
            return;
          } else {
            logger.info(`🔄 Limpiando sesión pendiente anterior para: ${whatsapp.name}`);
            try { (existing as any).ws?.close(); } catch (e) {}
            sessions.splice(existingSessionIndex, 1);
          }
        }

        const whatsappUpdate = await Whatsapp.findOne({
          where: { id: whatsapp.id }
        });

        if (!whatsappUpdate) {
          reject(new Error(`WhatsApp ${whatsapp.id} no encontrado`));
          return;
        }

        const { id, name, provider } = whatsappUpdate;

        const { version, isLatest } = await fetchLatestBaileysVersion();
        const isLegacy = provider === "stable" ? true : false;

        logger.info(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
        logger.info(`isLegacy: ${isLegacy}`);
        logger.info(`Starting session ${name}`);
        let retriesQrCode = 0;

        let wsocket: Session = null;
        const store = makeInMemoryStore({
          logger: loggerBaileys,
          socket: wsocket
        });

        const { state, saveState } = await authState(whatsapp);

        //const msgRetryCounterCache = new NodeCache();
        const userDevicesCache: CacheStore = new NodeCache();

        wsocket = makeWASocket({
          logger: loggerBaileys,
          printQRInTerminal: false,
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, loggerBaileys),
          },
          version,
          browser: ["Mac OS", "Chrome", "14.4.1"],
          defaultQueryTimeoutMs: undefined,
          msgRetryCounterCache,
          markOnlineOnConnect: false,
          connectTimeoutMs: 25_000,
          keepAliveIntervalMs: 25_000,
          syncFullHistory: false,
          maxMsgRetryCount: 3,
          retryRequestDelayMs: 500,
          getMessage: msgDB.get,
          emitOwnEvents: true,
          fireInitQueries: true,
          transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
          shouldIgnoreJid: jid =>
            isJidBroadcast(jid) ||
            (typeof jid === "string" && (jid.endsWith("@newsletter") || jid.endsWith("@call"))),
        });

        wsocket.ev.on("creds.update", saveState);

        wsocket.ev.on('messages.upsert', async (m) => {
          try {
          } catch (err) {
            const ignoredErrors = [
              "Bad MAC",
              "No matching sessions found for message",
              "No SenderKeyRecord found for decryption",
              "failed to decrypt message"
            ];

            if (ignoredErrors.some(e => err?.message?.includes(e))) {
              return;
            }

            logger.error("Error en mensaje no filtrado:", err);
          }
        });
        // wsocket = makeWASocket({
        //   version,
        //   logger: loggerBaileys,
        //   printQRInTerminal: false,
        //   auth: state as AuthenticationState,
        //   generateHighQualityLinkPreview: false,
        //   shouldIgnoreJid: jid => isJidBroadcast(jid),
        //   browser: ["Chat", "Chrome", "10.15.7"],
        //   patchMessageBeforeSending: (message) => {
        //     const requiresPatch = !!(
        //       message.buttonsMessage ||
        //       // || message.templateMessage
        //       message.listMessage
        //     );
        //     if (requiresPatch) {
        //       message = {
        //         viewOnceMessage: {
        //           message: {
        //             messageContextInfo: {
        //               deviceListMetadataVersion: 2,
        //               deviceListMetadata: {},
        //             },
        //             ...message,
        //           },
        //         },
        //       };
        //     }

        //     return message;
        //   },
        // })

        wsocket.ev.on(
          "connection.update",
          async ({ connection, lastDisconnect, qr }) => {
            logger.info(`Socket ${name} Connection Update: ${connection || "sin_estado"}`);
            if (lastDisconnect?.error) {
              const err = lastDisconnect.error;
              logger.error(`❌ Detalle Error Baileys (${name}): status=${(err as any)?.output?.statusCode} message=${err.message} stack=${err.stack}`);
            }

            const disconect = (lastDisconnect?.error as Boom)?.output?.statusCode;

            if (connection === "close") {
              if (disconect === 403) {
                await whatsapp.update({ status: "PENDING", session: "", number: "" });
                removeWbot(id, false);

                await DeleteBaileysService(whatsapp.id);

                io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });
              }

              if (disconect !== DisconnectReason.loggedOut) {
                removeWbot(id, false);
                setTimeout(() => StartWhatsAppSession(whatsapp, whatsapp.companyId), 2000);
              } else {
                await whatsapp.update({ status: "PENDING", session: "", number: "" });
                await DeleteBaileysService(whatsapp.id);

                io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });
                removeWbot(id, false);
                setTimeout(() => StartWhatsAppSession(whatsapp, whatsapp.companyId), 2000);
              }
            }

            if (connection === "open") {
              await whatsapp.update({
                status: "CONNECTED",
                qrcode: "",
                retries: 0,
                number:
                  wsocket.type === "md"
                    ? jidNormalizedUser((wsocket as WASocket).user.id).split("@")[0]
                    : "-"
              });

              io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
                action: "update",
                session: whatsapp
              });

              const sessionIndex = sessions.findIndex(
                s => s.id === whatsapp.id
              );
              if (sessionIndex === -1) {
                wsocket.id = whatsapp.id;
                sessions.push(wsocket);
              }

              resolve(wsocket);
            }

            if (qr !== undefined) {
              if (retriesQrCodeMap.get(id) && retriesQrCodeMap.get(id) >= 3) {
                await whatsapp.update({
                  status: "DISCONNECTED",
                  qrcode: ""
                });
                await DeleteBaileysService(whatsapp.id);

                io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });
                wsocket.ev.removeAllListeners("connection.update");
                wsocket.ws.close();
                wsocket = null;
                retriesQrCodeMap.delete(id);
              } else {
                logger.info(`Session QRCode Generate ${name}`);
                retriesQrCodeMap.set(id, (retriesQrCode += 1));

                await whatsapp.update({
                  qrcode: qr,
                  status: "qrcode",
                  retries: 0,
                  number: ""
                });
                io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });
                io.to(`company-${whatsapp.companyId}-mainchannel`).emit(`company-${whatsapp.companyId}-whatsapp`, {
                  action: "update",
                  whatsapp
                });
              }
            }
          }
        );
        wsocket.ev.on("creds.update", saveState);

        wsocket.ev.on(
          "presence.update",
          async ({ id: remoteJid, presences }) => {
            try {
              logger.debug(
                { remoteJid, presences },
                "Received contact presence"
              );
              if (!presences[remoteJid]?.lastKnownPresence) {
                return;
              }
              const contact = await Contact.findOne({
                where: {
                  number: remoteJid.replace(/\D/g, ""),
                  companyId: whatsapp.companyId
                }
              });
              if (!contact) {
                return;
              }
              const ticket = await Ticket.findOne({
                where: {
                  contactId: contact.id,
                  whatsappId: whatsapp.id,
                  status: {
                    [Op.or]: ["open", "pending"]
                  }
                }
              });

              if (ticket) {
                io.to(ticket.id.toString())
                  .to(`company-${whatsapp.companyId}-${ticket.status}`)
                  .to(`queue-${ticket.queueId}-${ticket.status}`)
                  .emit(`company-${whatsapp.companyId}-presence`, {
                    ticketId: ticket.id,
                    presence: presences[remoteJid].lastKnownPresence
                  });
              }
            } catch (error) {
              logger.error(
                { remoteJid, presences },
                "presence.update: error processing"
              );
              if (error instanceof Error) {
                logger.error(`Error: ${error.name} ${error.message}`);
              } else {
                logger.error(`Error was object of type: ${typeof error}`);
              }
            }
          }
        );

        store.bind(wsocket.ev);
        wsocket.store = store as any;
      })();
    } catch (error) {
      Sentry.captureException(error);
      console.log("error-wbot: ", error);
      reject(error);
    }
  });
};
