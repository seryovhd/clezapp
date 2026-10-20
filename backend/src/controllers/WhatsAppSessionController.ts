import { Request, Response } from "express";
import { getWbot, removeWbot } from "../libs/wbot";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import EvolutionApiService from "../services/EvolutionApiServices/EvolutionApiService";
import Whatsapp from "../models/Whatsapp";
import User from "../models/User";
import AppError from "../errors/AppError";

const store = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  let whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

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

  // Si no está conectado, limpiar sesión en memoria para forzar nuevo QR limpio
  if (whatsapp.status !== "CONNECTED") {
    try {
      await removeWbot(whatsapp.id, false);
    } catch (err) {}
  }

  StartWhatsAppSession(whatsapp, companyId).catch(err => {
    // Los errores se registran y actualizan en el modelo Whatsapp
  });

  return res.status(200).json({ message: "Starting session." });
};

const update = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  let whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

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

  // Si es Evolution API, desconectar la instancia en Evolution
  if (whatsapp.type === "evolution" || whatsapp.connectionType === "evolution") {
    try {
      await EvolutionApiService.logoutInstance(whatsapp);
    } catch (err) {
      // Ignorar si la instancia no existía previamente
    }
  }

  // Eliminar sesión existente del array en memoria antes de crear una nueva
  try {
    await removeWbot(whatsapp.id, false);
  } catch (err) {
    // Si no existe la sesión, continuar normalmente
  }

  // Limpiar datos de Baileys para forzar generación de nuevo QR sin claves corruptas
  try {
    await DeleteBaileysService(whatsapp.id);
  } catch (err) {}

  // Limpiar sesión en la base de datos
  await whatsapp.update({ session: "", status: "DISCONNECTED", qrcode: "" });

  // Iniciar nueva sesión de forma no bloqueante
  StartWhatsAppSession(whatsapp, companyId).catch(err => {
    // Registrado internamente
  });

  return res.status(200).json({ message: "Starting session." });
};

const remove = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  
  let whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

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

  // Si es Evolution API, desconectar en Evolution API
  if (whatsapp.type === "evolution" || whatsapp.connectionType === "evolution") {
    try {
      await EvolutionApiService.logoutInstance(whatsapp);
    } catch (err) {
      // Ignorar error al desconectar en Evolution
    }
  }

  // Eliminar sesión del array en memoria de forma segura
  try {
    await removeWbot(whatsapp.id, true);
  } catch (err) {}

  // Limpiar sesión en la base de datos para eliminar claves corruptas (Bad MAC)
  await whatsapp.update({ status: "DISCONNECTED", session: "", qrcode: "" });
  
  // Limpiar registros de Baileys
  try {
    await DeleteBaileysService(whatsapp.id);
  } catch (err) {}

  return res.status(200).json({ message: "Session disconnected." });
};

export default { store, remove, update };
