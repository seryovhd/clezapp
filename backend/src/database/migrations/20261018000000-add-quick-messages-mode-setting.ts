import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    console.log("🚀 Iniciando migración 20261018000000: add-quick-messages-mode-setting...");

    try {
      const now = new Date();

      // Obtener todas las empresas existentes
      let companies: any[] = [];
      try {
        companies = (await queryInterface.sequelize.query(
          `SELECT id FROM "Companies"`,
          { type: (queryInterface.sequelize as any).QueryTypes?.SELECT || "SELECT" }
        )) as any[];
      } catch (err) {
        companies = [{ id: 1 }];
      }

      if (!companies || companies.length === 0) {
        companies = [{ id: 1 }];
      }

      for (const comp of companies) {
        const companyId = comp.id || 1;

        try {
          const existing = await queryInterface.rawSelect(
            "Settings",
            {
              where: {
                key: "quickMessagesMode",
                companyId
              }
            },
            ["id"]
          );

          if (!existing) {
            await queryInterface.bulkInsert("Settings", [
              {
                key: "quickMessagesMode",
                value: "both",
                companyId,
                createdAt: now,
                updatedAt: now
              }
            ]);
            console.log(`   ➕ Setting quickMessagesMode creado para empresa ${companyId}`);
          }
        } catch (setErr: any) {
          console.warn(`   ⚠️ Advertencia al verificar quickMessagesMode para empresa ${companyId}:`, setErr?.message);
        }
      }

      console.log("✅ Migración 20261018000000 finalizada con éxito.");
    } catch (error) {
      console.error("❌ Error en migración 20261018000000:", error);
      throw error;
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.bulkDelete("Settings", {
      key: "quickMessagesMode"
    });
  }
};
