import { head } from "lodash";
import XLSX from "xlsx";
import ContactListItem from "../../models/ContactListItem";
import CheckContactNumber from "../WbotServices/CheckNumber";
import { logger } from "../../utils/logger";

interface ContactData {
  name: string;
  number: string;
  email: string;
  companyId: number;
  contactListId: number;
}

// Utilidad para limpiar y normalizar las claves de los encabezados
const normalizeKey = (key: string) =>
  key
    .toLowerCase()
    .normalize("NFD") // elimina acentos
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export async function ImportContacts(
  contactListId: number,
  companyId: number,
  file: Express.Multer.File | undefined
) {
  const workbook = XLSX.readFile(file?.path as string);
  const worksheet = head(Object.values(workbook.Sheets)) as any;
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  const headers: string[] = rows[0].map(normalizeKey); // encabezados normalizados
  console.log("Encabezados normalizados:", headers);
  const dataRows = rows.slice(1); // filas de datos sin encabezado

  const contacts: ContactData[] = dataRows
    .map((row) => {
      const rowData: any = {};
      headers.forEach((key, index) => {
        rowData[key] = row[index];
      });
      console.log("Fila procesada:", rowData);
      const name = rowData["nombre"] || rowData["nome"];
      let number = rowData["numero"] || "";
      number = `${number}`.replace(/\D/g, "");
      const email = rowData["email"];

      return { name, number, email, companyId, contactListId };
    })
    .filter((c) => !!c.name && !!c.number); // Filtrar contactos incompletos

  const contactList: ContactListItem[] = [];

  for (const contact of contacts) {
    const [newContact, created] = await ContactListItem.findOrCreate({
      where: {
        number: `${contact.number}`,
        contactListId: contact.contactListId,
        companyId: contact.companyId,
      },
      defaults: contact,
    });
    if (created) {
      contactList.push(newContact);
    }
  }

  for (let newContact of contactList) {
    try {
      const response = await CheckContactNumber(newContact.number, companyId);
      newContact.isWhatsappValid = response.exists;
      const number = response.jid.replace(/\D/g, "");
      newContact.number = number;
      await newContact.save();
    } catch (e) {
      logger.error(`Número de contacto inválido: ${newContact.number}`);
    }
  }

  return contactList;
}
