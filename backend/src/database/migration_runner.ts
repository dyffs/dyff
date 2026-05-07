import { QueryTypes, QueryInterface, Transaction } from 'sequelize'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { getDb } from './db'
import { logger } from '@/service/logger'

const MIGRATIONS_DIR = join(__dirname, 'migrations')

export interface Migration {
  up: (queryInterface: QueryInterface, transaction: Transaction) => Promise<void>
  down?: (queryInterface: QueryInterface, transaction: Transaction) => Promise<void>
}

async function ensureMigrationsTable(): Promise<void> {
  await getDb().query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

function listMigrationFiles(): string[] {
  if (!existsSync(MIGRATIONS_DIR)) return []
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.d.ts'))
    .sort()
}

async function listAppliedMigrations(): Promise<Set<string>> {
  const rows = await getDb().query<{ name: string }>(
    'SELECT name FROM schema_migrations',
    { type: QueryTypes.SELECT }
  )
  return new Set(rows.map((r) => r.name))
}

export async function runPendingMigrations(): Promise<void> {
  await ensureMigrationsTable()
  const applied = await listAppliedMigrations()
  const files = listMigrationFiles()
  const pending = files.filter((f) => !applied.has(f))

  if (pending.length === 0) {
    logger.info('No pending migrations')
    return
  }

  logger.info(`Applying ${pending.length} migration(s)`)
  const db = getDb()
  const qi = db.getQueryInterface()

  for (const file of pending) {
    const filePath = join(MIGRATIONS_DIR, file)
    const mod: Migration = await import(filePath)
    logger.info(`Running migration: ${file}`)
    await db.transaction(async (t) => {
      await mod.up(qi, t)
      await db.query(
        'INSERT INTO schema_migrations (name) VALUES ($1)',
        { bind: [file], transaction: t }
      )
    })
    logger.info(`Migration applied: ${file}`)
  }
}

export async function markAllMigrationsApplied(): Promise<void> {
  await ensureMigrationsTable()
  const files = listMigrationFiles()
  if (files.length === 0) return

  const db = getDb()
  for (const file of files) {
    await db.query(
      'INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING',
      { bind: [file] }
    )
  }
  logger.info(`Marked ${files.length} migration(s) as baseline-applied`)
}
