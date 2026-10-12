import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";

interface HubContact {
  name: string;
  firstName: string;
  lastName: string;
  picture: string;
  from: string;
  number?: string | null;  // Definido como opcional y puede ser null
  whatsapp?: Whatsapp | null;  // Definido como opcional y puede ser null
  channel: string;
  companyId: number;
}

const FindOrCreateContactService = async (
  contact: HubContact
): Promise<Contact> => {
  const { name, picture, firstName, lastName, from, channel, companyId, whatsapp, number } = contact;

  console.log('🔍 FindOrCreateContactService:: CONTACTO RECIBIDO =>', contact);

  let contactExists: Contact | null = null;
  let messengerId: string | null = null;
  let instagramId: string | null = null;
  let canal: string = channel;
  
  console.log("TEST:: ", channel);
  // Buscar si el contacto ya existe dependiendo del canal
  if (channel === 'facebook') {
    messengerId = from;
    contactExists = await Contact.findOne({
      where: { messengerId }
    });
  } else if (channel === 'instagram') {
    instagramId = from;
    contactExists = await Contact.findOne({
      where: { instagramId }
    });
  } else if (channel === 'webchat') {
    contactExists = await Contact.findOne({
      where: {
        number: from,
        companyId
      }
    });
  }

  // Si el contacto ya existe, actualizamos su información
  if (contactExists) {
    await contactExists.update({
      name: name || firstName || "Nombre no disponible",
      firstName,
      lastName,
      profilePicUrl: (picture || "").slice(0, 255),
      whatsappId: whatsapp?.id || null
    });
    return contactExists;
  }

  // Si no existe, lo creamos
  const newContact = await Contact.create({
    name: name || firstName || "Nombre no disponible",
    number: number ?? null,  // <- Ahora se pasa bien el número
    profilePicUrl: (picture || "").slice(0, 255),
    messengerId,
    instagramId,
    companyId,
    whatsappId: whatsapp?.id || null,
    canal: channel || canal || null,
  });

  return newContact;
};

export default FindOrCreateContactService;
