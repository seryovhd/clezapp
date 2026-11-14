import { Op, Sequelize } from "sequelize";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import TicketTag from "../../models/TicketTag";

interface Request {
  companyId: number;
  searchParam?: string;
}

const ListService = async ({
  companyId,
  searchParam
}: Request): Promise<Tag[]> => {
  let whereCondition: any = {};

  if (searchParam) {
    const sanitizedSearch = searchParam.toLowerCase().trim();
    whereCondition = {
      [Op.or]: [
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("name")),
          "LIKE",
          `%${sanitizedSearch}%`
        ),
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("color")),
          "LIKE",
          `%${sanitizedSearch}%`
        )
      ]
    };
  }

  const tags = await Tag.findAll({
    where: { ...whereCondition, companyId },
    order: [["name", "ASC"]]
  });

  return tags;
};

export default ListService;
