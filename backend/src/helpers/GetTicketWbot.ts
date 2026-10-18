import { WASocket } from "@whiskeysockets/baileys";
import GetWbot from "./GetWbot";
import GetDefaultWhatsApp from "./GetDefaultWhatsApp";
import Ticket from "../models/Ticket";
import { Store } from "../libs/store";
import AppError from "../errors/AppError";

type Session = WASocket & {
  id?: number;
  store?: Store;
};

const GetTicketWbot = async (ticket: Ticket): Promise<Session> => {
  if (!ticket.whatsapp) {
    await ticket.$get("whatsapp");
  }

  // VERIFICAR SI ES BUSINESS API
  if (ticket.whatsapp?.type === "whatsapp_business") {
    throw new AppError("ERR_BUSINESS_API_NO_WBOT", 400);
  }

  if (ticket.whatsapp?.type === "facebook_messenger") {
    throw new AppError("ERR_FACEBOOK_NO_WBOT", 400);
  }

  if (!ticket.whatsappId) {
    const defaultWhatsapp = await GetDefaultWhatsApp(
      ticket.companyId,
      ticket.userId
    );

    await ticket.$set("whatsapp", defaultWhatsapp);
  }

  if (ticket.whatsapp?.type === "evolution" || ticket.whatsapp?.connectionType === "evolution") {
    const EvolutionApiService = (await import("../services/EvolutionApiServices/EvolutionApiService")).default;
    return EvolutionApiService.buildEvolutionSession(ticket.whatsapp) as any;
  }

  const wbot = await GetWbot(ticket.whatsappId);
  return wbot;
};

export default GetTicketWbot;