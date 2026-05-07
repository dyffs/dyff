import { Table, Column, Model, DataType, AllowNull, AutoIncrement, PrimaryKey, Index, UpdatedAt, CreatedAt, BelongsTo, HasMany } from "sequelize-typescript";
import PullRequest from "./pull_request";
import User from "./user";
import DraftComment from "./draft_comment";

@Table({
  timestamps: true,
  tableName: 'draft_reviews',
  underscored: true,
})
export default class DraftReview extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare user_id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare pull_request_id: string;

  @AllowNull(false)
  @Column({
    type: DataType.ENUM('COMMENT', 'APPROVE', 'REQUEST_CHANGES'),
    defaultValue: 'COMMENT'
  })
  declare event: 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES';

  @Column({ type: DataType.TEXT })
  declare body: string | null;

  @AllowNull(false)
  @Column({
    type: DataType.ENUM('draft', 'submitting', 'submitted', 'failed'),
    defaultValue: 'draft'
  })
  @Index
  declare status: 'draft' | 'submitting' | 'submitted' | 'failed';

  @AllowNull(false)
  @Column({ type: DataType.STRING })
  declare commit_sha: string;

  @Column({ type: DataType.BIGINT })
  declare github_review_id: string | null;

  @BelongsTo(() => User, { foreignKey: 'userId', constraints: false })
  declare user: User;

  @BelongsTo(() => PullRequest, { foreignKey: 'pullRequestId', constraints: false })
  declare pull_request: PullRequest;

  @HasMany(() => DraftComment, { foreignKey: 'draftReviewId' })
  declare draft_comments: DraftComment[];

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
