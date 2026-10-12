import HubNotificaMe from "../../models/HubNotificaMe";
import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";

const DeleteService = async (id: string): Promise<void> => {
  // Busca el registro en HubNotificaMe por su ID
  const record = await HubNotificaMe.findOne({ where: { id } });

  // Si no existe el registro, lanza un error personalizado
  if (!record) {
    throw new AppError("ERR_NO_HUBNOTIFICAME_FOUND", 404);
  }

  // Elimina el registro en la tabla Whatsapp donde el qrcode coincide con el token del HubNotificaMe
  await Whatsapp.destroy({ where: { qrcode: record.token } });

  // Luego elimina el registro en la tabla HubNotificaMe
  await record.destroy();
};

export default DeleteService;
