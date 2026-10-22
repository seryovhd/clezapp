import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.describeTable("BaileysMessages");
      console.log("BaileysMessages already exists, skipping createTable");
    } catch (e) {
      return queryInterface.createTable("BaileysMessages", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        whatsappId: {
          type: DataTypes.INTEGER,
          references: { model: "Whatsapps", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        baileysChatId: {
          type: DataTypes.INTEGER,
          references: { model: "BaileysChats", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        jsonMessage: {
          type: DataTypes.JSON,
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
    }
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("BaileysMessages");
  }
};
