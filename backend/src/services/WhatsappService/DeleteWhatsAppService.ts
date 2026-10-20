import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import Baileys from "../../models/Baileys";
import BaileysChats from "../../models/BaileysChats";
import WhatsappQueue from "../../models/WhatsappQueue";
import User from "../../models/User";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";

const DeleteWhatsAppService = async (id: string): Promise<void> => {
  const whatsapp = await Whatsapp.findOne({
    where: { id }
  });

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  // 1. Limpiar Baileys y BaileysChats asociados
  try {
    await Baileys.destroy({ where: { whatsappId: id } });
  } catch (err) {}

  try {
    await BaileysChats.destroy({ where: { whatsappId: id } });
  } catch (err) {}

  // 2. Limpiar WhatsappQueues asociados
  try {
    await WhatsappQueue.destroy({ where: { whatsappId: id } });
  } catch (err) {}

  // 3. Desvincular de Usuarios que lo tengan asignado por defecto
  try {
    await User.update({ whatsappId: null }, { where: { whatsappId: id } });
  } catch (err) {}

  // 4. Desvincular de Contactos
  try {
    await Contact.update({ whatsappId: null }, { where: { whatsappId: id } });
  } catch (err) {}

  // 5. Desvincular de Tickets activos para no romper integridad referencial
  try {
    await Ticket.update({ whatsappId: null }, { where: { whatsappId: id } });
  } catch (err) {}

  // 6. Eliminar el registro del WhatsApp
  await whatsapp.destroy();
};

export default DeleteWhatsAppService;
