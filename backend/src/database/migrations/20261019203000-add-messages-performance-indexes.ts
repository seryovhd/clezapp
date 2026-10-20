import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // 1. Índice compuesto ultrarrápido para consulta y ordenamiento de mensajes de chat
    try {
      await queryInterface.addIndex("Messages", ["companyId", "ticketId", "createdAt"], {
        name: "idx_messages_company_ticket_createdAt"
      });
    } catch (e) {
      console.log("Index idx_messages_company_ticket_createdAt already exists or skipped");
    }

    // 2. Índice para consultas de mensajes no leídos por empresa
    try {
      await queryInterface.addIndex("Messages", ["companyId", "read"], {
        name: "idx_messages_company_read"
      });
    } catch (e) {
      console.log("Index idx_messages_company_read already exists or skipped");
    }

    // 3. Índice para búsqueda de mensajes por ID remoto de WhatsApp (remoteJid)
    try {
      await queryInterface.addIndex("Messages", ["remoteJid"], {
        name: "idx_messages_remoteJid"
      });
    } catch (e) {
      console.log("Index idx_messages_remoteJid already exists or skipped");
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const indexesToRemove = [
      "idx_messages_company_ticket_createdAt",
      "idx_messages_company_read",
      "idx_messages_remoteJid"
    ];

    for (const name of indexesToRemove) {
      try {
        await queryInterface.removeIndex("Messages", name);
      } catch (e) {}
    }
  }
};
