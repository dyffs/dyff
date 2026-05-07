import { Table, Column, Model, DataType, AllowNull, AutoIncrement, PrimaryKey, Index, UpdatedAt, CreatedAt, BelongsTo } from "sequelize-typescript";
import PullRequest from "./pull_request";
import User from "./user";

// Deprecated: this model is only used for legacy commenting from our app
// The 2 new models are GithubCommentSync and Comment.
@Table({
  timestamps: true,
  tableName: 'github_comments',
  underscored: true,
})
export default class GithubComment extends Model {
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
  @Column({ type: DataType.BIGINT })
  @Index
  declare github_comment_id: string;

  @Column({ type: DataType.BIGINT })
  declare github_thread_id: string | null;

  @AllowNull(false)
  @Column({
    type: DataType.JSONB,
  })
  declare content: {
    body: string | null;
    diff_hunk: string | null;
    html_url: string | null;
    avatar_url: string | null;
  }

  @Column({
    type: DataType.JSONB,
  })
  declare attachments: object

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

  @BelongsTo(() => User, { foreignKey: 'userId', constraints: false })
  declare user: User;

  @BelongsTo(() => PullRequest, { foreignKey: 'pullRequestId', constraints: false })
  declare pull_request: PullRequest;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
