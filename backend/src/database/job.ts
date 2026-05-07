import { Table, Column, Model, DataType, AllowNull, AutoIncrement, PrimaryKey, Index, UpdatedAt, CreatedAt, BelongsTo } from "sequelize-typescript";
import User from "./user";
import Team from "./team";

@Table({
  timestamps: true,
  tableName: 'jobs',
  underscored: true,
  indexes: [
    {
      fields: ['team_id', 'source_type'],
      name: 'idx_jobs_team_id_source_type',
    },
  ]
})
export default class JobModel extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare user_id: string;

  @Column({ type: DataType.BIGINT })
  declare team_id: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING(255) })
  declare source_type: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  declare source_id: string;

  @Column({ type: DataType.BIGINT })
  declare chat_session_id: string;

  @AllowNull(false)
  @Column({ type: DataType.JSONB, defaultValue: {} })
  declare payload: Record<string, any>;

  @AllowNull(false)
  @Column({ type: DataType.STRING(50), defaultValue: 'pending' })
  declare status: 'pending' | 'running' | 'completed' | 'failed';

  @Column({ type: DataType.JSONB })
  declare result: any;

  @Column({ type: DataType.TEXT })
  declare error: string | null;

  @Index
  @Column({ type: DataType.DATE })
  declare started_at: Date | null;

  @Index
  @Column({ type: DataType.DATE })
  declare completed_at: Date | null;

  @BelongsTo(() => User, { foreignKey: 'userId', constraints: false })
  declare user: User;

  @BelongsTo(() => Team, { foreignKey: 'teamId', constraints: false })
  declare team: Team;

  @Index
  @CreatedAt
  declare created_at: Date;

  @Index
  @UpdatedAt
  declare updated_at: Date;

  async saveResult(result: Record<string, any>) {
    this.result = result
    this.save()
  }
}
