import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("Contacts", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      number: {
        type: DataTypes.STRING,
        allowNull: false
      },
      profilePicUrl: {
        type: DataTypes.STRING
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      messengerId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      instagramId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      // PARCHE 1.3.1 - WEBCHAT
      canal: {
        type: DataTypes.STRING,
        allowNull: true
      }
      // PARCHE 1.3.1 - WEBCHAT FIN
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("Contacts");
  }
};
