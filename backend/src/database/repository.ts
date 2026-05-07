import { Table, Column, Model, DataType, AllowNull, AutoIncrement, PrimaryKey, UpdatedAt, CreatedAt, Index } from "sequelize-typescript";

@Table({
  timestamps: true,
  tableName: 'repositories',
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['github_owner', 'github_repo']
    }
  ]
})
export default class Repository extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare id: string;

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  declare github_owner: string;

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  @Index
  declare github_repo: string;

  @Column({
    type: DataType.DATE,
  })
  declare last_fetched_at: Date;

  @Column({
    type: DataType.TEXT,
  })
  declare status: 'new' | 'cloning' | 'cloned'

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  declare owner_type: 'user' | 'organization'

  // Either "master" or "main"
  // The branch here is not that necessary because we use git command to fetch
  // the specific content from a specific commit but not care about current working directory.
  @Column({
    type: DataType.TEXT,
  })
  declare tracking_branch: string;

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  declare storage_path: string;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
