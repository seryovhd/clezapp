import { Sequelize, Op, Filterable } from "sequelize";
import QuickMessage from "../../models/QuickMessage";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  companyId: number | string;
  userId?: number | string;
}

interface Response {
  records: QuickMessage[];
  count: number;
  hasMore: boolean;
}

const ListService = async ({
  searchParam = "",
  pageNumber = "1",
  companyId,
  userId
}: Request): Promise<Response> => {
  const sanitizedSearchParam = searchParam ? searchParam.replace(/^\//, '').toLowerCase().trim() : "";
  const escapedSearch = sanitizedSearchParam.replace(/'/g, "''");

  let whereCondition: Filterable["where"] = {};

  if (sanitizedSearchParam) {
    whereCondition = {
      shortcode: Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("shortcode")),
        "LIKE",
        `%${sanitizedSearchParam}%`
      )
    };
  }

  whereCondition = {
    ...whereCondition,
    companyId,
    [Op.or]: [
      { userId },
      { geral: true }
    ]
  };
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const orderCondition: any = sanitizedSearchParam
    ? [
      [
        Sequelize.literal(`CASE 
            WHEN LOWER("QuickMessage"."shortcode") = '${escapedSearch}' THEN 1
            WHEN LOWER("QuickMessage"."shortcode") LIKE '${escapedSearch}%' THEN 2
            ELSE 3
          END`),
        "ASC"
      ],
      ["shortcode", "ASC"]
    ]
    : [["shortcode", "ASC"]];

  const { count, rows: records } = await QuickMessage.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: orderCondition
  });

  const hasMore = count > offset + records.length;

  return {
    records,
    count,
    hasMore
  };
};

export default ListService;