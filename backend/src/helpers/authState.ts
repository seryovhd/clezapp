import type {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap
} from "@whiskeysockets/baileys";
import { BufferJSON, initAuthCreds, proto } from "@whiskeysockets/baileys";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";

const KEY_MAP: Partial<{ [T in keyof SignalDataTypeMap]: string }> = {
  "pre-key": "preKeys",
  session: "sessions",
  "sender-key": "senderKeys",
  "app-state-sync-key": "appStateSyncKeys",
  "app-state-sync-version": "appStateVersions",
  "sender-key-memory": "senderKeyMemory",
  "lid-mapping": "lidMapping",
  "device-list": "deviceList",
  tctoken: "tctoken"
};

const authState = async (
  whatsapp: Whatsapp
): Promise<{ state: AuthenticationState; saveState: () => void }> => {
  let creds: AuthenticationCreds;
  let keys: any = {};

  // ✅ GUARDADO ROBUSTO CON REINTENTOS
  const saveState = async () => {
    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        const sessionData = JSON.stringify({ creds, keys }, BufferJSON.replacer, 0);

        await whatsapp.update({
          session: sessionData
        });

        logger.info(`✅ Sesión guardada para WhatsApp: ${whatsapp.name}`);
        break; // Éxito, salir del loop
      } catch (error) {
        retries++;
        logger.error(`⚠️ Error guardando sesión (intento ${retries}/${maxRetries}):`, error);

        if (retries === maxRetries) {
          logger.error('❌ No se pudo guardar la sesión después de múltiples intentos');
        } else {
          // Esperar antes de reintentar
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
    }
  };

  // ✅ CARGA DE SESIÓN CON VALIDACIÓN
  if (whatsapp.session && whatsapp.session !== null && whatsapp.session !== "null") {
    try {
      const result = JSON.parse(whatsapp.session, BufferJSON.reviver);

      // Validar que las credenciales existen y tienen estructura correcta
      if (result.creds && result.creds.noiseKey && result.creds.signedIdentityKey) {
        creds = result.creds;
        keys = result.keys || {};
        logger.info(`✅ Sesión recuperada de BD para: ${whatsapp.name}`);
      } else {
        throw new Error('Estructura de credenciales inválida');
      }
    } catch (error) {
      logger.error(`❌ Error parseando sesión para ${whatsapp.name}:`, error);
      // Si hay error al parsear, iniciar sesión nueva
      creds = initAuthCreds();
      keys = {};
      logger.info(`🆕 Nueva sesión creada para: ${whatsapp.name}`);
    }
  } else {
    creds = initAuthCreds();
    keys = {};
    logger.info(`🆕 Nueva sesión creada para: ${whatsapp.name}`);
  }

  return {
    state: {
      creds,
      keys: {
        get: (type, ids) => {
          const key = KEY_MAP[type];
          return ids.reduce((dict: any, id) => {
            let value = keys[key]?.[id];
            if (value) {
              if (type === "app-state-sync-key") {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              dict[id] = value;
            }
            return dict;
          }, {});
        },
        set: (data: any) => {
          for (const i in data) {
            const key = KEY_MAP[i as keyof SignalDataTypeMap];
            keys[key] = keys[key] || {};
            Object.assign(keys[key], data[i]);
          }
          // ✅ GUARDADO ASINCRÓNICO SIN BLOQUEAR
          saveState().catch(error => {
            logger.error('Error en guardado asíncrono:', error);
          });
        }
      }
    },
    saveState
  };
};

export default authState;