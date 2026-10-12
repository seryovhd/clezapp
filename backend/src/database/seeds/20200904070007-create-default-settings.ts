import { QueryInterface } from "sequelize";
import { hash } from "bcryptjs";

module.exports = {
    up: (queryInterface: QueryInterface) => {
        return queryInterface.sequelize.transaction(async t => {
            return Promise.all([
                queryInterface.bulkInsert(
                    "Settings",
                    [
                        {
                            key: "chatBotType",
                            value: "text",
                            companyId: 1,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
						{
						  key: "sendGreetingAccepted",
						  value: "disabled",
						  companyId: 1,
						  createdAt: new Date(),
						  updatedAt: new Date(),
						  
						},
						{
						  key: "sendMsgTransfTicket",
						  value: "disabled",
						  companyId: 1,
						  createdAt: new Date(),
						  updatedAt: new Date(),
						  
						},	
						{
						  key: "sendGreetingMessageOneQueues",
						  value: "disabled",
						  companyId: 1,
						  createdAt: new Date(),
						  updatedAt: new Date(),
						  
						},						
                        {
                            key: "userRating",
                            value: "disabled",
                            companyId: 1,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
                        {
                            key: "scheduleType",
                            value: "queue",
                            companyId: 1,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
                        {
                            key: "CheckMsgIsGroup",
                            value: "enabled",
                            companyId: 1,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
                        {
                            key:"call",
                            value: "disabled",
                            companyId: 1,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
                        {
                            key: "ipixc",
                            value: "",
                            companyId: 1,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
                        {
                            key: "tokenixc",
                            value: "",
                            companyId: 1,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
                        {
                            key: "ipmkauth",
                            value: "",
                            companyId: 1,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
                        {
                            key: "clientidmkauth",
                            value: "",
                            companyId: 1,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
                        {
                            key: "clientsecretmkauth",
                            value: "",
                            companyId: 1,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
                        {
                            key: "asaas",
                            value: "",
                            companyId: 1,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
                        // PARCHE 1.3 - HUB
                        {
                            key: "hubToken",
                            value: "",
                            companyId: 1,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
                        // PARCHE 1.3 - HUB FIN
                        // PARCHE 1.3.1 - RECORDAR AGENTE
                        {
                            key: "rememberCustomerAgent",
                            value: "disabled",
                            companyId: 1,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }
                        // PARCHE 1.3.1 - RECORDAR AGENTE FIN
                    ],
                    { transaction: t }
                )
            ]);
        });
    },

    down: async (queryInterface: QueryInterface) => {
        return queryInterface.bulkDelete("Settings", {});
    }
};
