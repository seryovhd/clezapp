import { head } from "lodash";
import XLSX from "xlsx";
import { has } from "lodash";
import Contact from "../../models/Contact";
import CheckContactNumber from "../WbotServices/CheckNumber";
import { logger } from "../../utils/logger";
// PARCHE BASE 1.3 - IMPORTAR CONTACTOS

interface ContactData {
  name: string;
  number: string;
  email: string;
  companyId: number;
}

export async function ImportContacts(
  companyId: number,
  file: Express.Multer.File | undefined
) {
  const workbook = XLSX.readFile(file?.path as string);
  const worksheet = head(Object.values(workbook.Sheets)) as any;
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 0 });

  const ignored: ContactData[] = [];

  const contacts: ContactData[] = rows
    .map(row => {
      let name = "";
      let number = "";
      let email = "";

      if (has(row, "nome") || has(row, "Nome") || has(row, "nombre") || has(row, "Nombre")) {
        const rawName = row["nome"] || row["Nome"] || row["nombre"] || row["Nombre"];

        if (typeof rawName === "string") {
          const trimmed = rawName.trim();
          const isLikelyNumber = /^\d{10,}$/.test(trimmed) || /^[\d.]+e\+\d+$/i.test(trimmed);
          if (!isLikelyNumber) {
            name = trimmed;
          }
        }

        if (typeof rawName === "number") {
          name = "";
        }
      }

      if (
        has(row, "numero") ||
        has(row, "número") ||
        has(row, "Numero") ||
        has(row, "Número")
      ) {
        number = row["numero"] || row["número"] || row["Numero"] || row["Número"];
        number = `${number}`.replace(/\D/g, "");
      }

      if (
        has(row, "email") ||
        has(row, "e-mail") ||
        has(row, "Email") ||
        has(row, "E-mail")
      ) {
        email = row["email"] || row["e-mail"] || row["Email"] || row["E-mail"];
      }

      return { name, number, email, companyId };
    })
    .filter(c => {
      const isValid = !!c.name?.trim() && !!c.number?.trim();
      if (!isValid) ignored.push(c);
      return isValid;
    });

  if (ignored.length > 0) {
    logger.warn(`⚠️ Contactos ignorados por datos incompletos: ${ignored.length}`);
  }

  const contactList: Contact[] = [];

  for (const contact of contacts) {
    const [newContact, created] = await Contact.findOrCreate({
      where: {
        number: `${contact.number}`,
        companyId: contact.companyId
      },
      defaults: contact
    });
    if (created) {
      contactList.push(newContact);
    }
  }

  for (let newContact of contactList) {
    try {
      const response = await CheckContactNumber(newContact.number, companyId);
      const number = response.jid.replace(/\D/g, "");
      newContact.number = number;
      await newContact.save();
    } catch (e) {
      logger.error(`❌ Número inválido: ${newContact.number}`);
    }
  }
  // PARCHE BASE 1.3 - IMPORTAR CONTACTOS FIN
  return contactList;
}
