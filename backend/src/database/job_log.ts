import { Table, Column, Model, DataType, AllowNull, AutoIncrement, PrimaryKey, Index, CreatedAt, BelongsTo } from "sequelize-typescript";
import JobModel from "./job";

@Table({
  timestamps: true,
  tableName: 'job_logs',
  underscored: true,
  updatedAt: false,
})
export default class JobLogModel extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare job_id: string;

  @Column({ type: DataType.BIGINT })
  declare team_id: string;

  @Column({ type: DataType.BIGINT })
  declare user_id: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING(20) })
  declare severity: 'info' | 'warn' | 'error' | 'debug';

  @AllowNull(false)
  @Column({ type: DataType.JSONB, defaultValue: {} })
  declare data: Record<string, any>;

  @BelongsTo(() => JobModel, { foreignKey: 'job_id', constraints: false })
  declare job: JobModel;

  @Index
  @CreatedAt
  declare created_at: Date;
}
