import AppError from "../../errors/AppError";
import HubNotificaMe from "../../models/HubNotificaMe";

interface Data {
  nome: string; // Nombre a actualizar
  token: string; // Token a actualizar
  id?: number | string; // ID del registro a actualizar (opcional si se pasa como parámetro)
}

const UpdateService = async (data: Data): Promise<HubNotificaMe> => {
  const { id, nome, token } = data;

  // Buscamos el registro en HubNotificaMe por el ID
  const record = await HubNotificaMe.findByPk(id);

  // Si no se encuentra el registro, lanzamos un error
  if (!record) {
    throw new AppError("ERR_NO_TICKETNOTE_FOUND", 404); // Error personalizado con código 404
  }

  // Actualizamos los valores del registro
  await record.update({
    nome,
    token
  });

  // Retornamos el registro actualizado
  return record;
};

export default UpdateService;
