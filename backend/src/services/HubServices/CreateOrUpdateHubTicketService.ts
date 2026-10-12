import { Op } from "sequelize";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { IContent } from "./HubMessageListener";
import { getIO } from "../../libs/socket";

interface TicketData {
  contactId: number;
  channel: string;
  contents: IContent[]; // Contenidos de la conversación
  connection: Whatsapp; // Conexión de WhatsApp
}

const CreateOrUpdateTicketService = async (
  ticketData: TicketData
): Promise<Ticket> => {

  const { contactId, channel, contents, connection } = ticketData;
  const io = getIO();

  // Verificación de que contents no está vacío
  if (!contents || contents.length === 0) {
    throw new Error("ERR_NO_CONTENTS_PROVIDED");  // Error si no hay contenido
  }

  // Buscar si ya existe un ticket para el contacto y canal específico
  const ticketExists = await Ticket.findOne({
    where: {
      contactId,
      channel,
      whatsappId: connection.id,
    }
  });

  if (ticketExists) {
    // Si el ticket existe, actualizamos su estado y mensaje
    let newStatus = ticketExists.status;
    let newQueueId = ticketExists.queueId;

    // Si el ticket está cerrado, cambiamos el estado a 'pending'
    if (ticketExists.status === "closed") {
      newStatus = "pending";
    }

    // Actualizamos el ticket con el nuevo mensaje y estado
    await ticketExists.update({
      lastMessage: contents[0].text,
      status: newStatus,
      queueId: newQueueId
    });

    // Recargamos el ticket con las asociaciones necesarias
    await ticketExists.reload({
      include: [
        { association: "contact" },
        { association: "user" },
        { association: "queue" },
        { association: "tags" },
        { association: "whatsapp" }
      ]
    });

    return ticketExists;
  }

  // Si el ticket no existe, lo creamos con estado 'pending'
  const newTicket = await Ticket.create({
    status: "pending",
    channel,
    lastMessage: contents[0].text,
    contactId,
    whatsappId: connection.id
  });

  // Recargamos el nuevo ticket con las asociaciones necesarias
  await newTicket.reload({
    include: [
      { association: "contact" },
      { association: "user" },
      { association: "whatsapp" }
    ]
  });

  return newTicket;
};

export default CreateOrUpdateTicketService;
