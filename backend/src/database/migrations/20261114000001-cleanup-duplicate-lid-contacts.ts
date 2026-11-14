import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Buscar contactos huérfanos creados con números de LID que coinciden con contactos reales existentes por nombre o por LID registrado
    try {
      console.log("🧹 [Migration Clean] Iniciando saneamiento de contactos LID duplicados...");

      // 1. Identificar contactos cuyo 'number' tenga 14+ dígitos (número asignado como LID) y cuyo campo 'lid' tenga ese mismo valor
      const [duplicateLidContacts]: any = await queryInterface.sequelize.query(`
        SELECT id, name, number, lid, "companyId" 
        FROM "Contacts" 
        WHERE LENGTH(number) >= 14 
          AND number ~ '^[0-9]+$'
          AND (number = lid OR lid IS NOT NULL);
      `);

      if (!duplicateLidContacts || duplicateLidContacts.length === 0) {
        console.log("ℹ️ No se detectaron contactos huérfanos con números LID.");
        return;
      }

      console.log(`🔍 Se encontraron ${duplicateLidContacts.length} contactos provisionales LID para evaluar.`);

      for (const lidContact of duplicateLidContacts) {
        const lidNumber = lidContact.lid || lidContact.number;
        const companyId = lidContact.companyId;

        // Buscar si existe un contacto real para la misma empresa con el mismo nombre (ignorado mayúsculas/minúsculas)
        // pero con un número telefónico real (longitud entre 9 y 13 dígitos)
        const [realCandidates]: any = await queryInterface.sequelize.query(`
          SELECT id, name, number, "companyId"
          FROM "Contacts"
          WHERE "companyId" = ${companyId}
            AND id != ${lidContact.id}
            AND LENGTH(number) BETWEEN 9 AND 13
            AND LOWER(TRIM(name)) = LOWER(TRIM('${lidContact.name.replace(/'/g, "''")}'))
          LIMIT 1;
        `);

        if (realCandidates && realCandidates.length > 0) {
          const realContact = realCandidates[0];
          console.log(`🔄 Fusionando contacto LID provisional ID ${lidContact.id} (${lidContact.name} - ${lidNumber}) en contacto real ID ${realContact.id} (${realContact.name} - ${realContact.number})`);

          // 1. Traspasar tickets
          await queryInterface.sequelize.query(`
            UPDATE "Tickets" 
            SET "contactId" = ${realContact.id} 
            WHERE "contactId" = ${lidContact.id} AND "companyId" = ${companyId};
          `);

          // 2. Traspasar mensajes
          await queryInterface.sequelize.query(`
            UPDATE "Messages" 
            SET "contactId" = ${realContact.id} 
            WHERE "contactId" = ${lidContact.id} AND "companyId" = ${companyId};
          `);

          // 3. Actualizar lid en el contacto real
          await queryInterface.sequelize.query(`
            UPDATE "Contacts" 
            SET "lid" = '${lidNumber}' 
            WHERE id = ${realContact.id};
          `);

          // 4. Guardar en LidMappings
          await queryInterface.sequelize.query(`
            INSERT INTO "LidMappings" ("companyId", "lid", "phoneNumber", "createdAt", "updatedAt")
            VALUES (${companyId}, '${lidNumber}', '${realContact.number}', NOW(), NOW())
            ON CONFLICT DO NOTHING;
          `);

          // 5. Eliminar campos personalizados y el contacto provisional duplicado
          await queryInterface.sequelize.query(`
            DELETE FROM "ContactCustomFields" WHERE "contactId" = ${lidContact.id};
          `);

          await queryInterface.sequelize.query(`
            DELETE FROM "Contacts" WHERE id = ${lidContact.id};
          `);

          console.log(`✅ Fusión exitosa para ${realContact.name}.`);
        }
      }
    } catch (err: any) {
      console.error("⚠️ Error durante el saneamiento automático de contactos LID:", err.message);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    // Operación de limpieza no reversible
  }
};
