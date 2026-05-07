import { Table, Column, Model, DataType, AllowNull, PrimaryKey, AutoIncrement, Index, UpdatedAt, CreatedAt, BelongsTo } from "sequelize-typescript";
import type { Comment } from "@/module/comment/types";
import User from "./user";
import Team from "./team";
import PullRequest from "./pull_request";
import ChatSession from "./chat_session";

@Table({
  timestamps: true,
  tableName: 'comments',
  underscored: true,
})
export default class CommentModel extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare id: string;

  @Column({ type: DataType.BIGINT })
  @Index
  declare thread_id: string | null;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare pull_request_id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare user_id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare team_id: string;

  @AllowNull(false)
  @Column({ type: DataType.TEXT })
  declare origin: Comment['origin'];

  @Column({ type: DataType.TEXT })
  declare agent_type: Comment['agent_type'];

  @Column({ type: DataType.BIGINT })
  @Index
  declare agent_chat_session_id: string;

  @AllowNull(false)
  @Column({ type: DataType.TEXT, defaultValue: 'active' })
  declare status: Comment['status'];

  @AllowNull(false)
  @Column({ type: DataType.JSONB })
  declare content: Comment['content'];

  @AllowNull(false)
  @Column({ type: DataType.JSONB, defaultValue: {} })
  declare attachments: object;

  @Column({ type: DataType.JSONB })
  declare code_anchor: Comment['code_anchor'];

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;

  @BelongsTo(() => Team, { foreignKey: 'teamId', constraints: false })
  declare team: Team;

  @BelongsTo(() => User, { foreignKey: 'userId', constraints: false })
  declare user: User;

  @BelongsTo(() => ChatSession, { foreignKey: 'agentChatSessionId', constraints: false })
  declare agent_chat_session: ChatSession;

  @BelongsTo(() => PullRequest, { foreignKey: 'pullRequestId', constraints: false })
  declare pull_request: PullRequest;
}
