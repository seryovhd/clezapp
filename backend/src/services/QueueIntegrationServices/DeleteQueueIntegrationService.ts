import QueueIntegrations from "../../models/QueueIntegrations";
import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";

const DeleteQueueIntegrationService = async (id: string): Promise<void> => {
  console.log("-- BORRADO DE INTEGRACION --");

  const integration = await QueueIntegrations.findOne({
    where: { id }
  });

  if (!integration) {
    throw new AppError("ERR_NO_DIALOG_FOUND", 404);
  }

  // Actualizar todos los tickets que están usando esta integración
  await Ticket.update(
    { integrationId: null },
    { where: { integrationId: integration.id } }
  );

  // Ahora sí eliminar la integración
  await integration.destroy();
};

export default DeleteQueueIntegrationService;
