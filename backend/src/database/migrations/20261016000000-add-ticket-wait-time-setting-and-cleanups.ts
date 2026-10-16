import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    console.log("🚀 Iniciando migración 20261016000000: add-ticket-wait-time-setting-and-cleanups...");

    // =========================================================================
    // 1. SETTINGS: Poblar y asegurar configuraciones clave para todas las empresas
    // =========================================================================
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

      // Configuraciones indispensables para una instalación limpia o actualización
      const defaultSettingsToEnsure = [
        { key: "showTicketWaitTime", value: "disabled" },
        { key: "evolutionApiUrl", value: "http://localhost:8080" },
        { key: "evolutionApiKey", value: "" },
        { key: "evolutionApiEnabled", value: "enabled" },
        { key: "rememberCustomerAgent", value: "disabled" },
        { key: "viewclosed", value: "disabled" },
        { key: "viewgroups", value: "disabled" },
        { key: "allTicket", value: "enabled" },
        { key: "sendGreetingAccepted", value: "disabled" },
        { key: "sendMsgTransfTicket", value: "disabled" },
        { key: "sendGreetingMessageOneQueues", value: "disabled" },
        { key: "hubToken", value: "" },
        { key: "chatBotType", value: "text" },
        { key: "userRating", value: "disabled" },
        { key: "scheduleType", value: "queue" },
        { key: "CheckMsgIsGroup", value: "enabled" },
        { key: "call", value: "disabled" }
      ];

      for (const comp of companies) {
        const companyId = comp.id || 1;

        for (const s of defaultSettingsToEnsure) {
          try {
            const existing = await queryInterface.rawSelect(
              "Settings",
              {
                where: {
                  key: s.key,
                  companyId
                }
              },
              ["id"]
            );

            if (!existing) {
              await queryInterface.bulkInsert("Settings", [
                {
                  key: s.key,
                  value: s.value,
                  companyId,
                  createdAt: now,
                  updatedAt: now
                }
              ]);
              console.log(`✅ Setting insertado: ${s.key} para empresa ${companyId}`);
            }
          } catch (e) {
            console.log(`Aviso al insertar setting ${s.key} para empresa ${companyId}:`, e);
          }
        }
      }
    } catch (e) {
      console.log("Error sincronizando Settings por empresa:", e);
    }

    // =========================================================================
    // 2. TICKETS: Asegurar columnas e índices de rendimiento
    // =========================================================================
    try {
      const ticketsTable: any = await queryInterface.describeTable("Tickets");

      if (!ticketsTable.flowWebhook) {
        await queryInterface.addColumn("Tickets", "flowWebhook", {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: false
        });
      }

      if (!ticketsTable.lastFlowId) {
        await queryInterface.addColumn("Tickets", "lastFlowId", {
          type: DataTypes.STRING,
          allowNull: true
        });
      }

      if (!ticketsTable.hashFlowId) {
        await queryInterface.addColumn("Tickets", "hashFlowId", {
          type: DataTypes.STRING,
          allowNull: true
        });
      }

      if (!ticketsTable.flowStopped) {
        await queryInterface.addColumn("Tickets", "flowStopped", {
          type: DataTypes.STRING,
          allowNull: true
        });
      }

      if (!ticketsTable.dataWebhook) {
        await queryInterface.addColumn("Tickets", "dataWebhook", {
          type: DataTypes.JSON,
          allowNull: true
        });
      }

      // Índice para optimizar consultas de tickets por estado y fecha de última interacción
      try {
        await queryInterface.addIndex("Tickets", ["companyId", "status"], {
          name: "idx_tickets_companyId_status"
        });
      } catch (idxErr) {}

      try {
        await queryInterface.addIndex("Tickets", ["updatedAt"], {
          name: "idx_tickets_updatedAt"
        });
      } catch (idxErr) {}

    } catch (e) {
      console.log("Error verificando columnas en Tickets:", e);
    }

    // =========================================================================
    // 3. CONTACTS: Asegurar columnas necesarias
    // =========================================================================
    try {
      const contactsTable: any = await queryInterface.describeTable("Contacts");

      if (!contactsTable.lid) {
        await queryInterface.addColumn("Contacts", "lid", {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null
        });
      }

      if (!contactsTable.lidWarningAt) {
        await queryInterface.addColumn("Contacts", "lidWarningAt", {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null
        });
      }

      if (!contactsTable.canal) {
        await queryInterface.addColumn("Contacts", "canal", {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null
        });
      }

      if (!contactsTable.disableBot) {
        await queryInterface.addColumn("Contacts", "disableBot", {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        });
      }
    } catch (e) {
      console.log("Error verificando columnas en Contacts:", e);
    }

    // =========================================================================
    // 4. WHATSAPPS: Asegurar connectionType, instanceName y type
    // =========================================================================
    try {
      const whatsappsTable: any = await queryInterface.describeTable("Whatsapps");

      if (!whatsappsTable.connectionType) {
        await queryInterface.addColumn("Whatsapps", "connectionType", {
          type: DataTypes.STRING,
          defaultValue: "evolution",
          allowNull: true
        });
      }

      if (!whatsappsTable.instanceName) {
        await queryInterface.addColumn("Whatsapps", "instanceName", {
          type: DataTypes.STRING,
          allowNull: true
        });
      }

      if (!whatsappsTable.type) {
        await queryInterface.addColumn("Whatsapps", "type", {
          type: DataTypes.STRING,
          defaultValue: "whatsapp",
          allowNull: true
        });
      }
    } catch (e) {
      console.log("Error verificando columnas en Whatsapps:", e);
    }

    console.log("✅ Migración 20261016000000 completada exitosamente.");
  },

  down: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.bulkDelete("Settings", {
        key: "showTicketWaitTime"
      });
    } catch (e) {}

    try {
      await queryInterface.removeIndex("Tickets", "idx_tickets_companyId_status");
    } catch (e) {}

    try {
      await queryInterface.removeIndex("Tickets", "idx_tickets_updatedAt");
    } catch (e) {}
  }
};
