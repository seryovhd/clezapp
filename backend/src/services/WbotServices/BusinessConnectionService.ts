import Whatsapp from "../../models/Whatsapp";

export class BusinessConnectionService {
  constructor() {
  }

  async verifyAndReconnect(whatsapp: Whatsapp): Promise<boolean> {
    try {
      await this.updateStatus(whatsapp.id.toString(), "DISCONNECTED");
      return false;
    } catch (error) {
      console.error("Error verifying Business API connection:", error);
      await this.updateStatus(whatsapp.id.toString(), "DISCONNECTED");
      return false;
    }
  }

  private async updateStatus(whatsappId: string, status: string): Promise<void> {
    await Whatsapp.update(
      { status },
      { where: { id: whatsappId } }
    );
  }
}