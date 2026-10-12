import { subHours } from "date-fns";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";
import FindOrCreateATicketTrakingService from "./FindOrCreateATicketTrakingService";
import Setting from "../../models/Setting";
import Whatsapp from "../../models/Whatsapp";

interface TicketData {
  status?: string;
  companyId?: number;
  unreadMessages?: number;
}

const FindOrCreateTicketService = async (
  contact: Contact,
  whatsappId: number,
  unreadMessages: number,
  companyId: number,
  groupContact?: Contact,
  openTicketSchedule?: boolean
): Promise<Ticket> => {
  if (groupContact) {
    const groupMsgSetting = await Setting.findOne({
      where: {
        key: "CheckMsgIsGroup",
        companyId
      }
    });

    if (groupMsgSetting?.value === "enabled") {
      console.log("🚫 Ticket de grupo ignorado por configuración.");
      return null; // ✅ EVITA lanzar error
    }
  }
  // Buscar ticket existente del contacto
  let ticket = await Ticket.findOne({
    where: {
      status: {
        [Op.or]: ["open", "pending", "closed"]
      },
      contactId: groupContact ? groupContact.id : contact.id,
      companyId,
      whatsappId
    },
    order: [["id", "DESC"]]
  });

  // Reabrir si se permite por horario
  if (ticket && openTicketSchedule) {
    await ticket.update({ status: "open", unreadMessages });
  }
  //* PARCHE 1.3.1 - RECORDAR AGENTE *//
  // Obtener configuración de recordar agente
  const rememberAgentSetting = await Setting.findOne({
    where: { key: "rememberCustomerAgent", companyId }
  });
  if (ticket?.status === "closed") {
    if (rememberAgentSetting?.value !== "disabled" && ticket.userId) {
      await ticket.update({ status: "open", unreadMessages });
      console.log("🔄 Ticket reabierto con agente recordado:", ticket.userId);
    } else {
      await ticket.update({
        status: "pending",
        unreadMessages,
        userId: null,
        queueId: null
      });
      console.log("🔄 Ticket reabierto como pending (sin agente asignado)");
    }
  }

  // PARCHE 1.3.1 - RECORDAR AGENTE *//
  // Si es grupo y se encontró ticket, limpiarlo y reutilizar
  if (ticket && groupContact) {
    ticket = await Ticket.findOne({
      where: {
        contactId: groupContact.id
      },
      order: [["updatedAt", "DESC"]]
    });

    if (ticket) {
      // PARCHE 1.3.1 - RECORDAR AGENTE //
      if (rememberAgentSetting?.value !== "disabled") {
        await ticket.update({
          status: "open",
          unreadMessages,
          companyId
        });
      } else {
        // PARCHE 1.3.1 - RECORDAR AGENTE FIN //
        await ticket.update({
          status: "open",
          userId: null,
          unreadMessages,
          queueId: null,
          companyId
        });
      }

      await FindOrCreateATicketTrakingService({
        ticketId: ticket.id,
        companyId,
        whatsappId: ticket.whatsappId,
        userId: ticket.userId
      });
    }
  }

  // Buscar ticket reciente (últimas 2 horas)
  if (!ticket && !groupContact) {
    ticket = await Ticket.findOne({
      where: {
        updatedAt: {
          [Op.between]: [+subHours(new Date(), 2), +new Date()]
        },
        contactId: contact.id,
        whatsappId,
        companyId
      },
      order: [["updatedAt", "DESC"]]
    });

    if (ticket) {
      if (ticket.whatsappId !== whatsappId) {
        await ticket.update({
          userId: null,
          queueId: null,
          status: "pending",
          whatsappId,
          unreadMessages
        });
      } else {
        // PARCHE 1.3.1 - RECORDAR AGENTE //
        if (rememberAgentSetting?.value !== "disabled") {
          await ticket.update({
            status: "open",
            unreadMessages,
            companyId
          });
        } else {
          // PARCHE 1.3.1 - RECORDAR AGENTE FIN //
          await ticket.update({
            status: "pending",
            userId: null,
            unreadMessages,
            queueId: null,
            companyId
          });
        }
      }

      await FindOrCreateATicketTrakingService({
        ticketId: ticket.id,
        companyId,
        whatsappId: ticket.whatsappId,
        userId: ticket.userId
      });
    }
  }

  // Verificar que exista la sesión de WhatsApp
  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId }
  });
  // PARCHE 1.3.1 - RECORDAR AGENTE *//
  if (!whatsapp) {
    throw new Error("WhatsApp session not found.");
  }

  // Preparar el userId recordado (si se permite y no hay ticket aún)
  let rememberedUserId: number | null = null;

  if (!ticket && rememberAgentSetting?.value !== "disabled") {
    const lastTicket = await Ticket.findOne({
      where: {
        contactId: groupContact ? groupContact.id : contact.id,
        companyId,
        userId: { [Op.ne]: null }
      },
      order: [["updatedAt", "DESC"]],
      limit: 1
    });

    if (lastTicket?.userId) {
      rememberedUserId = lastTicket.userId;
      console.log("✅ Agente recordado para nuevo ticket:", rememberedUserId);
    }
  }
  // PARCHE 1.3.1 - RECORDAR AGENTE FIN //
  // Crear nuevo ticket si no existe uno reutilizable
  if (!ticket) {
    ticket = await Ticket.create({
      contactId: groupContact ? groupContact.id : contact.id,
      status: groupContact ? "open" : (rememberedUserId ? "open" : "pending"),
      isGroup: !!groupContact,
      unreadMessages,
      whatsappId,
      whatsapp,
      companyId,
      // PARCHE 1.3.1 - RECORDAR AGENTE *//
      userId: rememberedUserId || null
      // PARCHE 1.3.1 - RECORDAR AGENTE FIN //
    });

    await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId,
      whatsappId,
      // PARCHE 1.3.1 - RECORDAR AGENTE //
      userId: rememberedUserId || ticket.userId
      // PARCHE 1.3.1 - RECORDAR AGENTE FIN //
    });

    console.log("🎟️ Ticket nuevo creado:", ticket.id, "userId:", ticket.userId);
  }

  // Mostrar el ticket actualizado
  ticket = await ShowTicketService(ticket.id, companyId);

  return ticket;
};

export default FindOrCreateTicketService;
