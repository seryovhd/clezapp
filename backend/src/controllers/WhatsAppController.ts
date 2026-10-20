import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { removeWbot, restartWbot } from "../libs/wbot";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import EvolutionApiService from "../services/EvolutionApiServices/EvolutionApiService";

import CreateWhatsAppService from "../services/WhatsappService/CreateWhatsAppService";
import DeleteWhatsAppService from "../services/WhatsappService/DeleteWhatsAppService";
import ListWhatsAppsService from "../services/WhatsappService/ListWhatsAppsService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import User from "../models/User";

interface WhatsappData {
  name: string;
  queueIds: number[];
  companyId: number;
  greetingMessage?: string;
  complationMessage?: string;
  outOfHoursMessage?: string;
  ratingMessage?: string;
  status?: string;
  isDefault?: boolean;
  token?: string;
  transferQueueId?: number;
  timeToTransfer?: number;
  promptId?: number;
  maxUseBotQueues?: number;
  timeUseBotQueues?: number;
  expiresTicket?: number;
  expiresInactiveMessage?: string;
  // ✅ AGREGAR ESTOS CAMPOS NUEVOS:
  type?: string;
  facebookPageId?: string;
  facebookPageName?: string;
  facebookAccessToken?: string;
  businessAccountId?: string;
  phoneNumberId?: string;
  wabaId?: string;
  businessAccessToken?: string;
  businessName?: string;
  businessVerificationStatus?: string;
}

interface QueryParams {
  session?: number | string;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { session } = req.query as QueryParams;
  const whatsapps = await ListWhatsAppsService({ companyId, session });

  return res.status(200).json(whatsapps);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    name,
    status,
    isDefault,
    greetingMessage,
    complationMessage,
    ratingMessage,
    outOfHoursMessage,
    queueIds,
    token,
    transferQueueId,
    timeToTransfer,
    promptId,
    maxUseBotQueues,
    timeUseBotQueues,
    expiresTicket,
    expiresInactiveMessage,
    // ✅ AGREGAR type Y CAMPOS DE FACEBOOK
    type,
    facebookPageId,
    facebookPageName,
    facebookAccessToken,
    businessAccountId,
    phoneNumberId,
    wabaId,
    businessAccessToken,
    businessName,
    businessVerificationStatus
  }: WhatsappData = req.body;

  const { companyId } = req.user;

  // DEBUG: Ver qué datos llegan al backend
  console.log("📥 BACKEND - Datos recibidos en store:", {
    name,
    type,
    token: token ? "***" : "empty",
    facebookPageId,
    facebookPageName
  });

  const { whatsapp, oldDefaultWhatsapp } = await CreateWhatsAppService({
    name,
    status,
    isDefault,
    greetingMessage,
    complationMessage,
    ratingMessage,
    outOfHoursMessage,
    queueIds,
    companyId,
    token,
    transferQueueId,
    timeToTransfer,
    promptId,
    maxUseBotQueues,
    timeUseBotQueues,
    expiresTicket,
    expiresInactiveMessage,
    // ✅ PASAR LOS NUEVOS CAMPOS AL SERVICE
    type,
    facebookPageId,
    facebookPageName,
    facebookAccessToken,
    businessAccountId,
    phoneNumberId,
    wabaId,
    businessAccessToken,
    businessName,
    businessVerificationStatus
  });

  // DEBUG: Ver qué se guardó
  console.log("📤 BACKEND - WhatsApp creado:", {
    id: whatsapp.id,
    name: whatsapp.name,
    type: whatsapp.type,
    token: whatsapp.token ? "***" : "empty"
  });

  // Iniciar sesión si es Baileys o Evolution API
  if (!type || type === "baileys" || type === "evolution") {
    StartWhatsAppSession(whatsapp, companyId);
  }

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-whatsapp`, {
    action: "update",
    whatsapp
  });

  if (oldDefaultWhatsapp) {
    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-whatsapp`, {
      action: "update",
      whatsapp: oldDefaultWhatsapp
    });
  }

  return res.status(200).json(whatsapp);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  const { session } = req.query;

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId, session);

  return res.status(200).json(whatsapp);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsappData = req.body;
  const { companyId } = req.user;

  // DEBUG: Ver qué datos llegan para actualizar
  console.log("📥 BACKEND - Datos recibidos en update:", {
    id: whatsappId,
    type: whatsappData.type,
    name: whatsappData.name
  });

  const { whatsapp, oldDefaultWhatsapp } = await UpdateWhatsAppService({
    whatsappData,
    whatsappId,
    companyId
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-whatsapp`, {
    action: "update",
    whatsapp
  });

  if (oldDefaultWhatsapp) {
    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-whatsapp`, {
      action: "update",
      whatsapp: oldDefaultWhatsapp
    });
  }

  return res.status(200).json(whatsapp);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  let whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  // Validar empresa permitiendo superadmin y registros con companyId null
  if (
    whatsapp.companyId !== null &&
    whatsapp.companyId !== undefined &&
    companyId !== null &&
    companyId !== undefined &&
    Number(whatsapp.companyId) !== Number(companyId)
  ) {
    const user = await User.findByPk(req.user.id);
    if (!user?.super) {
      throw new AppError("Não é possível acessar registros de outra empresa", 403);
    }
  }

  if (whatsapp.type === "evolution" || whatsapp.connectionType === "evolution") {
    try {
      await EvolutionApiService.deleteInstance(whatsapp);
    } catch (err) {}
  }

  // 1. Cerrar y purgar socket de Baileys en memoria
  try {
    await removeWbot(+whatsappId, true);
  } catch (err) {}

  // 2. Eliminar de la base de datos limpiando relaciones dependientes
  await DeleteWhatsAppService(whatsappId);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-whatsapp`, {
    action: "delete",
    whatsappId: +whatsappId
  });

  return res.status(200).json({ message: "Whatsapp deleted." });
};


export const restart = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, profile } = req.user;

  if (profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await restartWbot(companyId);

  return res.status(200).json({ message: "Whatsapp restart." });
};