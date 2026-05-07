import { Table, Column, Model, DataType, AllowNull, AutoIncrement, PrimaryKey, UpdatedAt, CreatedAt } from "sequelize-typescript";

@Table({
  timestamps: true,
  tableName: 'teams',
  underscored: true,
})
export default class Team extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare id: string;

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  declare display_name: string;

  @AllowNull(false)
  @Column({
    type: DataType.JSONB,
  })
  declare settings: object;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
