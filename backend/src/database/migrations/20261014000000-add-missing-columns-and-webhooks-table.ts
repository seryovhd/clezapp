import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // =========================================================================
    // 1. TABLA: Contacts - Asegurar columnas lid, lidWarningAt, canal, etc.
    // =========================================================================
    try {
      const contactsTable: any = await queryInterface.describeTable("Contacts");

      if (!contactsTable.lid) {
        await queryInterface.addColumn("Contacts", "lid", {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null
        });
        console.log("✅ Columna lid agregada a Contacts");
      }

      if (!contactsTable.lidWarningAt) {
        await queryInterface.addColumn("Contacts", "lidWarningAt", {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null
        });
        console.log("✅ Columna lidWarningAt agregada a Contacts");
      }

      if (!contactsTable.canal) {
        await queryInterface.addColumn("Contacts", "canal", {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null
        });
        console.log("✅ Columna canal agregada a Contacts");
      }

      if (!contactsTable.messengerId) {
        await queryInterface.addColumn("Contacts", "messengerId", {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null
        });
        console.log("✅ Columna messengerId agregada a Contacts");
      }

      if (!contactsTable.instagramId) {
        await queryInterface.addColumn("Contacts", "instagramId", {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null
        });
        console.log("✅ Columna instagramId agregada a Contacts");
      }

      if (!contactsTable.disableBot) {
        await queryInterface.addColumn("Contacts", "disableBot", {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        });
        console.log("✅ Columna disableBot agregada a Contacts");
      }
    } catch (e) {
      console.log("Error verificando/agregando columnas a Contacts:", e);
    }

    // =========================================================================
    // 2. TABLA: Webhooks - Crear tabla si no existe
    // =========================================================================
    try {
      let webhooksExists = true;
      try {
        await queryInterface.describeTable("Webhooks");
      } catch (err) {
        webhooksExists = false;
      }

      if (!webhooksExists) {
        await queryInterface.createTable("Webhooks", {
          id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false
          },
          user_id: {
            type: DataTypes.INTEGER,
            allowNull: true
          },
          hash_id: {
            type: DataTypes.STRING,
            allowNull: true
          },
          company_id: {
            type: DataTypes.INTEGER,
            allowNull: true
          },
          name: {
            type: DataTypes.STRING,
            allowNull: true
          },
          active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
          },
          requestMonth: {
            type: DataTypes.INTEGER,
            defaultValue: 0
          },
          requestAll: {
            type: DataTypes.INTEGER,
            defaultValue: 0
          },
          config: {
            type: DataTypes.JSON,
            allowNull: true
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false
          }
        });
        console.log("✅ Tabla Webhooks creada exitosamente");
      }
    } catch (e) {
      console.log("Error verificando/creando tabla Webhooks:", e);
    }

    // =========================================================================
    // 3. TABLA: Whatsapps - Asegurar connectionType, instanceName, type
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

    // =========================================================================
    // 4. TABLA: Tickets - Asegurar columnas de flowWebhook, lastFlowId, dataWebhook
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
    } catch (e) {
      console.log("Error verificando columnas en Tickets:", e);
    }

    // =========================================================================
    // 5. TABLA: Messages - Asegurar isPrivate, isEdited, isForwarded
    // =========================================================================
    try {
      const messagesTable: any = await queryInterface.describeTable("Messages");

      if (!messagesTable.isPrivate) {
        await queryInterface.addColumn("Messages", "isPrivate", {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        });
      }

      if (!messagesTable.isEdited) {
        await queryInterface.addColumn("Messages", "isEdited", {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        });
      }

      if (!messagesTable.isForwarded) {
        await queryInterface.addColumn("Messages", "isForwarded", {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        });
      }
    } catch (e) {
      console.log("Error verificando columnas en Messages:", e);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.removeColumn("Contacts", "lid");
      await queryInterface.removeColumn("Contacts", "lidWarningAt");
    } catch (e) {}
  }
};
