import { Request, Response } from "express";
import Whatsapp from "../models/Whatsapp";
import HubMessageListener from "../services/HubServices/HubMessageListener";

export const listen = async (req: Request, res: Response): Promise<Response> => {
  const medias = req.files as Express.Multer.File[];
  const { channelId } = req.params;

  console.log("📨 Webhook received for channel:", channelId);

  // ✅ Validación inicial de datos necesarios
  if (!channelId || !req.body) {
    return res.status(400).json({ message: "Missing channelId or request body" });
  }

  // 🔍 Buscar la conexión correspondiente al canal
  const connection = await Whatsapp.findOne({ where: { qrcode: channelId } });

  if (!connection) {
    console.warn(`⚠️ No WhatsApp connection found for channelId: ${channelId}`);
    return res.status(404).json({ message: "Whatsapp channel not found" });
  }

  try {
    // 🧾 Logging útil en desarrollo
    //console.log("📝 Cuerpo de la solicitud:", JSON.stringify(req.body, null, 2));
    // console.log("📎 Número de archivos multimedia:", medias?.length || 0);  // HUB DEPURACIÓN   

    // 🛠️ Procesar el mensaje recibido
    await HubMessageListener(req.body, connection, medias);

    return res.status(200).json({ message: "Webhook received" });
  } catch (error: any) {
    // ❌ Captura de errores con logging claro
    console.error("🔥 Error processing webhook:", error);
    return res.status(400).json({ message: error.message || "Unknown error occurred" });
  }
};
