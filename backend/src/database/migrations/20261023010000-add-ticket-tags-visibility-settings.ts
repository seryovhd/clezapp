import { QueryInterface, QueryTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    console.log("🚀 Iniciando migración 20261023010000: add-ticket-tags-visibility-settings...");

    try {
      const companies: any[] = await queryInterface.sequelize.query(
        `SELECT id FROM "Companies";`,
        { type: QueryTypes.SELECT }
      );

      const defaultKeys = [
        "hideConnectionTag",
        "hideAgentTag",
        "hideTicketTags"
      ];

      for (const comp of companies) {
        for (const key of defaultKeys) {
          const now = new Date().toISOString();
          await queryInterface.sequelize.query(
            `INSERT INTO "Settings" ("key", "value", "companyId", "createdAt", "updatedAt")
             SELECT :key, 'disabled', :companyId, :now, :now
             WHERE NOT EXISTS (
               SELECT 1 FROM "Settings" WHERE "companyId" = :companyId AND "key" = :key
             );`,
            {
              replacements: {
                key,
                companyId: comp.id,
                now
              }
            }
          );
        }
      }

      console.log("✅ Configuraciones de visibilidad de etiquetas agregadas a Settings con éxito.");
    } catch (e: any) {
      console.error("⚠️ Error insertando configuraciones de visibilidad de etiquetas:", e.message);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.sequelize.query(
        `DELETE FROM "Settings" WHERE "key" IN ('hideConnectionTag', 'hideAgentTag', 'hideTicketTags');`
      );
    } catch (e: any) {
      console.error("⚠️ Error revirtiendo configuraciones de visibilidad de etiquetas:", e.message);
    }
  }
};
