import { Table, Column, Model, DataType, AllowNull, AutoIncrement, PrimaryKey, Index, UpdatedAt, CreatedAt, BelongsTo, DeletedAt } from "sequelize-typescript";
import Repository from "./repository";
import User from "./user";
import { StoredReview, StoredTimelineEvent } from "@/types";

@Table({
  timestamps: true,
  tableName: 'pull_requests',
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['repository_id', 'github_pr_number']
    }
  ]
})
export default class PullRequest extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare repository_id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare author_id: string;

  @AllowNull(false)
  @Column({
    type: DataType.BIGINT,
  })
  declare github_pr_id: number;

  @AllowNull(false)
  @Column({
    type: DataType.INTEGER,
  })
  declare github_pr_number: number;

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  declare github_url: string;

  // TODO: add proper jsonb index to find PR by reviewers
  @AllowNull(false)
  @Column({
    type: DataType.JSONB,
  })
  declare reviewers: {
    github_usernames: string[];
  };

  @Column({
    type: DataType.JSONB,
  })
  declare review_rounds: {
    reviews: StoredReview[]
  }

  @Column({
    type: DataType.JSONB,
  })
  declare timeline: {
    events: StoredTimelineEvent[]
  }

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  declare title: string;

  @Column({
    type: DataType.TEXT,
  })
  declare description: string | null;

  @Column({
    type: DataType.TEXT,
  })
  declare html_description: string | null;

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  declare github_status: "open" | "closed" | "merged";

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  declare base_branch: string;

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  declare head_branch: string;

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  declare head_commit_sha: string;

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  declare fastpr_status: 'skipped' | 'tracked'

  @AllowNull(false)
  @Column({
    type: DataType.DATE,
  })
  declare github_created_at: Date;

  @AllowNull(false)
  @Column({
    type: DataType.DATE,
  })
  declare github_updated_at: Date;

  @Column({
    type: DataType.DATE,
  })
  declare github_merged_at: Date | null;

  @AllowNull(false)
  @Column({
    type: DataType.JSONB,
  })
  declare meta: {
    draft: boolean
  }

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
  })
  declare up_to_date: boolean;

  @BelongsTo(() => Repository, { foreignKey: 'repositoryId', constraints: false })
  declare repository: Repository;

  @BelongsTo(() => User, { foreignKey: 'authorId', constraints: false })
  declare user: User;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
