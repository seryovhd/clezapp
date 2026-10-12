import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.removeConstraint("Tickets", "contactid_companyid_unique");

    await queryInterface.addConstraint("Tickets", ["contactId", "companyId", "whatsappId"], {
      type: "unique",
      name: "contactid_companyid_unique"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeConstraint("Tickets", "contactid_companyid_unique");

    await queryInterface.addConstraint("Tickets", ["contactId", "companyId"], {
      type: "unique",
      name: "contactid_companyid_unique"
    });
  }
};
