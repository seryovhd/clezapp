import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";
import TicketTraking from "../../models/TicketTraking";
import Message from "../../models/Message";
import TicketTag from "../../models/TicketTag";
import EvolutionMonitor from "../EvolutionApiServices/EvolutionMonitor";

const DeleteTicketService = async (id: string): Promise<Ticket> => {
  const ticket = await Ticket.findOne({
    where: { id }
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }
  
  // Finalizar tracking si existe
  const tracking = await TicketTraking.findOne({
    where: { ticketId: ticket.id }
  });
  if (tracking) {
    tracking.finishedAt = new Date();
    await tracking.save();
  }

  // Marcar los IDs de los mensajes como eliminados para que EvolutionMonitor nunca los recree
  const msgs = await Message.findAll({
    where: { ticketId: ticket.id },
    attributes: ["id"]
  });
  if (msgs.length > 0) {
    EvolutionMonitor.markMessagesAsDeleted(msgs.map(m => m.id));
  }

  // Eliminar mensajes, tags y trackings asociados explícitamente de la base de datos
  await Message.destroy({
    where: { ticketId: ticket.id }
  });
  await TicketTag.destroy({
    where: { ticketId: ticket.id }
  });
  await TicketTraking.destroy({
    where: { ticketId: ticket.id }
  });

  // Eliminar el ticket de la base de datos
  await ticket.destroy();

  return ticket;
};

export default DeleteTicketService;
