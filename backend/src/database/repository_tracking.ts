import { Table, Column, Model, DataType, AllowNull, AutoIncrement, PrimaryKey, Index, UpdatedAt, CreatedAt } from "sequelize-typescript";

@Table({
  timestamps: true,
  tableName: 'repository_trackings',
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['repository_id', 'tracking_type', 'tracking_id']
    },
    {
      // for quick lookup
      fields: ['tracking_type', 'tracking_id']
    }
  ]
})
export default class RepositoryTracking extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare id: string;

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  @Index
  declare repository_id: string;

  @AllowNull(false)
  @Column({ type: DataType.TEXT })
  declare tracking_type: 'user' | 'team';

  @AllowNull(false)
  @Column({ type: DataType.BIGINT })
  declare tracking_id: string;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
