import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // 1. Crear tabla LidMappings si no existe
    const tables = await queryInterface.showAllTables();
    const hasLidMappings = tables.some(
      (t: any) =>
        t === "LidMappings" ||
        t.tableName === "LidMappings" ||
        t === "lidmappings" ||
        t.tableName === "lidmappings"
    );

    if (!hasLidMappings) {
      await queryInterface.createTable("LidMappings", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        companyId: {
          type: DataTypes.INTEGER,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false
        },
        lid: {
          type: DataTypes.STRING,
          allowNull: false
        },
        phoneNumber: {
          type: DataTypes.STRING,
          allowNull: false
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

      console.log("✅ Tabla LidMappings creada con éxito.");
    }

    // 2. Crear índices para búsquedas ultrarrápidas
    try {
      await queryInterface.addIndex("LidMappings", ["companyId", "lid"], {
        name: "idx_lid_mappings_company_lid",
        unique: false
      });
    } catch (e) {}

    try {
      await queryInterface.addIndex("LidMappings", ["phoneNumber"], {
        name: "idx_lid_mappings_phone",
        unique: false
      });
    } catch (e) {}

    // 3. Asegurar índice en Contacts para campo lid
    try {
      await queryInterface.addIndex("Contacts", ["companyId", "lid"], {
        name: "idx_contacts_company_lid",
        unique: false
      });
    } catch (e) {}
  },

  down: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.removeIndex("Contacts", "idx_contacts_company_lid");
    } catch (e) {}

    try {
      await queryInterface.dropTable("LidMappings");
    } catch (e) {}
  }
};
