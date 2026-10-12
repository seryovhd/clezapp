import { Op, fn, where, col, Filterable, Includeable } from "sequelize";
import { startOfDay, endOfDay, parseISO } from "date-fns";

import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import User from "../../models/User";
import ShowUserService from "../UserServices/ShowUserService";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import { intersection } from "lodash";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  date?: string;
  updatedAt?: string;
  showAll?: string;
  userId: string;
  withUnreadMessages?: string;
  queueIds: number[];
  tags: number[];
  users: number[];
  companyId: number;
}

interface Response {
  tickets: Ticket[];
  count: number;
  hasMore: boolean;
}

const ListTicketsService = async ({
  searchParam = "",
  pageNumber = "1",
  queueIds,
  tags,
  users,
  status,
  date,
  updatedAt,
  showAll,
  userId,
  withUnreadMessages,
  companyId
}: Request): Promise<Response> => {
  // ✅ OBTENER INFORMACIÓN DEL USUARIO PARA VERIFICAR allTicket
  const user = await ShowUserService(userId);
  const userHasAllTickets = user.allTicket === "enabled";
  const isAdmin = user.profile === "admin";

  // ✅ DEBUG DETALLADO
  //console.log("=== DEBUG BACKEND DETALLADO ===");
  //console.log("Request userId:", userId);
  //console.log("User allTicket:", user.allTicket);
  //console.log("User profile:", user.profile);
  //console.log("ShowAll:", showAll);
  //console.log("QueueIds recibidos:", queueIds);
  //console.log("QueueIds tipo:", typeof queueIds);
  //console.log("QueueIds longitud:", queueIds?.length);
  //console.log("Status:", status);
  //console.log("isAdmin:", isAdmin);
  //console.log("userHasAllTickets:", userHasAllTickets);

  let whereCondition: Filterable["where"] = {};

  if (!isAdmin && !userHasAllTickets && showAll !== "true") {
    //console.log("✅ BACKEND: Aplicando filtro para usuario sin allTicket");

    if (queueIds && queueIds.length > 0) {
      //console.log("✅ Aplicando filtro con queueIds:", queueIds);
      // ✅ USUARIO PUEDE VER:
      // 1. Tickets asignados a él (userId = 7)
      // 2. Tickets sin asignar (userId = null) en sus colas permitidas
      whereCondition = {
        [Op.or]: [
          { userId: userId },           // Tickets asignados a él
          { userId: null }              // Tickets sin asignar
        ],
        queueId: queueIds               // Solo en sus colas permitidas
      };
    } else {
      //console.log("❌ QueueIds vacío, aplicando filtro solo por usuario");
      whereCondition = {
        userId: userId  // Solo tickets asignados a él
      };
    }
  } else {
    //console.log("✅ BACKEND: Aplicando filtro para admin/usuario con allTicket");
    if (queueIds && queueIds.length > 0) {
      whereCondition = {
        [Op.or]: [
          { userId: userId },
          { status: "pending" }
        ],
        queueId: {
          [Op.or]: [
            { [Op.in]: queueIds },
            { [Op.is]: null }
          ]
        }
      };
    } else {
      whereCondition = {
        [Op.or]: [
          { userId: userId },
          { status: "pending" }
        ],
        queueId: {
          [Op.or]: [
            { [Op.in]: [] },
            { [Op.is]: null }
          ]
        }
      };
    }
  }

  //console.log("WhereCondition final:", whereCondition);

  // ✅ DEBUG EXTRA: Verificar qué tickets existen en la BD
  try {
    const testCondition = { ...whereCondition, companyId };
    //console.log("Condición de test para BD:", testCondition);

    const testTickets = await Ticket.findAll({
      where: testCondition,
      attributes: ['id', 'userId', 'queueId', 'status', 'companyId'],
      limit: 10
    });
    //console.log("Tickets encontrados en BD:", testTickets.length);
    testTickets.forEach(t => {
      //console.log(`- Ticket ${t.id}: User=${t.userId}, Queue=${t.queueId}, Status=${t.status}, Company=${t.companyId}`);
    });
  } catch (error) {
    //console.log("Error en consulta de test:", error.message);
  }

  //console.log("=== FIN DEBUG BACKEND DETALLADO ===");

  let includeCondition: Includeable[];

  includeCondition = [
    {
      model: Contact,
      as: "contact",
      attributes: ["id", "name", "number", "email", "profilePicUrl", "messengerId", "instagramId","canal"]
    },
    {
      model: Queue,
      as: "queue",
      attributes: ["id", "name", "color"]
    },
    {
      model: User,
      as: "user",
      attributes: ["id", "name"]
    },
    {
      model: Tag,
      as: "tags",
      attributes: ["id", "name", "color"]
    },
    {
      model: Whatsapp,
      as: "whatsapp",
      attributes: ["id", "name", "type", "status"]
    },
  ];

  if (showAll === "true") {
    if (queueIds && queueIds.length > 0) {
      whereCondition = {
        queueId: {
          [Op.or]: [
            { [Op.in]: queueIds },
            { [Op.is]: null }
          ]
        }
      };
    } else {
      whereCondition = {
        queueId: {
          [Op.or]: [
            { [Op.in]: [] },
            { [Op.is]: null }
          ]
        }
      };
    }
  }

  if (status) {
    whereCondition = {
      ...whereCondition,
      status
    };
  }

  if (searchParam) {
    const sanitizedSearchParam = searchParam.toLocaleLowerCase().trim();

    includeCondition = [
      ...includeCondition,
      {
        model: Message,
        as: "messages",
        attributes: ["id", "body"],
        where: {
          body: where(
            fn("LOWER", col("body")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        required: false,
        duplicating: false
      }
    ];

    whereCondition = {
      ...whereCondition,
      [Op.or]: [
        {
          "$contact.name$": where(
            fn("LOWER", col("contact.name")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        { "$contact.number$": { [Op.like]: `%${sanitizedSearchParam}%` } },
        {
          "$message.body$": where(
            fn("LOWER", col("body")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        }
      ]
    };
  }

  if (date) {
    whereCondition = {
      createdAt: {
        [Op.between]: [+startOfDay(parseISO(date)), +endOfDay(parseISO(date))]
      }
    };
  }

  if (updatedAt) {
    whereCondition = {
      updatedAt: {
        [Op.between]: [
          +startOfDay(parseISO(updatedAt)),
          +endOfDay(parseISO(updatedAt))
        ]
      }
    };
  }

  if (withUnreadMessages === "true") {
    const userQueueIds = user.queues.map(queue => queue.id);

    // ✅ APLICAR LA MISMA LÓGICA PARA withUnreadMessages
    if (!isAdmin && !userHasAllTickets && showAll !== "true") {
      whereCondition = {
        userId: userId,
        queueId: { [Op.in]: userQueueIds },
        unreadMessages: { [Op.gt]: 0 }
      };
    } else {
      whereCondition = {
        [Op.or]: [{ userId }, { status: "pending" }],
        queueId: { [Op.or]: [userQueueIds, null] },
        unreadMessages: { [Op.gt]: 0 }
      };
    }
  }

  if (Array.isArray(tags) && tags.length > 0) {
    const ticketsTagFilter: any[] | null = [];
    for (let tag of tags) {
      const ticketTags = await TicketTag.findAll({
        where: { tagId: tag }
      });
      if (ticketTags) {
        ticketsTagFilter.push(ticketTags.map(t => t.ticketId));
      }
    }

    const ticketsIntersection: number[] = intersection(...ticketsTagFilter);

    whereCondition = {
      ...whereCondition,
      id: {
        [Op.in]: ticketsIntersection
      }
    };
  }

  if (Array.isArray(users) && users.length > 0) {
    const ticketsUserFilter: any[] | null = [];
    for (let user of users) {
      const ticketUsers = await Ticket.findAll({
        where: { userId: user }
      });
      if (ticketUsers) {
        ticketsUserFilter.push(ticketUsers.map(t => t.id));
      }
    }

    const ticketsIntersection: number[] = intersection(...ticketsUserFilter);

    whereCondition = {
      ...whereCondition,
      id: {
        [Op.in]: ticketsIntersection
      }
    };
  }

  const limit = 40;
  const offset = limit * (+pageNumber - 1);

  whereCondition = {
    ...whereCondition,
    companyId
  };

  // ✅ DEBUG FINAL ANTES DE LA CONSULTA
  //console.log("=== CONSULTA FINAL A BD ===");
  //console.log("WhereCondition final con companyId:", whereCondition);

  const { count, rows: tickets } = await Ticket.findAndCountAll({
    where: whereCondition,
    include: includeCondition,
    distinct: true,
    limit,
    offset,
    order: [["updatedAt", "DESC"]],
    subQuery: false
  });

  //console.log("Tickets devueltos por findAndCountAll:", tickets.length);
  //console.log("=== FIN CONSULTA ===");

  const hasMore = count > offset + tickets.length;

  return {
    tickets,
    count,
    hasMore
  };
};

export default ListTicketsService;