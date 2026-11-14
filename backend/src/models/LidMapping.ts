import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  Index
} from "sequelize-typescript";
import Company from "./Company";

@Table({
  tableName: "LidMappings"
})
class LidMapping extends Model<LidMapping> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Index("idx_lid_mappings_company_lid")
  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Index("idx_lid_mappings_company_lid")
  @Column
  lid: string;

  @Index("idx_lid_mappings_phone")
  @Column
  phoneNumber: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default LidMapping;
