import { QueryInterface, Transaction, DataTypes } from 'sequelize'

export async function up(qi: QueryInterface, t: Transaction): Promise<void> {
  await qi.sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_users_status ON users (status)`,
    { transaction: t }
  )

  // Example of adding a column (commented out — uncomment and adapt for your migration):
  // await qi.addColumn(
  //   'users',
  //   'timezone',
  //   { type: DataTypes.TEXT, allowNull: true },
  //   { transaction: t }
  // )
}

export async function down(qi: QueryInterface, t: Transaction): Promise<void> {
  await qi.sequelize.query(
    `DROP INDEX IF EXISTS idx_users_status`,
    { transaction: t }
  )

  // await qi.removeColumn('users', 'timezone', { transaction: t })
}
