import { Table, Column, Model, DataType, AllowNull, AutoIncrement, PrimaryKey, UpdatedAt, CreatedAt, Unique } from "sequelize-typescript";

@Table({
  timestamps: true,
  tableName: 'pg_cache',
  underscored: true,
})
export default class PGCache extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare id: string;

  @AllowNull(false)
  @Unique
  @Column({ type: DataType.TEXT })
  declare key: string;

  @AllowNull(false)
  @Column({ type: DataType.JSONB })
  declare data: object;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
