import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import TicketTag from "../../models/TicketTag";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { getIO } from "../../libs/socket";

interface Request {
  tags: Tag[];
  ticketId: number;
  companyId?: number;
}

const SyncTags = async ({
  tags,
  ticketId,
  companyId
}: Request): Promise<Ticket | null> => {
  const sortedTags = Array.isArray(tags)
    ? [...tags].sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()))
    : [];
  const tagList = sortedTags.map(t => ({ tagId: t.id, ticketId }));

  await TicketTag.destroy({ where: { ticketId } });
  await TicketTag.bulkCreate(tagList);

  let ticket: Ticket | null = null;
  const currentCompanyId = companyId || (await Ticket.findByPk(ticketId))?.companyId;

  if (currentCompanyId) {
    try {
      ticket = await ShowTicketService(ticketId, currentCompanyId);
      if (ticket && Array.isArray(ticket.tags)) {
        ticket.tags.sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()));
      }
      const io = getIO();
      io.to(`company-${currentCompanyId}-mainchannel`)
        .to(`company-${currentCompanyId}-${ticket.status}`)
        .to(`company-${currentCompanyId}-notification`)
        .to(`queue-${ticket.queueId}-${ticket.status}`)
        .to(`queue-${ticket.queueId}-notification`)
        .to(ticketId.toString())
        .emit(`company-${currentCompanyId}-ticket`, {
          action: "update",
          ticket
        });
    } catch (e) {
      ticket = await Ticket.findByPk(ticketId, { include: [Tag] });
      if (ticket && Array.isArray(ticket.tags)) {
        ticket.tags.sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()));
      }
    }
  } else {
    ticket = await Ticket.findByPk(ticketId, { include: [Tag] });
    if (ticket && Array.isArray(ticket.tags)) {
      ticket.tags.sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()));
    }
  }

  return ticket;
};

export default SyncTags;
