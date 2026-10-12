import { Op } from "sequelize";
import HubNotificaMe from "../../models/HubNotificaMe";
import Company from "../../models/Company";

type Params = {
  companyId: string; // Parámetro esperado en la función, que es el ID de la empresa
};

const FindService = async ({ companyId }: Params): Promise<HubNotificaMe[]> => {
  // Buscando los registros de HubNotificaMe que coincidan con el companyId proporcionado
  const records: HubNotificaMe[] = await HubNotificaMe.findAll({
    where: {
      companyId // Filtro por el companyId
    },
    include: [{ 
      model: Company,       // Incluyendo información de la compañía relacionada
      as: "company",        // Alias para la relación
      attributes: ["id", "name"] // Solo incluyendo los campos id y name de la compañía
    }],
    order: [["id", "ASC"]] // Ordenando los resultados por ID en orden ascendente
  });

  return records;
};

export default FindService;
