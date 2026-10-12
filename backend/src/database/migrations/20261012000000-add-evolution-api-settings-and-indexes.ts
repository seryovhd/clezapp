import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // 1. Agregar índices de alto rendimiento a Messages para eliminar el lag
    try {
      await queryInterface.addIndex("Messages", ["ticketId", "createdAt"], {
        name: "idx_messages_ticketId_createdAt"
      });
    } catch (e) {
      console.log("Index idx_messages_ticketId_createdAt already exists or skipped");
    }

    try {
      await queryInterface.addIndex("Messages", ["companyId"], {
        name: "idx_messages_companyId"
      });
    } catch (e) {
      console.log("Index idx_messages_companyId already exists or skipped");
    }

    // 2. Verificar y agregar columna connectionType y instanceName a Whatsapps si no existen
    try {
      const tableInfo: any = await queryInterface.describeTable("Whatsapps");
      if (!tableInfo.connectionType) {
        await queryInterface.addColumn("Whatsapps", "connectionType", {
          type: DataTypes.STRING,
          defaultValue: "evolution",
          allowNull: true
        });
      }
      if (!tableInfo.instanceName) {
        await queryInterface.addColumn("Whatsapps", "instanceName", {
          type: DataTypes.STRING,
          allowNull: true
        });
      }
    } catch (e) {
      console.log("Error verifying Whatsapps columns:", e);
    }

    // 3. Insertar configuraciones iniciales de Evolution API en Settings para la empresa 1
    try {
      const now = new Date();
      const defaultSettings = [
        {
          key: "evolutionApiUrl",
          value: "http://localhost:8080",
          companyId: 1,
          createdAt: now,
          updatedAt: now
        },
        {
          key: "evolutionApiKey",
          value: "",
          companyId: 1,
          createdAt: now,
          updatedAt: now
        },
        {
          key: "evolutionApiEnabled",
          value: "enabled",
          companyId: 1,
          createdAt: now,
          updatedAt: now
        }
      ];

      for (const s of defaultSettings) {
        const existing = await queryInterface.rawSelect(
          "Settings",
          {
            where: {
              key: s.key,
              companyId: s.companyId
            }
          },
          ["id"]
        );

        if (!existing) {
          await queryInterface.bulkInsert("Settings", [s]);
        }
      }
    } catch (e) {
      console.log("Error inserting default evolution settings:", e);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.removeIndex("Messages", "idx_messages_ticketId_createdAt");
    } catch (e) {}
    try {
      await queryInterface.removeIndex("Messages", "idx_messages_companyId");
    } catch (e) {}
  }
};
