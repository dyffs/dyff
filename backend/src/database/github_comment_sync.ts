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

  @AllowNull(false)
  @Column({ type: DataType.TEXT, defaultValue: 'inbound' })
  declare sync_direction: GithubCommentSync['sync_direction'];

  @Column({ type: DataType.TEXT })
  declare sync_error: string | null;

  @Column({ type: DataType.DATE })
  declare last_synced_at: Date;

  @AllowNull(false)
  @Column({ type: DataType.DATE })
  declare remote_updated_at: Date;

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
