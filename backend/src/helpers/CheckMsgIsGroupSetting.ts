import Setting from "../models/Setting";

interface CacheEntry {
  value: boolean;
  expiresAt: number;
}

const groupSettingCache = new Map<number, CacheEntry>();

/**
 * Consulta si los mensajes de grupo deben ser ignorados para la compañía dada.
 * Utiliza una caché en memoria de 30 segundos para evitar consultas repetitivas a la base de datos
 * en bucles de alta frecuencia de mensajes entrantes.
 */
export const isGroupMessageIgnored = async (companyId: number): Promise<boolean> => {
  const now = Date.now();
  const cached = groupSettingCache.get(companyId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const setting = await Setting.findOne({
      where: {
        companyId,
        key: "CheckMsgIsGroup"
      },
      attributes: ["value"]
    });

    const isIgnored = setting?.value === "enabled";
    groupSettingCache.set(companyId, {
      value: isIgnored,
      expiresAt: now + 30000 // 30s TTL
    });

    return isIgnored;
  } catch (err) {
    return false;
  }
};

/**
 * Invalida la caché del ajuste de grupos, por ejemplo cuando el usuario cambia el setting en la UI.
 */
export const invalidateGroupMessageSettingCache = (companyId?: number): void => {
  if (companyId) {
    groupSettingCache.delete(companyId);
  } else {
    groupSettingCache.clear();
  }
};
