import HubNotificaMe from "../../models/HubNotificaMe"; // Se ha reemplazado QuickMessage por HubNotificaMe
import AppError from "../../errors/AppError";

const ShowService = async (id: string | number): Promise<HubNotificaMe> => {
  // Buscamos el registro en la tabla HubNotificaMe por su ID
  const record = await HubNotificaMe.findByPk(id);

  // Verificamos si se encontró el registro
  if (!record) {
    throw new AppError("ERR_NO_RECORD_FOUND", 404); // Lanzamos un error con mensaje personalizado si no se encuentra
  }

  return record; // Si el registro es encontrado, lo retornamos
};

export default ShowService;
