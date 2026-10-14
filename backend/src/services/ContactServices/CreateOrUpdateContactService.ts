import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import { isNil } from "lodash";
import { Op } from "sequelize";

interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  isGroup: boolean;
  email?: string;
  profilePicUrl?: string;
  companyId: number;
  extraInfo?: ExtraInfo[];
  whatsappId?: number;
  disableBot?: boolean;
  lid?: string;
  lidWarningAt?: Date;
}

const CreateOrUpdateContactService = async ({
  name,
  number: rawNumber,
  profilePicUrl,
  isGroup,
  email = "",
  companyId,
  extraInfo = [],
  whatsappId,
  disableBot = false,
  lid,
  lidWarningAt
}: Request): Promise<Contact> => {
  const number = isGroup ? rawNumber : rawNumber.replace(/[^0-9]/g, "");

  const io = getIO();
  let contact: Contact | null;

  // Si viene con lid, buscar por number o por lid
  if (lid) {
    contact = await Contact.findOne({
      where: {
        companyId,
        [Op.or]: [{ number }, { lid }]
      }
    });
  } else {
    contact = await Contact.findOne({
      where: {
        number,
        companyId
      }
    });
  }

  if (contact) {
    const updateData: any = { profilePicUrl };
    if (lid && !contact.lid) {
      updateData.lid = lid;
    }
    if (lidWarningAt && !contact.lidWarningAt) {
      updateData.lidWarningAt = lidWarningAt;
    }
    if (contact.number.length >= 15 && number.length >= 8 && number.length <= 14) {
      updateData.number = number;
      if (!contact.lid) updateData.lid = contact.number;
    }
    if (name && (contact.name === contact.number || /^\d+$/.test(contact.name)) && name !== number) {
      updateData.name = name;
    }
    if (isNil(contact.whatsappId === null)) {
      updateData.whatsappId = whatsappId;
    }
    if (!contact.canal) {
      updateData.channel = "whatsapp";
    }
    await contact.update(updateData);
    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
      action: "update",
      contact
    });
  } else {
    contact = await Contact.create({
      name,
      number,
      profilePicUrl,
      email,
      isGroup,
      extraInfo,
      companyId,
      whatsappId,
      disableBot,
      canal: "Whatsapp",
      lid,
      lidWarningAt
    });

    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
      action: "create",
      contact
    });
  }

  return contact;
};

export default CreateOrUpdateContactService;
