import 'dotenv/config'
import { runStartupInit } from '@/service/startup'
import { closeDb } from '@/database/db'
import { logger } from '@/service/logger'

async function main() {
  try {
    await runStartupInit()
    logger.info('Migrate CLI: done')
    closeDb()
    process.exit(0)
  } catch (err) {
    logger.error('Migrate CLI failed:', err)
    process.exit(1)
  }
}

main()
