import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    console.log("🚀 Iniciando migración 20261018150000: ensure-users-and-contacts-integrity...");

    // =========================================================================
    // 1. TABLA: Users - Asegurar todas las columnas requeridas por el modelo
    // =========================================================================
    try {
      const usersTable: any = await queryInterface.describeTable("Users");

      if (!usersTable.allTicket) {
        await queryInterface.addColumn("Users", "allTicket", {
          type: DataTypes.STRING,
          defaultValue: "enabled",
          allowNull: true
        });
        console.log("✅ Columna allTicket agregada a Users");
      }

      if (!usersTable.whatsappNumber) {
        await queryInterface.addColumn("Users", "whatsappNumber", {
          type: DataTypes.TEXT,
          allowNull: true
        });
        console.log("✅ Columna whatsappNumber agregada a Users");
      }

      if (!usersTable.super) {
        await queryInterface.addColumn("Users", "super", {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: true
        });
        console.log("✅ Columna super agregada a Users");
      }

      if (!usersTable.online) {
        await queryInterface.addColumn("Users", "online", {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: true
        });
        console.log("✅ Columna online agregada a Users");
      }

      if (!usersTable.whatsappId) {
        await queryInterface.addColumn("Users", "whatsappId", {
          type: DataTypes.INTEGER,
          allowNull: true
        });
        console.log("✅ Columna whatsappId agregada a Users");
      }

      if (!usersTable.tokenVersion) {
        await queryInterface.addColumn("Users", "tokenVersion", {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          allowNull: true
        });
        console.log("✅ Columna tokenVersion agregada a Users");
      }

      if (!usersTable.resetPassword) {
        await queryInterface.addColumn("Users", "resetPassword", {
          type: DataTypes.STRING,
          allowNull: true
        });
        console.log("✅ Columna resetPassword agregada a Users");
      }

      if (!usersTable.companyId) {
        await queryInterface.addColumn("Users", "companyId", {
          type: DataTypes.INTEGER,
          allowNull: true
        });
        console.log("✅ Columna companyId agregada a Users");
      }
    } catch (e) {
      console.log("Aviso al verificar/agregar columnas a Users:", e);
    }

    // =========================================================================
    // 2. TABLA: Contacts - Asegurar todas las columnas requeridas por el modelo
    // =========================================================================
    try {
      const contactsTable: any = await queryInterface.describeTable("Contacts");

      if (!contactsTable.disableBot) {
        await queryInterface.addColumn("Contacts", "disableBot", {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: true
        });
        console.log("✅ Columna disableBot agregada a Contacts");
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

      if (!contactsTable.active) {
        await queryInterface.addColumn("Contacts", "active", {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
          allowNull: true
        });
        console.log("✅ Columna active agregada a Contacts");
      }

      if (!contactsTable.whatsappId) {
        await queryInterface.addColumn("Contacts", "whatsappId", {
          type: DataTypes.INTEGER,
          allowNull: true
        });
        console.log("✅ Columna whatsappId agregada a Contacts");
      }

      if (!contactsTable.email) {
        await queryInterface.addColumn("Contacts", "email", {
          type: DataTypes.STRING,
          defaultValue: "",
          allowNull: true
        });
        console.log("✅ Columna email agregada a Contacts");
      }

      if (!contactsTable.isGroup) {
        await queryInterface.addColumn("Contacts", "isGroup", {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: true
        });
        console.log("✅ Columna isGroup agregada a Contacts");
      }

      if (!contactsTable.profilePicUrl) {
        await queryInterface.addColumn("Contacts", "profilePicUrl", {
          type: DataTypes.STRING,
          defaultValue: "",
          allowNull: true
        });
        console.log("✅ Columna profilePicUrl agregada a Contacts");
      }
    } catch (e) {
      console.log("Aviso al verificar/agregar columnas a Contacts:", e);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    // Migración idempotente de verificación
  }
};
