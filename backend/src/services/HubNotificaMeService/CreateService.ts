import * as Yup from "yup";
import AppError from "../../errors/AppError";
import HubNotificaMe from "../../models/HubNotificaMe";
import Whatsapp from "../../models/Whatsapp";
import { ValidationError } from "yup";

interface Data {
  nome: string;
  token: string;
  companyId: number | string;
  tipo: string;
}

const CreateService = async (data: Data): Promise<HubNotificaMe> => {
  const { nome, token, tipo, companyId } = data;

  // Validación de todos los campos requeridos
  const schema = Yup.object().shape({
    nome: Yup.string().required("ERR_HUBNOTIFICAME_REQUIRED_NOME"),
    token: Yup.string()
      .min(6, "ERR_HUBNOTIFICAME_INVALID_TOKEN")
      .required("ERR_HUBNOTIFICAME_REQUIRED"),
    companyId: Yup.number()
      .typeError("ERR_HUBNOTIFICAME_INVALID_COMPANYID")
      .required("ERR_HUBNOTIFICAME_REQUIRED_COMPANYID"),
    tipo: Yup.string().required("ERR_HUBNOTIFICAME_REQUIRED_TIPO")
  });

  // Validación del esquema
  try {
    await schema.validate(data);
  } catch (err) {
    if (err instanceof ValidationError) {
      throw new AppError(err.message);
    }
    throw err;
  }

  // Transacción de base de datos para garantizar integridad
  const sequelize = HubNotificaMe.sequelize;

  const record = await sequelize.transaction(async (t) => {
    // Creación del registro en la tabla HubNotificaMe
    const hubRecord = await HubNotificaMe.create(data, { transaction: t });

    // Creación del registro en la tabla Whatsapp
    await Whatsapp.create({
      qrcode: token,        // Mismo valor que el token
      status: "CONNECTED",  // Estado fijo por defecto
      createdAt: new Date(), // Fecha y hora actuales
      updatedAt: new Date(), // Fecha y hora actuales
      name: nome,           // Mismo valor que nome
      companyId: companyId, // Extraído del input
      type: tipo            // Mismo valor que tipo
    }, { transaction: t });

    return hubRecord;
  });

  return record;
};

export default CreateService;
