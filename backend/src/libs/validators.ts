/**
 * Clase utilitaria para validación de payloads en eventos WebSocket
 */
export class PayloadValidator {
  /**
   * Valida el payload de un evento WebSocket
   * @param eventName Nombre del evento
   * @param payload Datos del evento
   * @throws Error si el payload es inválido
   */
  static validateEventPayload(eventName: string, payload: any): void {
    switch (eventName) {
      case 'joinChatBox':
      case 'leaveChatBox':
        PayloadValidator.validateTicketId(payload);
        break;
      
      case 'joinTickets':
      case 'leaveTickets':
        PayloadValidator.validateTicketStatus(payload);
        break;
        
      case 'joinNotification':
      case 'leaveNotification':
        // Eventos sin payload
        break;
        
      default:
        // Para otros eventos, agregar validaciones específicas según sea necesario
        break;
    }
  }
  
  /**
   * Valida el ID del ticket
   * @param ticketId ID del ticket
   * @throws Error si el ID es inválido
   */
  private static validateTicketId(ticketId: any): void {
    if (typeof ticketId !== 'string') {
      throw new Error('El ID del ticket debe ser una cadena');
    }
    
    if (ticketId === 'undefined' || ticketId === 'null' || !ticketId) {
      throw new Error('El ID del ticket no puede estar vacío');
    }
    
    // Evitar IDs muy largos para prevenir ataques de DoS
    if (ticketId.length > 100) {
      throw new Error('El ID del ticket es demasiado largo');
    }
  }
  
  /**
   * Valida el estado del ticket
   * @param status Estado del ticket
   * @throws Error si el estado es inválido
   */
  private static validateTicketStatus(status: any): void {
    if (typeof status !== 'string') {
      throw new Error('El estado debe ser una cadena');
    }
    
    const validStatuses = ['open', 'pending', 'closed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`\x1b[31mEstado inválido: ${status}\x1b[0m`);
    }
  }
}
