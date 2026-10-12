import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.changeColumn("Prompts", "temperature", {
      type: DataTypes.FLOAT,
      allowNull: true
    });

    await queryInterface.addColumn("Prompts", "model", {
      type: DataTypes.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Prompts", "model");

    await queryInterface.changeColumn("Prompts", "temperature", {
      type: DataTypes.INTEGER,
      allowNull: true
    });
  }
};
