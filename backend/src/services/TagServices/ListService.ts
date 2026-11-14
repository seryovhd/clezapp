import { Op, Sequelize, fn, col } from "sequelize";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import TicketTag from "../../models/TicketTag";

interface Request {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
}

interface Response {
  tags: Tag[];
  count: number;
  hasMore: boolean;
}

const ListService = async ({
  companyId,
  searchParam,
  pageNumber = "1"
}: Request): Promise<Response> => {
  let whereCondition: any = {};
  const limit = 5000;
  const offset = limit * (+pageNumber - 1);

  if (searchParam) {
    const sanitizedSearch = searchParam.toLowerCase().trim();
    whereCondition = {
      [Op.or]: [
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("Tag.name")),
          "LIKE",
          `%${sanitizedSearch}%`
        ),
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("Tag.color")),
          "LIKE",
          `%${sanitizedSearch}%`
        )
      ]
    };
  }

  const { count, rows: tags } = await Tag.findAndCountAll({
    where: { ...whereCondition, companyId },
    limit,
    offset,
    order: [["name", "ASC"]],
    subQuery: false,
    include: [{
      model: TicketTag,
      as: 'ticketTags',
      attributes: [],
      required: false
    }],
    attributes: [
      'id',
      'name',
      'color',
      [fn('count', col('ticketTags.tagId')), 'ticketsCount']
    ],
    group: ['Tag.id']
  });

  const actualCount = Array.isArray(count) ? count.length : Number(count || 0);
  const hasMore = actualCount > offset + tags.length;

  return {
    tags,
    count: actualCount,
    hasMore
  };
};

export default ListService;
