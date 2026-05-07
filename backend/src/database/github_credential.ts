import { Table, Column, Model, DataType, AllowNull, AutoIncrement, PrimaryKey, Index, UpdatedAt, CreatedAt, BelongsTo } from "sequelize-typescript";
import User from "./user";

export type GithubCredentialKind = 'github_app_installation' | 'oauth_user' | 'pat'

@Table({
  timestamps: true,
  tableName: 'github_credentials',
  underscored: true,
  indexes: [
    {
      name: 'github_credentials_kind_team_user_account_installation_unique',
      unique: true,
      fields: ['kind', 'team_id', 'user_id', 'account_type', 'installation_id'],
    },
  ],
})
export default class GithubCredential extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare id: string;

  @AllowNull(false)
  @Column({ type: DataType.TEXT })
  declare kind: GithubCredentialKind;

  @Index
  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  declare team_id: string;

  @Index
  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  declare user_id: string;

  @AllowNull(true)
  @Column({ type: DataType.TEXT })
  declare installation_id: string | null;

  @AllowNull(true)
  @Column({ type: DataType.TEXT })
  declare account_login: string | null;

  @AllowNull(false)
  @Column({ type: DataType.TEXT })
  declare account_type: 'User' | 'Organization';

  @AllowNull(false)
  @Column({ type: DataType.JSONB })
  declare credentials: object;

  @Column({ type: DataType.TEXT })
  declare access_token: string;

  @Column({ type: DataType.DATE })
  declare access_token_expires_at: Date;

  @Column({ type: DataType.TEXT })
  declare refresh_token: string;

  @BelongsTo(() => User, { foreignKey: 'userId', constraints: false })
  declare user: User;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
