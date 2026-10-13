import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // 1. Índices compuestos para Tickets (la tabla más consultada y pesada)
    try {
      await queryInterface.addIndex("Tickets", ["companyId", "status", "updatedAt"], {
        name: "idx_tickets_company_status_updatedAt"
      });
    } catch (e) {
      console.log("Index idx_tickets_company_status_updatedAt already exists or skipped");
    }

    try {
      await queryInterface.addIndex("Tickets", ["companyId", "userId", "status"], {
        name: "idx_tickets_company_user_status"
      });
    } catch (e) {
      console.log("Index idx_tickets_company_user_status already exists or skipped");
    }

    try {
      await queryInterface.addIndex("Tickets", ["companyId", "queueId", "status"], {
        name: "idx_tickets_company_queue_status"
      });
    } catch (e) {
      console.log("Index idx_tickets_company_queue_status already exists or skipped");
    }

    try {
      await queryInterface.addIndex("Tickets", ["contactId"], {
        name: "idx_tickets_contactId"
      });
    } catch (e) {
      console.log("Index idx_tickets_contactId already exists or skipped");
    }

    try {
      await queryInterface.addIndex("Tickets", ["companyId", "unreadMessages"], {
        name: "idx_tickets_company_unreadMessages"
      });
    } catch (e) {
      console.log("Index idx_tickets_company_unreadMessages already exists or skipped");
    }

    // 2. Índices para Contacts (búsquedas por número y nombre)
    try {
      await queryInterface.addIndex("Contacts", ["companyId", "number"], {
        name: "idx_contacts_company_number"
      });
    } catch (e) {
      console.log("Index idx_contacts_company_number already exists or skipped");
    }

    try {
      await queryInterface.addIndex("Contacts", ["companyId", "name"], {
        name: "idx_contacts_company_name"
      });
    } catch (e) {
      console.log("Index idx_contacts_company_name already exists or skipped");
    }

    // 3. Índice para búsqueda de tags en tickets
    try {
      await queryInterface.addIndex("TicketTags", ["tagId", "ticketId"], {
        name: "idx_tickettags_tagId_ticketId"
      });
    } catch (e) {
      console.log("Index idx_tickettags_tagId_ticketId already exists or skipped");
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const indexesToRemove = [
      { table: "Tickets", name: "idx_tickets_company_status_updatedAt" },
      { table: "Tickets", name: "idx_tickets_company_user_status" },
      { table: "Tickets", name: "idx_tickets_company_queue_status" },
      { table: "Tickets", name: "idx_tickets_contactId" },
      { table: "Tickets", name: "idx_tickets_company_unreadMessages" },
      { table: "Contacts", name: "idx_contacts_company_number" },
      { table: "Contacts", name: "idx_contacts_company_name" },
      { table: "TicketTags", name: "idx_tickettags_tagId_ticketId" }
    ];

    for (const idx of indexesToRemove) {
      try {
        await queryInterface.removeIndex(idx.table, idx.name);
      } catch (e) {}
    }
  }
};
