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

  let saveTimeout: NodeJS.Timeout | null = null;
  let isSaving = false;
  let hasPendingChanges = false;

  // ✅ GUARDADO ROBUSTO CON DEBOUNCE (Evita saturar heap de memoria con JSON.stringify masivos)
  const doSave = async () => {
    if (isSaving) {
      hasPendingChanges = true;
      return;
    }

    isSaving = true;
    hasPendingChanges = false;

    try {
      const sessionData = JSON.stringify({ creds, keys }, BufferJSON.replacer, 0);

      await whatsapp.update({
        session: sessionData
      });

      logger.info(`✅ Sesión guardada para WhatsApp: ${whatsapp.name}`);
    } catch (error) {
      logger.error(`⚠️ Error guardando sesión para ${whatsapp.name}:`, error);
    } finally {
      isSaving = false;
      if (hasPendingChanges) {
        hasPendingChanges = false;
        scheduleSave(1000);
      }
    }
  };

  const scheduleSave = (delay = 2000) => {
    hasPendingChanges = true;
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      saveTimeout = null;
      doSave().catch(err => logger.error("Error en doSave:", err));
    }, delay);
  };

  const saveState = () => {
    scheduleSave(2000);
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
          // Debounced save para evitar leak de memoria y freeze
          scheduleSave(2500);
        }
      }
    },
    saveState
  };
};

export default authState;