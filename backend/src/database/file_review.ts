import { Table, Column, Model, DataType, AllowNull, AutoIncrement, PrimaryKey, Index, UpdatedAt, CreatedAt, BelongsTo, DeletedAt } from "sequelize-typescript";
import Team from "./team";
import User from "./user";
import PullRequest from "./pull_request";

@Table({
  timestamps: true,
  tableName: 'file_reviews',
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'pull_request_id']
    }
  ]
})
export default class FileReview extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare id: string;

  @Column({ type: DataType.BIGINT })
  @Index
  declare team_id: string;

  @Column({ type: DataType.BIGINT })
  @Index
  declare user_id: string;

  @Column({ type: DataType.BIGINT })
  @Index
  declare pull_request_id: string;

  @AllowNull(false)
  @Column({
    type: DataType.JSONB,
  })
  declare review_data: {
    [file_path: string]: {
      content_hash: string;
    }
  }

  @Column({
    type: DataType.JSONB,
  })
  declare notes: {
    text_note?: object
    bookmarks?: object[]
  }

  @BelongsTo(() => Team, { foreignKey: 'teamId', constraints: false })
  declare team: Team;

  @BelongsTo(() => User, { foreignKey: 'userId', constraints: false })
  declare user: User;

  @BelongsTo(() => PullRequest, { foreignKey: 'pullRequestId', constraints: false })
  declare pull_request: PullRequest;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
