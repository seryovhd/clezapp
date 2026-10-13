import { Request, Response } from "express";
import { getWbot, removeWbot } from "../libs/wbot";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import EvolutionApiService from "../services/EvolutionApiServices/EvolutionApiService";

const store = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);
  StartWhatsAppSession(whatsapp, companyId).catch(err => {
    // Los errores se registran y actualizan en el modelo Whatsapp
  });

  return res.status(200).json({ message: "Starting session." });
};

const update = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

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

  // Limpiar datos de Baileys para forzar generación de nuevo QR
  await DeleteBaileysService(whatsapp.id);

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
  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

  // Si es Evolution API, desconectar en Evolution API
  if (whatsapp.type === "evolution" || whatsapp.connectionType === "evolution") {
    try {
      await EvolutionApiService.logoutInstance(whatsapp);
    } catch (err) {
      // Ignorar error al desconectar en Evolution
    }
  }

  // Eliminar sesión del array en memoria
  try {
    const wbot = getWbot(whatsapp.id);
    if (wbot) {
      await wbot.logout();
    }
  } catch (err) {
    // Si no existe la sesión, continuar con la limpieza
  }

  // Limpiar sesión en la base de datos
  await whatsapp.update({ status: "DISCONNECTED", session: "", qrcode: "" });
  
  // Asegurarse de que la sesión se elimine del array
  await removeWbot(whatsapp.id, false);

  return res.status(200).json({ message: "Session disconnected." });
};

export default { store, remove, update };
