import 'dotenv/config'
import { closeDb, sync } from '@/database/db'
import { logger } from '@/service/logger'

async function main() {
  try {
    await sync()
    logger.info('Sync DB: done')
    closeDb()
    process.exit(0)
  } catch (err) {
    logger.error('Sync DB failed:', err)
    process.exit(1)
  }
}

main()
