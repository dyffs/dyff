import { QueryTypes } from 'sequelize'
import bcrypt from 'bcryptjs'
import { getDb, sync } from '@/database/db'
import {
  runPendingMigrations,
  markAllMigrationsApplied,
} from '@/database/migration_runner'
import Team from '@/database/team'
import User from '@/database/user'
import { logger } from './logger'

async function isSchemaEmpty(): Promise<boolean> {
  const rows = await getDb().query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'teams'
     ) AS "exists"`,
    { type: QueryTypes.SELECT }
  )
  return !rows[0]?.exists
}

async function seedFirstAdmin(): Promise<void> {
  const email = 'admin@dyff.local'
  const password = '12345'

  const existing = await User.findOne({ where: { email } })
  if (existing) {
    logger.info(`Admin user already exists, skipping seed: ${email}`)
    return
  }

  const team = await Team.create({
    display_name: 'Default',
    settings: {},
  })

  const password_hash = await bcrypt.hash(password, 10)

  await User.create({
    email,
    display_name: 'Admin',
    role: 'admin',
    status: 'registered',
    settings: {},
    is_bot: false,
    team_id: team.id,
    password_hash,
  })

  logger.info(`Seeded first admin user: ${email} (password: ${password})`)
}

export async function runStartupInit(): Promise<void> {
  if (await isSchemaEmpty()) {
    logger.info('Empty database detected — bootstrapping schema via sync()')
    await sync()
    await markAllMigrationsApplied()
    await seedFirstAdmin()
    return
  }

  logger.info('Existing schema detected — running pending migrations')
  await runPendingMigrations()
}
