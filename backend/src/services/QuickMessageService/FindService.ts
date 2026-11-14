import { Op, Sequelize } from "sequelize";
import QuickMessage from "../../models/QuickMessage";
import Company from "../../models/Company";

type Params = {
  companyId: string;
  userId: string;
  searchParam?: string;
};

const FindService = async ({ companyId, userId, searchParam }: Params): Promise<QuickMessage[]> => {
  const sanitizedSearch = searchParam ? searchParam.replace(/^\//, '').toLowerCase().trim() : "";
  const escapedSearch = sanitizedSearch.replace(/'/g, "''");

  let whereCondition: any = {
    [Op.or]: [
      { companyId, userId },
      { companyId, geral: true }
    ]
  };

  let orderCondition: any = [["shortcode", "ASC"]];

  if (sanitizedSearch) {
    whereCondition = {
      [Op.and]: [
        whereCondition,
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("shortcode")),
          "LIKE",
          `%${sanitizedSearch}%`
        )
      ]
    };

    orderCondition = [
      [
        Sequelize.literal(`CASE 
          WHEN LOWER("QuickMessage"."shortcode") = '${escapedSearch}' THEN 1
          WHEN LOWER("QuickMessage"."shortcode") LIKE '${escapedSearch}%' THEN 2
          ELSE 3
        END`),
        "ASC"
      ],
      ["shortcode", "ASC"]
    ];
  }

  const notes: QuickMessage[] = await QuickMessage.findAll({
    where: whereCondition,
    include: [{ model: Company, as: "company", attributes: ["id", "name"] }],
    order: orderCondition
  });

  return notes;
};

export default FindService;
