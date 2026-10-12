import Whatsapp from "../../models/Whatsapp";
import { IChannel } from "../../controllers/ChannelHubController";
import { getIO } from "../../libs/socket";

// Interface de entrada
interface Request {
  channels: IChannel[];  // Lista de canales a crear
  companyId: number;     // ID de la compañía a la que pertenecen los canales
}

// Interface de salida
interface Response {
  whatsapps: Whatsapp[]; // Lista de registros de WhatsApp creados
}

// Servicio para crear canales de WhatsApp
const CreateChannelsService = async ({
  channels,
  companyId, // Recibiendo el ID de la compañía como parámetro
}: Request): Promise<Response> => {

  // Mapeamos los canales para agregar el companyId y otras propiedades
  channels = channels.map(channel => {
    return {
      ...channel,
      type: channel.channel,  // Estableciendo el tipo del canal
      qrcode: channel.id,     // Usando el ID del canal como QR code
      status: "CONNECTED",    // Estado por defecto como "CONNECTED"
      companyId: companyId,   // Asociamos el companyId recibido
    };
  });

  // Creamos múltiples registros en la tabla Whatsapp usando bulkCreate
  const whatsapps = await Whatsapp.bulkCreate(channels);

  // Retornamos los registros creados
  return { whatsapps };
};

export default CreateChannelsService;
