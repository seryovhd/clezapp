/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable camelcase */
import { QueryTypes } from "sequelize";
import * as _ from "lodash";
import sequelize from "../../database";

export interface DashboardData {
  tickets: any[];
  totalTickets: {
    total: number;
    open: number;
    pending: number;
    closed: number;
  };
}

export interface Params {
  searchParam: string;
  contactId: string;
  whatsappId: string[];
  dateFrom: string;
  dateTo: string;
  status: string[];
  queueIds: number[];
  tags: number[];
  users: number[];
  userId: string;
}

export default async function ListTicketsServiceReport(
  companyId: string | number,
  params: Params,
  page: number = 1,
  pageSize: number = 20
): Promise<DashboardData> {
  const offset = (page - 1) * pageSize;

  const query = `
    SELECT 
      t.id,
      w."name" as "whatsappName",
      c."name" as "contactName",
      u."name" as "userName",
      q."name" as "queueName",
      t."lastMessage",
      t.uuid,
      CASE t.status
        WHEN 'open' THEN 'ABERTO'
        WHEN 'closed' THEN 'FECHADO'
        WHEN 'pending' THEN 'PENDENTE'
        WHEN 'group' THEN 'GRUPO'
      END as "status",
      TO_CHAR(t."createdAt", 'DD/MM/YYYY HH24:MI') as "createdAt",
      TO_CHAR(tt."finishedAt", 'DD/MM/YYYY HH24:MI') as "closedAt"
    FROM "Tickets" t
    LEFT JOIN (
      SELECT DISTINCT ON ("ticketId") *
      FROM "TicketTraking"
      WHERE "companyId" = ${companyId}
      ORDER BY "ticketId", "id" DESC
    ) tt ON t.id = tt."ticketId"
    INNER JOIN "Contacts" c ON t."contactId" = c.id 
    LEFT JOIN "Whatsapps" w ON t."whatsappId" = w.id 
    LEFT JOIN "Users" u ON t."userId" = u.id 
    LEFT JOIN "Queues" q ON t."queueId" = q.id 
  `;

  let where = `WHERE t."companyId" = ${companyId}`;

  if (_.has(params, "dateFrom")) {
    where += ` AND t."createdAt" >= '${params.dateFrom} 00:00:00'`;
  }

  if (_.has(params, "dateTo")) {
    where += ` AND t."createdAt" <= '${params.dateTo} 23:59:59'`;
  }

  if (params.whatsappId && params.whatsappId.length > 0) {
    where += ` AND t."whatsappId" IN (${params.whatsappId})`;
  }

  if (params.users.length > 0) {
    where += ` AND t."userId" IN (${params.users})`;
  }

  if (params.queueIds.length > 0) {
    where += ` AND COALESCE(t."queueId", 0) IN (${params.queueIds})`;
  }

  if (params.status.length > 0) {
    where += ` AND t."status" IN ('${params.status.join("','")}')`;
  }

  if (params.contactId && params.contactId !== "") {
    where += ` AND t."contactId" IN (${params.contactId})`;
  }

  // Query para contar por estado
  const totalTicketsQuery = `
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE t.status = 'open') as open,
      COUNT(*) FILTER (WHERE t.status = 'pending') as pending,
      COUNT(*) FILTER (WHERE t.status = 'closed') as closed
    FROM "Tickets" t
    ${where}
  `;

  const totalTicketsResult = await sequelize.query(totalTicketsQuery, {
    type: QueryTypes.SELECT
  });

  const totalTickets = totalTicketsResult[0] as {
    total: number;
    open: number;
    pending: number;
    closed: number;
  };

  const finalQuery = `${query} ${where} ORDER BY t."createdAt" DESC LIMIT ${pageSize} OFFSET ${offset}`;

  const responseData: any[] = await sequelize.query(finalQuery, {
    type: QueryTypes.SELECT
  });

  return { tickets: responseData, totalTickets };
}
