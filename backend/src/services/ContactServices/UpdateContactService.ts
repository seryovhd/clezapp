import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import { getIO } from "../../libs/socket";

interface ExtraInfo {
  id?: number;
  name: string;
  value: string;
}
interface ContactData {
  email?: string;
  number?: string;
  name?: string;
  active?: boolean;  
  extraInfo?: ExtraInfo[];
  disableBot?: boolean
}

interface Request {
  contactData: ContactData;
  contactId: string;
  companyId: number;
}

const UpdateContactService = async ({
  contactData,
  contactId,
  companyId
}: Request): Promise<Contact> => {
  const { email, name, number, extraInfo, active, disableBot } = contactData;

  const contact = await Contact.findOne({
    where: { id: contactId },
    attributes: ["id", "name", "number", "email", "companyId", "profilePicUrl", "active","messengerId", "instagramId","canal"],
    include: ["extraInfo"]
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  if (contact.companyId !== companyId) {
    throw new AppError("Não é possível alterar registros de outra empresa");
  }

  if (extraInfo) {
    await Promise.all(
      extraInfo.map(async (info: any) => {
        await ContactCustomField.upsert({ ...info, contactId: contact.id });
      })
    );

    await Promise.all(
      contact.extraInfo.map(async oldInfo => {
        const stillExists = extraInfo.findIndex(info => info.id === oldInfo.id);

        if (stillExists === -1) {
          await ContactCustomField.destroy({ where: { id: oldInfo.id } });
        }
      })
    );
  }

  if (number && number !== contact.number) {
    const cleanNum = number.replace(/\D/g, "");
    const existingContact = await Contact.findOne({
      where: {
        number: cleanNum,
        companyId,
        id: { [Op.ne]: contact.id }
      }
    });

    if (existingContact) {
      if (contact.lid && !existingContact.lid) {
        await existingContact.update({ lid: contact.lid });
      }
      await Ticket.update({ contactId: existingContact.id }, { where: { contactId: contact.id } });
      await Message.update({ contactId: existingContact.id }, { where: { contactId: contact.id } });
      
      const oldContactId = contact.id;
      try {
        await ContactCustomField.destroy({ where: { contactId: oldContactId } });
        await contact.destroy();
        const io = getIO();
        io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
          action: "delete",
          contactId: oldContactId
        });
      } catch (eDestroy) {}

      await existingContact.reload({
        attributes: ["id", "name", "number", "email", "profilePicUrl", "active", "messengerId", "instagramId", "canal", "disableBot"],
        include: ["extraInfo"]
      });
      return existingContact;
    }
  }

  await contact.update({
    name,
    number,
    email,
    active,
    disableBot
  });

  await contact.reload({
    attributes: ["id", "name", "number", "email", "profilePicUrl", "active", "messengerId", "instagramId", "canal", "disableBot"],
    include: ["extraInfo"]
  });

  return contact;
};

export default UpdateContactService;
