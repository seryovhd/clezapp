import { getIO } from "../../libs/socket";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";

// Definiendo la interfaz para los datos del mensaje
interface MessageData {
  id: string;
  contactId: number;
  body: string;
  ticketId: number;
  fromMe: boolean;
  queueId?: number;
  fileName?: string;
  mediaType?: string;
  originalName?: string;
  companyId: number; // Asegurando que companyId siempre sea un número
}

const CreateMessageService = async (messageData: MessageData): Promise<Message | any> => {
  console.log("📝 CREANDO MENSAJE: ", { messageData });

  const {
    id,
    contactId,
    body,
    ticketId,
    fromMe,
    fileName,
    mediaType,
    originalName,
    companyId, // Incluimos el companyId en los datos
  } = messageData;

  // Validación de campos requeridos
  const missingFields: string[] = [];

  if (!companyId) missingFields.push("companyId");
  if (!ticketId) missingFields.push("ticketId");
  //if (!contactId) missingFields.push("contactId");

  if (missingFields.length > 0) {
    const missingFieldsMessage = `Faltan los siguientes campos requeridos: ${missingFields.join(", ")}`;
    // Imprimir en rojo
    console.error(`\x1b[31m\x1b[1m${missingFieldsMessage}\x1b[0m`);
    throw new AppError("ERR_MISSING_REQUIRED_FIELDS", 400);
  }  

  // Verificando si la mensaje o archivo está vacío
  if ((!body || body === "") && (!fileName || fileName === "")) {
    return;
  }

  const data: any = {
    id,
    contactId,
    body,
    ticketId,
    fromMe,
    ack: 2,
    companyId, // Incluyendo companyId en los datos
  };

  if (fileName) {
    data.mediaUrl = fileName;
    data.mediaType = mediaType === "photo" ? "image" : mediaType;
    data.body = data.mediaUrl;

    console.log("🎥 TIPO DE MEDIO DENTRO DE CREATEHUBMESSAGESERVICE:", data.mediaType);
  }

  try {
    // Intentando crear la nueva mensaje
    const newMessage = await Message.create(data);
    //console.log("📩 NUEVO MENSAJE CREADO EN BD: ", newMessage);

    // Buscando el mensaje recientemente creado
    const message = await Message.findByPk(messageData.id, {
      include: [
        "contact",
        {
          model: Ticket,
          as: "ticket",
          include: [
            "contact",
            "queue",
            {
              model: Whatsapp,
              as: "whatsapp",
              attributes: ["name"],
            },
          ],
        },
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"],
        },
      ],
    });

    //console.log("🔍 MENSAJE BUSCADO DEL BANCO:", message); // HUB DEPURACIÓN

    if (!message) {
      throw new AppError("ERR_CREATING_MESSAGE", 500);
    }

    // Verificando si el mensaje pertenece a una cola y actualizándola
    if (message.ticket.queueId !== null && message.queueId === null) {
      await message.update({ queueId: message.ticket.queueId });
    }

    // Emitiendo el mensaje usando WebSocket
    const io = getIO();
    emitMessageToChannels(io, message, companyId);

    return message;
  } catch (error) {
    console.error("Error al crear mensaje:", error);
    throw new AppError("ERR_CREATING_MESSAGE", 500);  // Mensaje de error más específico
  }
};

// Función auxiliar para emitir el mensaje a los canales correctos
const emitMessageToChannels = (io, message, companyId) => {
  const ticketId = message.ticketId.toString();
  const status = message.ticket.status;
  io.to(ticketId)
    .to(`company-${companyId}-${status}`)
    .to(`company-${companyId}-notification`)
    .to(`queue-${message.ticket.queueId}-${status}`)
    .to(`queue-${message.ticket.queueId}-notification`)
    .emit(`company-${companyId}-appMessage`, {
      action: "create",
      message,
      ticket: message.ticket,
      contact: message.ticket.contact,
    });
};

export default CreateMessageService;
