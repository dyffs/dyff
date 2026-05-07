import { Table, Column, Model, DataType, AllowNull, AutoIncrement, PrimaryKey, Index, UpdatedAt, CreatedAt, BelongsTo } from "sequelize-typescript";
import PullRequest from "./pull_request";
import User from "./user";
import Team from "./team";
import Repository from "./repository";
import type { ChatSession } from "@/module/ai_agent/types";

@Table({
  timestamps: true,
  tableName: 'chat_sessions',
  underscored: true,
})
export default class ChatSessionModel extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare pull_request_id: string;

  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  @Index
  declare github_pr_number: number;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare user_id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare team_id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare repository_id: string;

  @AllowNull(false)
  @Column({ type: DataType.TEXT, defaultValue: 'idle' })
  @Index
  declare status: ChatSession['status'];

  @AllowNull(false)
  @Column({ type: DataType.JSONB })
  declare session_data: ChatSession;

  @Column({ type: DataType.JSONB })
  declare agent_review_notes: {
    notes: {
      [key: string]: string
    }
    reviewed_files: string[]
    updated_at: Date
    commit_hash: string
  }

  @BelongsTo(() => PullRequest, { foreignKey: 'pullRequestId', constraints: false })
  declare pull_request: PullRequest;

  @BelongsTo(() => User, { foreignKey: 'userId', constraints: false })
  declare user: User;

  @BelongsTo(() => Team, { foreignKey: 'teamId', constraints: false })
  declare team: Team;

  @BelongsTo(() => Repository, { foreignKey: 'repositoryId', constraints: false })
  declare repository: Repository;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
