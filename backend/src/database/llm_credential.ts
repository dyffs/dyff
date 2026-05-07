import {
  Table,
  Column,
  Model,
  DataType,
  AllowNull,
  AutoIncrement,
  PrimaryKey,
  Index,
  UpdatedAt,
  CreatedAt,
  BelongsTo,
} from "sequelize-typescript";
import Team from "./team";

@Table({
  timestamps: true,
  tableName: "llm_credentials",
  underscored: true,
  indexes: [
    {
      name: "llm_credentials_team_id_unique",
      unique: true,
      fields: ["team_id"],
    },
  ],
})
export default class LlmCredential extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare id: string;

  @Index
  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  declare team_id: string;

  @AllowNull(false)
  @Column({ type: DataType.TEXT })
  declare provider_name: string;

  @AllowNull(false)
  @Column({ type: DataType.TEXT })
  declare model_code: string;

  /** base64(IV || ciphertext || authTag) — see api_key_crypto.ts */
  @AllowNull(false)
  @Column({ type: DataType.TEXT })
  declare encrypted_api_key: string;

  @BelongsTo(() => Team, { foreignKey: "teamId", constraints: false })
  declare team: Team;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
