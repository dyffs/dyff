import { Table, Column, Model, DataType, AllowNull, HasMany, AutoIncrement, PrimaryKey, Index, UpdatedAt, CreatedAt, BelongsTo, DeletedAt, HasOne } from "sequelize-typescript";
import Team from "./team";

@Table({
  timestamps: true,
  paranoid: true,
  tableName: 'users',
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['team_id', 'email']
    }
  ]
})
export default class User extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare id: string;

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  declare email: string;

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  declare role: string;

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  declare display_name: string;

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  declare status: "registered" | "unregistered" | "invited";

  @AllowNull(false)
  @Column({
    type: DataType.JSONB,
  })
  declare settings: object;

  @Column({
    type: DataType.TEXT,
  })
  @Index
  declare github_username: string | null;

  @Column({
    type: DataType.TEXT,
  })
  @Index
  declare slack_username: string | null;

  @Column({
    type: DataType.TEXT,
  })
  @Index
  declare slack_user_id: string | null;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
  })
  declare is_bot: boolean;

  @Column({
    type: DataType.DATE,
  })
  declare last_login_at: Date;

  @AllowNull(true)
  @Column({
    type: DataType.TEXT,
  })
  declare password_hash: string | null;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare team_id: string;

  @BelongsTo(() => Team, { foreignKey: 'teamId', constraints: false })
  declare team: Team;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;

  @DeletedAt
  declare deleted_at: Date; 
}
