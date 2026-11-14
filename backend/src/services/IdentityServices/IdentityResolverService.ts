import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import LidMapping from "../../models/LidMapping";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import ContactCustomField from "../../models/ContactCustomField";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";

export interface ResolvedIdentity {
  phoneNumber: string;
  lid?: string;
  isLid: boolean;
  wasResolved: boolean;
}

export class IdentityResolverService {
  /**
   * Guarda o actualiza un mapeo persistente de (LID <-> Phone)
   */
  public static async saveLidMapping(
    companyId: number,
    lid: string,
    phoneNumber: string
  ): Promise<void> {
    if (!companyId || !lid || !phoneNumber) return;
    const cleanLid = lid.replace(/@.*$/, "").replace(/\D/g, "");
    const cleanPhone = phoneNumber.replace(/@.*$/, "").replace(/\D/g, "");

    if (!cleanLid || !cleanPhone || cleanLid === cleanPhone || cleanPhone.length < 8 || cleanPhone.length > 14) {
      return;
    }

    try {
      const [mapping, created] = await LidMapping.findOrCreate({
        where: { companyId, lid: cleanLid },
        defaults: {
          companyId,
          lid: cleanLid,
          phoneNumber: cleanPhone
        }
      });

      if (!created && mapping.phoneNumber !== cleanPhone) {
        await mapping.update({ phoneNumber: cleanPhone });
        logger.info(`🔄 [IdentityResolver] Mapeo actualizado en BD: LID ${cleanLid} -> ${cleanPhone}`);
      } else if (created) {
        logger.info(`✨ [IdentityResolver] Nuevo mapeo persistido en BD: LID ${cleanLid} -> ${cleanPhone}`);
      }

      // Actualizar también en el contacto si ya existe con este número
      const existingContact = await Contact.findOne({
        where: { companyId, number: cleanPhone }
      });
      if (existingContact && existingContact.lid !== cleanLid) {
        await existingContact.update({ lid: cleanLid });
        logger.info(`📱 [IdentityResolver] Contacto ${existingContact.id} enlazado con LID ${cleanLid}`);
      }
    } catch (err) {
      logger.error("Error en saveLidMapping:", err);
    }
  }

  /**
   * Resuelve cualquier identificador (JID, LID, Phone) al número telefónico real.
   * Consulta recursivamente:
   * 1. Parámetros directos o metadatos (senderPn, participantPn, remoteJidAlt)
   * 2. Tabla LidMappings en PostgreSQL
   * 3. Tabla Contacts con campo lid
   * 4. Almacén de sesiones Baileys (wbot authState o Whatsapps session)
   */
  public static async resolve(
    identifier: string,
    companyId: number,
    options?: {
      wbot?: any;
      metadata?: any;
    }
  ): Promise<ResolvedIdentity> {
    const raw = (identifier || "").trim();
    const clean = raw.replace(/@.*$/, "").replace(/\D/g, "");

    // Si es vacío o inválido
    if (!clean) {
      return { phoneNumber: clean, isLid: false, wasResolved: false };
    }

    // Comprobar si es un LID:
    // - Termina en @lid
    // - O tiene longitud >= 14 y NO termina en @s.whatsapp.net ni @g.us
    const isLid = raw.endsWith("@lid") || (clean.length >= 14 && !raw.includes("@s.whatsapp.net") && !raw.includes("@g.us"));

    if (!isLid) {
      return { phoneNumber: clean, lid: undefined, isLid: false, wasResolved: false };
    }

    const cleanLid = clean;

    // 1. Revisar metadatos explícitos pasados (Evolution o Baileys)
    const meta = options?.metadata;
    if (meta) {
      const candidatePn =
        meta.key?.senderPn ||
        meta.senderPn ||
        meta.key?.participantPn ||
        meta.participantPn ||
        (meta.key?.remoteJidAlt && !meta.key.remoteJidAlt.endsWith("@lid") ? meta.key.remoteJidAlt : null) ||
        (meta.remoteJidAlt && !meta.remoteJidAlt.endsWith("@lid") ? meta.remoteJidAlt : null);

      if (candidatePn) {
        const phone = candidatePn.replace(/@.*$/, "").replace(/\D/g, "");
        if (phone && phone.length >= 8 && phone.length <= 14 && phone !== cleanLid) {
          logger.info(`🎯 [IdentityResolver] Resuelto desde metadatos directos: LID ${cleanLid} -> ${phone}`);
          // Guardar en background
          IdentityResolverService.saveLidMapping(companyId, cleanLid, phone).catch(() => {});
          return { phoneNumber: phone, lid: cleanLid, isLid: true, wasResolved: true };
        }
      }
    }

    // 2. Revisar en tabla LidMappings de PostgreSQL
    try {
      const mapping = await LidMapping.findOne({
        where: { companyId, lid: cleanLid }
      });
      if (mapping && mapping.phoneNumber) {
        const phone = mapping.phoneNumber.replace(/\D/g, "");
        if (phone && phone.length >= 8 && phone.length <= 14 && phone !== cleanLid) {
          logger.info(`⚡ [IdentityResolver] Resuelto desde tabla LidMappings: LID ${cleanLid} -> ${phone}`);
          return { phoneNumber: phone, lid: cleanLid, isLid: true, wasResolved: true };
        }
      }
    } catch (e) {}

    // 3. Revisar en tabla Contacts si algún contacto ya tiene registrado este LID y tiene número real
    try {
      const existingContact = await Contact.findOne({
        where: { companyId, lid: cleanLid },
        attributes: ["id", "number", "lid"]
      });
      if (existingContact && existingContact.number) {
        const phone = existingContact.number.replace(/\D/g, "");
        if (phone && phone.length >= 8 && phone.length <= 14 && phone !== cleanLid) {
          logger.info(`👥 [IdentityResolver] Resuelto desde Contact existente (${existingContact.id}): LID ${cleanLid} -> ${phone}`);
          IdentityResolverService.saveLidMapping(companyId, cleanLid, phone).catch(() => {});
          return { phoneNumber: phone, lid: cleanLid, isLid: true, wasResolved: true };
        }
      }
    } catch (e) {}

    // 4. Intentar con el motor Baileys authState en memoria
    const wbot = options?.wbot;
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
            logger.info(`🔍 [IdentityResolver] Resuelto vía Baileys authState: LID ${cleanLid} -> ${phone}`);
            IdentityResolverService.saveLidMapping(companyId, cleanLid, phone).catch(() => {});
            return { phoneNumber: phone, lid: cleanLid, isLid: true, wasResolved: true };
          }
        }
      } catch (e) {}
    }

    // 5. Intentar desde la sesión persistida de Whatsapp
    const whatsappId = wbot?.id;
    if (whatsappId) {
      try {
        const whatsapp = await Whatsapp.findByPk(whatsappId, { attributes: ["session"] });
        if (whatsapp?.session) {
          const sess = JSON.parse(whatsapp.session);
          const candidate =
            sess.keys?.lidMapping?.[`${cleanLid}_reverse`] ||
            sess.keys?.lidMapping?.[cleanLid];
          if (candidate) {
            const phone = String(candidate).replace(/\D/g, "");
            if (phone && phone.length >= 8 && phone.length <= 14 && phone !== cleanLid) {
              logger.info(`📦 [IdentityResolver] Resuelto vía Whatsapp session JSON: LID ${cleanLid} -> ${phone}`);
              IdentityResolverService.saveLidMapping(companyId, cleanLid, phone).catch(() => {});
              return { phoneNumber: phone, lid: cleanLid, isLid: true, wasResolved: true };
            }
          }
        }
      } catch (e) {}
    }

    // No se pudo resolver todavía (queda pendiente para auto-healing)
    return { phoneNumber: cleanLid, lid: cleanLid, isLid: true, wasResolved: false };
  }

  /**
   * Ejecuta la auto-fusión transparente de un contacto/ticket provisional que se creó con LID
   * cuando por fin se descubre su número telefónico real.
   */
  public static async autoMergeIfDuplicate(
    companyId: number,
    realPhone: string,
    lidNumber: string
  ): Promise<Contact | null> {
    if (!companyId || !realPhone || !lidNumber || realPhone === lidNumber) return null;

    try {
      // Buscar si existe un contacto con el número real
      const realContact = await Contact.findOne({
        where: { companyId, number: realPhone }
      });

      // Buscar si existe un contacto huérfano cuyo número sea el LID
      const lidContact = await Contact.findOne({
        where: { companyId, number: lidNumber }
      });

      if (!realContact || !lidContact || realContact.id === lidContact.id) {
        // Si solo existe el real, aseguramos su campo lid
        if (realContact && realContact.lid !== lidNumber) {
          await realContact.update({ lid: lidNumber });
        }
        return realContact;
      }

      logger.info(
        `🔄 [AutoMerge] FUSIONANDO AUTOMÁTICAMENTE Contacto LID ${lidContact.id} (${lidContact.number}) -> Contacto Real ${realContact.id} (${realContact.number})`
      );

      // 1. Traspasar todos los Tickets del contacto LID al contacto real
      await Ticket.update(
        { contactId: realContact.id },
        { where: { contactId: lidContact.id, companyId } }
      );

      // 2. Traspasar todos los Mensajes del contacto LID al contacto real
      await Message.update(
        { contactId: realContact.id },
        { where: { contactId: lidContact.id, companyId } }
      );

      // 3. Actualizar el campo lid en el contacto real
      await realContact.update({ lid: lidNumber });

      // 4. Copiar campos personalizados o guardarlos
      try {
        await ContactCustomField.findOrCreate({
          where: { contactId: realContact.id, name: "LID WhatsApp" },
          defaults: { contactId: realContact.id, name: "LID WhatsApp", value: lidNumber }
        });
      } catch (e) {}

      // 5. Eliminar el contacto provisional huérfano
      const oldContactId = lidContact.id;
      try {
        await ContactCustomField.destroy({ where: { contactId: oldContactId } });
        await lidContact.destroy();

        // 6. Notificar por Sockets para actualizar el frontend al instante
        const io = getIO();
        io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
          action: "delete",
          contactId: oldContactId
        });

        await realContact.reload({ include: ["extraInfo"] });
        io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
          action: "update",
          contact: realContact
        });

        logger.info(`✅ [AutoMerge] Fusión completada con éxito. Contacto ${oldContactId} unificado en ${realContact.id}`);
      } catch (eDestroy) {
        logger.error("Error al eliminar contacto duplicado en autoMerge:", eDestroy);
      }

      return realContact;
    } catch (err) {
      logger.error("Error en autoMergeIfDuplicate:", err);
      return null;
    }
  }
}
