import { getIO } from "../libs/socket";

export class NotificationService {
  static async sendBusinessAPIError(companyId: number, error: any, channelType?: string) {
    const io = getIO();
    
    const errorMap: { [key: string]: string } = {
      "131031": "Cuenta de WhatsApp Business bloqueada. Contacta a soporte de Meta.",
      "131032": "Número de teléfono no verificado.",
      "131033": "Límite de mensajes excedido.",
      "131034": "Plantilla de mensaje no aprobada.",
      "131035": "Número de teléfono no válido.",
      "131036": "Usuario ha bloqueado el negocio.",
      "131037": "Mensaje rechazado por políticas.",
      "131038": "Cuenta suspendida temporalmente.",
      "ERR_BUSINESS_API_TOKEN_EXPIRED": "Token de acceso expirado. Reconecta tu cuenta de Business API.",
      "ERR_BUSINESS_API_NOT_CONFIGURED": "Cuenta de Business API no configurada correctamente.",
      "BUSINESS_ACCOUNT_LOCKED": "Cuenta de WhatsApp Business bloqueada por Meta.",
      "CONNECTION_DELETED": "La conexión asociada a este ticket fue eliminada. Por favor, vincule una nueva conexión al ticket."
    };

    const userMessage = errorMap[error.code] || error.message || "Error al enviar mensaje";

    // Título dinámico basado en el tipo de canal
    let title = "Error de Conexión";
    if (channelType) {
      switch (channelType) {
        case 'facebook':
        case 'facebook_messenger':
          title = "Error de Facebook Messenger";
          break;
        case 'instagram':
          title = "Error de Instagram";
          break;
        case 'whatsapp':
        case 'whatsapp_business':
        case 'baileys':
          title = "Error de WhatsApp Business";
          break;
        case 'webchat':
          title = "Error de Webchat";
          break;
        default:
          title = "Error de Conexión";
      }
    }

    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-notification`, {
      type: "error",
      title: title,
      message: userMessage,
      code: error.code,
      timestamp: new Date(),
      action: "business_api_error"
    });
  }

  static async sendAccountLockedNotification(companyId: number, whatsappId: number) {
    const io = getIO();
    
    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-notification`, {
      type: "warning",
      title: "Cuenta Bloqueada",
      message: "Tu cuenta de WhatsApp Business ha sido bloqueada por Meta. Contacta al soporte para resolverlo.",
      timestamp: new Date(),
      action: "account_locked",
      whatsappId: whatsappId
    });
  }
}