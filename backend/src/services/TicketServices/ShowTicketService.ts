import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
import Whatsapp from "../../models/Whatsapp";
import Prompt from "../../models/Prompt";

const ShowTicketService = async (
  id: string | number,
  companyId: number
): Promise<Ticket> => {
  if (!id || id === "undefined" || id === "null") {
    throw new AppError("Ticket no encontrado", 404);
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));

  if (!isUuid && isNaN(Number(id))) {
    throw new AppError("Ticket no encontrado", 404);
  }

  const whereTicket: any = isUuid
    ? { uuid: String(id), companyId }
    : { id: Number(id), companyId };

  const ticket = await Ticket.findOne({
    where: whereTicket,
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "email", "profilePicUrl", "messengerId", "lid", "disableBot"],
        include: ["extraInfo"]
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name"]
      },
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name", "color"],
        include: ["prompt", "queueIntegrations"]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: [
          "id",
          "name",
          "type",
          "status",
          "number",
          "companyId",
          "connectionType",
          "instanceName",
          // Campos WhatsApp Business
          "phoneNumberId",
          "businessAccountId",
          "businessAccessToken",
          "businessName",
          "businessVerificationStatus",
          // Campos Facebook
          "facebookPageId",
          "facebookAccessToken",
          "facebookPageName",
          // Campos generales
          "token",
          "qrcode"
        ]
      },
      {
        model: Tag,
        as: "tags",
        attributes: ["id", "name", "color"]
      }
    ]
  });

  if (!ticket) {
    throw new AppError("Ticket no encontrado", 404);
  }

  if (ticket.companyId !== companyId) {
    throw new AppError("No es posible consultar registros de otra empresa");
  }

  return ticket;
};

export default ShowTicketService;