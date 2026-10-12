import HubNotificaMe from "../../models/HubNotificaMe";

const FindAllService = async (): Promise<HubNotificaMe[]> => {
  const records: HubNotificaMe[] = await HubNotificaMe.findAll({
    order: [["tipo", "ASC"]] // Ordenando por el campo 'tipo' en orden ascendente
  });
  
  return records;
};

export default FindAllService;
