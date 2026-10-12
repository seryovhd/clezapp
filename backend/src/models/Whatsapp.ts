import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Default,
  AllowNull,
  HasMany,
  Unique,
  BelongsToMany,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Queue from "./Queue";
import Ticket from "./Ticket";
import WhatsappQueue from "./WhatsappQueue";
import Company from "./Company";
import Prompt from "./Prompt";
import QueueIntegrations from "./QueueIntegrations";
import {FlowBuilderModel} from "./FlowBuilder";

@Table
class Whatsapp extends Model<Whatsapp> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull
  @Unique
  @Column(DataType.TEXT)
  name: string;

  @Column(DataType.TEXT)
  session: string;

  @Column(DataType.TEXT)
  qrcode: string;

  @Column
  status: string;

  @Column
  battery: string;

  @Column
  plugged: boolean;

  @Column
  retries: number;

  @Default("")
  @Column(DataType.TEXT)
  greetingMessage: string;

  @Default("")
  @Column(DataType.TEXT)
  farewellMessage: string;

  @Default("")
  @Column(DataType.TEXT)
  complationMessage: string;

  @Default("")
  @Column(DataType.TEXT)
  outOfHoursMessage: string;

  @Default("")
  @Column(DataType.TEXT)
  ratingMessage: string;

  @Column({ defaultValue: "stable" })
  provider: string;

  @Default(false)
  @AllowNull
  @Column
  isDefault: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @BelongsToMany(() => Queue, () => WhatsappQueue)
  queues: Array<Queue & { WhatsappQueue: WhatsappQueue }>;

  @HasMany(() => WhatsappQueue)
  whatsappQueues: WhatsappQueue[];

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  token: string;

  @Column
  transferQueueId: number;

  @Column
  timeToTransfer: number;  

  @ForeignKey(() => Prompt)
  @Column
  promptId: number;

  @BelongsTo(() => Prompt)
  prompt: Prompt;

  @ForeignKey(() => QueueIntegrations)
  @Column
  integrationId: number;

  @BelongsTo(() => QueueIntegrations)
  queueIntegrations: QueueIntegrations;

  @Column
  maxUseBotQueues: number;

  @Column
  timeUseBotQueues: string;

  @Column
  expiresTicket: number;
  
  @Column
  number: string;
  
  @Column
  expiresInactiveMessage: string;

  @Column
  type: string;

  @AllowNull
  @Column(DataType.TEXT)
  connectionType: string;

  @AllowNull
  @Column(DataType.TEXT)
  instanceName: string;

  @ForeignKey(() => FlowBuilderModel)
  @Column
  flowIdNotPhrase: number;

  @ForeignKey(() => FlowBuilderModel)
  @Column
  flowIdWelcome: number;

  @BelongsTo(() => FlowBuilderModel)
  flowBuilder: FlowBuilderModel;
  
  @AllowNull
  @Column(DataType.TEXT)
  businessAccountId: string;

  @AllowNull
  @Column(DataType.TEXT)
  phoneNumberId: string;

  @AllowNull
  @Column(DataType.TEXT)
  wabaId: string;

  @AllowNull
  @Column(DataType.TEXT)
  businessAccessToken: string;

  @AllowNull
  @Column(DataType.DATE)
  businessTokenExpiresAt: Date;

  @AllowNull
  @Column(DataType.TEXT)
  businessName: string;

  @AllowNull
  @Column(DataType.TEXT)
  businessVerificationStatus: string;

  @AllowNull
  @Column(DataType.TEXT)
  webhookVerifyToken: string;

  @AllowNull
  @Column(DataType.TEXT)
  webhookUrl: string;

  @Default(false)
  @Column
  webhookEnabled: boolean;

  @AllowNull
  @Column(DataType.JSONB)
  businessMetadata: any;

  // ==================== CAMPOS NUEVOS PARA FACEBOOK MESSENGER ====================

  @AllowNull
  @Column(DataType.TEXT)
  facebookPageId: string;

  @AllowNull
  @Column(DataType.TEXT)
  facebookPageName: string;

  @AllowNull
  @Column(DataType.TEXT)
  facebookAccessToken: string;

  @AllowNull
  @Column(DataType.DATE)
  facebookTokenExpiresAt: Date;

  @AllowNull
  @Column(DataType.TEXT)
  facebookPageCategory: string;

  @AllowNull
  @Column(DataType.INTEGER)
  facebookFanCount: number;

  @AllowNull
  @Column(DataType.TEXT)
  facebookPageLink: string;

  @Default(false)
  @Column
  facebookWebhookEnabled: boolean;

  @AllowNull
  @Column(DataType.JSONB)
  facebookMetadata: any; // Para almacenar metadata adicional de la página

  // ==================== MÉTODOS DE CONVENIENCIA ====================

  isBaileysConnection(): boolean {
    return this.type === "baileys";
  }

  isBusinessConnection(): boolean {
    return this.type === "whatsapp_business";
  }

  isFacebookConnection(): boolean {
    return this.type === "facebook_messenger";
  }

  getConnectionInfo(): any {
    switch (this.type) {
      case "baileys":
        return {
          type: "baileys",
          number: this.number,
          status: this.status
        };
      case "whatsapp_business":
        return {
          type: "whatsapp_business",
          businessName: this.businessName,
          phoneNumber: this.number,
          verificationStatus: this.businessVerificationStatus
        };
      case "facebook_messenger":
        return {
          type: "facebook_messenger",
          pageName: this.facebookPageName,
          pageId: this.facebookPageId,
          category: this.facebookPageCategory
        };
      default:
        return { type: "unknown" };
    }
  }
}

export default Whatsapp;