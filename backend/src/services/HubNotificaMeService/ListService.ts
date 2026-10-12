import { Sequelize, Op, Filterable } from "sequelize";
import HubNotificaMe from "../../models/HubNotificaMe"; // Importando el modelo HubNotificaMe

interface Request {
  searchParam?: string;   // Parámetro opcional para la búsqueda
  pageNumber?: string;    // Página solicitada para la paginación
  companyId: number | string; // ID de la compañía para filtrar los resultados
}

interface Response {
  records: HubNotificaMe[];  // Lista de registros de HubNotificaMe
  count: number;              // Total de registros encontrados
  hasMore: boolean;           // Indica si hay más resultados disponibles
}

const ListService = async ({
  searchParam = "",
  pageNumber = "1",
  companyId
}: Request): Promise<Response> => {
  // Limpiamos y normalizamos el parámetro de búsqueda para evitar problemas con mayúsculas/minúsculas
  const sanitizedSearchParam = searchParam.toLocaleLowerCase().trim();

  // Condiciones de filtro basadas en el searchParam
  let whereCondition: Filterable["where"] = {
    [Op.or]: [
      {
        nome: Sequelize.where(Sequelize.fn("LOWER", Sequelize.col("nome")), "LIKE", `%${sanitizedSearchParam}%`)
      },
      {
        token: Sequelize.where(Sequelize.fn("LOWER", Sequelize.col("token")), "LIKE", `%${sanitizedSearchParam}%`)
      },
      {
        tipo: Sequelize.where(Sequelize.fn("LOWER", Sequelize.col("tipo")), "LIKE", `%${sanitizedSearchParam}%`)
      }
    ]
  };

  // Añadimos la condición de companyId al filtro
  whereCondition = {
    ...whereCondition,
    companyId
  };

  // Definimos la paginación
  const limit = 20; // Número de registros por página
  const offset = limit * (+pageNumber - 1); // Calculamos el offset según el número de página

  // Buscamos los registros con las condiciones definidas, limitando la cantidad de resultados y ordenando por tipo
  const { count, rows: records } = await HubNotificaMe.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["tipo", "ASC"]] // Ordenando por tipo de forma ascendente
  });

  // Determinamos si hay más resultados según el conteo total y el offset
  const hasMore = count > offset + records.length;

  // Devolvemos los resultados, el total de registros y si hay más resultados
  return {
    records,
    count,
    hasMore
  };
};

export default ListService;
