import Message from "../../models/Message";

export const UpdateMessageAck = async (messageId: string): Promise<void> => {
  try {
    // Buscar el mensaje por su ID
    const message = await Message.findOne({
      where: {
        id: messageId
      }
    });

    // Si no se encuentra el mensaje, no hacer nada
    if (!message) {
      //console.warn(`Message with ID ${messageId} not found.`);
      return;
    }

    // Actualizar el campo 'ack' a 3
    await message.update({
      ack: 3
    });

    console.log(`Message with ID ${messageId} updated with ack: 3`);
  } catch (error) {
    console.error(`Error updating message ack for message ID ${messageId}:`, error);
    throw new Error("Error updating message acknowledgment.");
  }
};
