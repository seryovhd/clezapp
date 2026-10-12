import AppError from "../../errors/AppError";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import ShowContactService from "../ContactServices/ShowContactService";
import { getIO } from "../../libs/socket";

interface Request {
  contactId: number;
  status: string;
  userId: number;
  companyId: number;
  queueId?: number;
  channel: string;
}

const CreateTicketService = async ({
  contactId,
  status,
  userId,
  companyId,
  queueId,
  channel
}: Request): Promise<Ticket> => {

  // Determinando el tipo de conexión en función del canal
  let type: string | undefined;
  
  if (channel === 'instagram') {
    type = 'instagram';
  } else if (channel === 'facebook') {
    type = 'facebook';
  } else {
    throw new AppError("ERR_INVALID_CHANNEL", 400);  // Agregando un error para canal no válido
  }

  // Buscando la conexión correspondiente (Whatsapp) según el tipo de canal
  const connection = await Whatsapp.findOne({
    where: { type: type }
  });

  if (!connection) {
    throw new AppError("ERR_CONNECTION_NOT_FOUND", 404);  // Mensaje de error más claro
  }

  // Verificación del companyId recibido
  console.log("🏢 companyId RECIBIDO:", companyId);

  // Verificando si el contacto tiene tickets abiertos
  await CheckContactOpenTickets(contactId, String(connection.id));

  // Obteniendo la información del contacto con base en el companyId
  const { isGroup } = await ShowContactService(contactId, companyId);

  // Si no se recibe un queueId, intentamos obtenerlo desde el usuario
  if (queueId === undefined) {
    const user = await User.findByPk(userId, { include: ["queues"] });
    queueId = user?.queues.length === 1 ? user.queues[0].id : undefined;
  }

  // Creando el nuevo ticket con la información necesaria
  const newTicket = await Ticket.create({
    status,
    lastMessage: null,  // Última mensaje siempre vacío al crear el ticket
    contactId,
    isGroup,
    whatsappId: connection.id,
    companyId  // Asegurando que el ticket pertenezca a la empresa del usuario
  });

  const ticket = await Ticket.findByPk(newTicket.id, { include: ["contact"] });

  if (!ticket) {
    throw new AppError("ERR_CREATING_TICKET", 500);  // Error al crear el ticket
  }

  const io = getIO();

  // Enviar notificación a los canales relacionados (WebSocket)
  io.to(`company-${companyId}-ticket`)
    .to(`company-${companyId}-notification`)
    .emit("ticket-created", { ticket });

  return ticket;
};

export default CreateTicketService;
