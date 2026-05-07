import { Table, Column, Model, DataType, AllowNull, AutoIncrement, PrimaryKey, Index, UpdatedAt, CreatedAt, BelongsTo } from "sequelize-typescript";
import PullRequest from "./pull_request";

@Table({
  timestamps: true,
  tableName: 'pull_request_diffs',
  underscored: true,
})
export default class PullRequestDiff extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare pull_request_id: string;

  @AllowNull(false)
  @Column({ type: DataType.TEXT })
  declare head_commit_sha: string;

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  declare raw_diff: string;

  @BelongsTo(() => PullRequest, { foreignKey: 'pullRequestId', constraints: false })
  declare pull_request: PullRequest;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}