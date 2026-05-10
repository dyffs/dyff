import { Table, Column, Model, DataType, AllowNull, AutoIncrement, PrimaryKey, Index, UpdatedAt, CreatedAt, BelongsTo } from "sequelize-typescript";
import type { GithubCommentSync } from "@/module/comment/types";
import PullRequest from "./pull_request";
import CommentModel from "./comment";
import Team from "./team";
import User from "./user";

@Table({
  timestamps: true,
  tableName: 'github_comment_syncs',
  underscored: true,
  indexes: [
    // Supports the per-(PR, kind) MAX(github_updated_at) watermark query
    // used by fetch_github_comments to drive the GitHub `since` parameter.
    { fields: ['pull_request_id', 'comment_kind', 'github_updated_at'] },
  ],
})
export default class GithubCommentSyncModel extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare initiator_id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare initiator_team_id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare pull_request_id: string;

  @AllowNull(false)
  @Column({ type: DataType.TEXT })
  declare github_user_name: string;

  // Null for outbound (pending_push) records until the comment is pushed to GitHub
  @Column({ type: DataType.TEXT })
  @Index
  declare github_comment_id: string | null;

  @Column({ type: DataType.TEXT })
  declare github_thread_id: string | null;

  // Distinguishes which GitHub endpoint produced/should consume this row:
  //   'review_comment' → /pulls/:n/comments  (inline diff comments)
  //   'issue_comment'  → /issues/:n/comments (general PR comments)
  // Required so the watermark used for `since` is computed per-endpoint.
  @AllowNull(false)
  @Column({ type: DataType.TEXT })
  declare comment_kind: GithubCommentSync['comment_kind'];

  @AllowNull(false)
  @Column({ type: DataType.JSONB })
  declare content: GithubCommentSync['content'];

  @AllowNull(false)
  @Column({ type: DataType.JSONB, defaultValue: {} })
  declare attachments: GithubCommentSync['attachments'];

  @Column({ type: DataType.JSONB })
  declare code_anchor: GithubCommentSync['code_anchor'];

  @AllowNull(false)
  @Column({ type: DataType.TEXT, defaultValue: 'pending_pull' })
  declare sync_state: GithubCommentSync['sync_state'];

  @Column({ type: DataType.TEXT })
  declare sync_error: string | null;

  @Column({ type: DataType.DATE })
  declare last_synced_at: Date;

  // GitHub-side timestamps (distinct from Sequelize's created_at/updated_at,
  // which track when the local sync row itself was written). Null for
  // outbound (pending_push) rows that have not yet been pushed to GitHub.
  @Column({ type: DataType.DATE })
  declare github_created_at: Date | null;

  @Column({ type: DataType.DATE })
  declare github_updated_at: Date | null;

  // FK to comments table — set after the sync record is written to comments
  @Column({ type: DataType.BIGINT })
  declare comment_id: string | null;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;

  @BelongsTo(() => PullRequest, { foreignKey: 'pullRequestId', constraints: false })
  declare pull_request: PullRequest;

  @BelongsTo(() => CommentModel, { foreignKey: 'commentId', constraints: false })
  declare comment: CommentModel;

  @BelongsTo(() => Team, { foreignKey: 'initiatorTeamId', constraints: false })
  declare initiator_team: Team;

  @BelongsTo(() => User, { foreignKey: 'initiatorId', constraints: false })
  declare initiator: User;
}
