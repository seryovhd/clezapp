import { FindOptions } from "sequelize/types";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";

interface Request {
  ticketId: string;
  companyId: number;
  pageNumber?: string;
  beforeId?: string;
  beforeCreatedAt?: string;
  queues?: number[];
}

interface Response {
  messages: Message[];
  ticket: Ticket;
  count: number;
  hasMore: boolean;
}

const ListMessagesService = async ({
  pageNumber = "1",
  ticketId,
  companyId,
  beforeId,
  beforeCreatedAt,
  queues = []
}: Request): Promise<Response> => {
  const ticket = await Ticket.findOne({
    where: { id: ticketId, companyId },
    attributes: [
      "id",
      "uuid",
      "status",
      "unreadMessages",
      "lastMessage",
      "isGroup",
      "updatedAt",
      "whatsappId",
      "companyId",
      "contactId",
      "queueId",
      "userId"
    ],
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "profilePicUrl"]
      },
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name", "color"]
      }
    ]
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  // ✅ Tamaño de lote óptimo ampliado a 35 mensajes
  const limit = 35;
  let offset = 0;

  const whereConditions: any = {
    ticketId,
    companyId
  };

  // ✅ Paginación por Cursor (Timestamp / ID)
  if (beforeCreatedAt) {
    whereConditions.createdAt = { [Op.lt]: new Date(beforeCreatedAt) };
  } else if (beforeId) {
    const refMsg = await Message.findByPk(beforeId, { attributes: ["createdAt"] });
    if (refMsg?.createdAt) {
      whereConditions.createdAt = { [Op.lt]: refMsg.createdAt };
    }
  } else if (pageNumber && +pageNumber > 1) {
    offset = limit * (+pageNumber - 1);
  }

  if (queues.length > 0) {
    whereConditions.queueId = {
      [Op.or]: {
        [Op.in]: queues,
        [Op.eq]: null
      }
    };
  }

  const messages = await Message.findAll({
    where: whereConditions,
    limit: limit + 1,
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "profilePicUrl"]
      },
      {
        model: Message,
        as: "quotedMsg",
        attributes: ["id", "body", "fromMe", "mediaType", "mediaUrl", "createdAt", "companyId"],
        include: [
          {
            model: Contact,
            as: "contact",
            attributes: ["id", "name", "number"]
          }
        ]
      },
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name", "color"]
      }
    ],
    offset,
    order: [["createdAt", "DESC"]]
  });

  const hasMore = messages.length > limit;
  if (hasMore) {
    messages.pop();
  }

  return {
    messages: messages.reverse(),
    ticket,
    count: messages.length,
    hasMore
  };
};

export default ListMessagesService;
