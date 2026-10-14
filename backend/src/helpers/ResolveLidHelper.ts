import Contact from "../models/Contact";
import Whatsapp from "../models/Whatsapp";
import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";

/**
 * Resuelve un ID de privacidad de WhatsApp (@lid) al número de teléfono real (@s.whatsapp.net)
 */
export const resolveLidToPhone = async (
  lidNumber: string,
  wbot?: any,
  companyId?: number
): Promise<string | null> => {
  if (!lidNumber) return null;
  const cleanLid = lidNumber.replace(/@.*$/, "").replace(/\D/g, "");
  if (!cleanLid || cleanLid.length < 8) return null;

  try {
    // 1. Intentar desde authState keys en memoria si wbot tiene signal key store
    if (wbot?.authState?.keys?.get) {
      try {
        const mapping = await wbot.authState.keys.get("lid-mapping", [
          `${cleanLid}_reverse`,
          cleanLid
        ]);
        const candidate = mapping?.[`${cleanLid}_reverse`] || mapping?.[cleanLid];
        if (candidate) {
          const phone = String(candidate).replace(/\D/g, "");
          if (phone && phone.length >= 8 && phone.length <= 14 && phone !== cleanLid) {
            logger.info(`🔍 [ResolveLid] Resuelto LID ${cleanLid} -> ${phone} vía Baileys authState`);
            return phone;
          }
        }
      } catch (e) {}
    }

    // 2. Intentar desde la base de datos en la tabla Whatsapps (session JSON)
    const whatsappId = wbot?.id;
    if (whatsappId) {
      const whatsapp = await Whatsapp.findByPk(whatsappId, { attributes: ["session"] });
      if (whatsapp?.session) {
        try {
          const sess = JSON.parse(whatsapp.session);
          const candidate =
            sess.keys?.lidMapping?.[`${cleanLid}_reverse`] ||
            sess.keys?.lidMapping?.[cleanLid];
          if (candidate) {
            const phone = String(candidate).replace(/\D/g, "");
            if (phone && phone.length >= 8 && phone.length <= 14 && phone !== cleanLid) {
              logger.info(`🔍 [ResolveLid] Resuelto LID ${cleanLid} -> ${phone} vía Whatsapps session`);
              return phone;
            }
          }
        } catch (e) {}
      }
    }

    // 3. Buscar en la tabla Contacts si algún contacto ya tiene registrado este LID y un número real
    if (companyId) {
      const existingContact = await Contact.findOne({
        where: {
          companyId,
          lid: cleanLid
        },
        attributes: ["id", "number", "lid"]
      });

      if (existingContact && existingContact.number) {
        const phone = existingContact.number.replace(/\D/g, "");
        if (phone && phone.length >= 8 && phone.length <= 14 && phone !== cleanLid) {
          logger.info(`🔍 [ResolveLid] Resuelto LID ${cleanLid} -> ${phone} vía Contact ${existingContact.id}`);
          return phone;
        }
      }
    }
  } catch (err) {
    logger.error("Error en resolveLidToPhone:", err);
  }

  return null;
};

/**
 * Resuelve un número real al LID correspondiente
 */
export const resolvePhoneToLid = async (
  phone: string,
  wbot?: any
): Promise<string | null> => {
  if (!phone) return null;
  const cleanPhone = phone.replace(/@.*$/, "").replace(/\D/g, "");
  if (!cleanPhone) return null;

  try {
    if (wbot?.authState?.keys?.get) {
      try {
        const mapping = await wbot.authState.keys.get("lid-mapping", [cleanPhone]);
        if (mapping?.[cleanPhone]) {
          return String(mapping[cleanPhone]).replace(/\D/g, "");
        }
      } catch (e) {}
    }

    const whatsappId = wbot?.id;
    if (whatsappId) {
      const whatsapp = await Whatsapp.findByPk(whatsappId, { attributes: ["session"] });
      if (whatsapp?.session) {
        try {
          const sess = JSON.parse(whatsapp.session);
          const candidate = sess.keys?.lidMapping?.[cleanPhone];
          if (candidate) return String(candidate).replace(/\D/g, "");
        } catch (e) {}
      }
    }
  } catch (err) {
    logger.error("Error en resolvePhoneToLid:", err);
  }

  return null;
};

/**
 * Obtiene el JID de destino óptimo para enviar mensajes.
 * PRIORIDAD 1: Si es grupo -> @g.us
 * PRIORIDAD 2: Si tiene número telefónico real (8-14 dígitos) -> @s.whatsapp.net (100% confiable)
 * PRIORIDAD 3: Si es LID (15+ dígitos), intentar resolver a número real y enviar a @s.whatsapp.net
 * PRIORIDAD 4: Fallback extremo -> @lid
 */
export const getDestinationJid = async (
  ticket: Ticket,
  wbot?: any
): Promise<string> => {
  if (ticket.isGroup) {
    const groupNum = ticket.contact.number;
    return groupNum.includes("@g.us") ? groupNum : `${groupNum}@g.us`;
  }

  const rawNumber = ticket.contact.number || "";
  const cleanDestNumber = rawNumber.replace(/@.*$/, "").replace(/\D/g, "");
  const cleanLid = ticket.contact.lid
    ? ticket.contact.lid.replace(/@.*$/, "").replace(/\D/g, "")
    : "";

  // Determinar si el destino es un LID:
  // - rawNumber termina en @lid
  // - cleanLid está definido y es igual a cleanDestNumber
  // - cleanDestNumber tiene 14 dígitos o más (los LIDs son típicamente 14-16 dígitos)
  const isLid =
    rawNumber.endsWith("@lid") ||
    (Boolean(cleanLid) && cleanDestNumber === cleanLid) ||
    cleanDestNumber.length >= 14;

  if (isLid) {
    const lidCandidate = cleanLid || cleanDestNumber;

    // Intentar resolver a número real si está mapeado en Baileys authState o en la base de datos
    const resolvedPhone = await resolveLidToPhone(lidCandidate, wbot, ticket.companyId);
    if (resolvedPhone) {
      logger.info(`📲 [DestJid] Redirigiendo envío de LID ${lidCandidate} al número real ${resolvedPhone}@s.whatsapp.net`);
      return `${resolvedPhone}@s.whatsapp.net`;
    }

    // Si NO se puede resolver a número real, enviar directamente al @lid
    logger.info(`📲 [DestJid] Enviando mensaje directamente al LID: ${lidCandidate}@lid`);
    return `${lidCandidate}@lid`;
  }

  // Si tiene un número telefónico real estándar (8 a 13 dígitos y no es LID):
  return `${cleanDestNumber}@s.whatsapp.net`;
};
