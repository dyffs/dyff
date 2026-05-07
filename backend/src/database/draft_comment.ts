import { Table, Column, Model, DataType, AllowNull, AutoIncrement, PrimaryKey, Index, UpdatedAt, CreatedAt, BelongsTo } from "sequelize-typescript";
import DraftReview from "./draft_review";
import PullRequest from "./pull_request";
import User from "./user";
import GithubComment from "./github_comment";

@Table({
  timestamps: true,
  tableName: 'draft_comments',
  underscored: true,
})
export default class DraftComment extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare draft_review_id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare user_id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare pull_request_id: string;

  @Column({ type: DataType.BIGINT })
  @Index
  declare reply_to_github_comment_id: string | null;

  // Cannoy reply to a draft comment because we can only create Github comments once for all comments

  @AllowNull(false)
  @Column({
    type: DataType.JSONB,
  })
  declare content: {
    body: string | null;
    diff_hunk: string | null;
  }

  @Column({
    type: DataType.JSONB,
  })
  declare code_anchor: {
    commit_sha: string;
    file_path: string;
    line_start: number;
    start_side: 'LEFT' | 'RIGHT';
    line_end: number;
    end_side: 'LEFT' | 'RIGHT';
  } | null;

  @BelongsTo(() => DraftReview, { foreignKey: 'draftReviewId', constraints: false })
  declare draft_review: DraftReview;

  @BelongsTo(() => User, { foreignKey: 'userId', constraints: false })
  declare user: User;

  @BelongsTo(() => PullRequest, { foreignKey: 'pullRequestId', constraints: false })
  declare pull_request: PullRequest;

  @BelongsTo(() => GithubComment, { foreignKey: 'replyToGithubCommentId', constraints: false })
  declare reply_to_github_comment: GithubComment;

  @BelongsTo(() => DraftComment, { foreignKey: 'replyToDraftCommentId', constraints: false })
  declare reply_to_draft_comment: DraftComment;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
