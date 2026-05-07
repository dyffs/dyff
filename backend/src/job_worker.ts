import 'dotenv/config'
import { getDb } from '@/database/db'

import { registerSource } from '@/module/jobs/source_registry'
import { OverviewWorkflow } from '@/module/workflow/overview_workflow'
import { ReviewWorkflow } from '@/module/workflow/review_workflow'
import { ChatTurnWorkflow } from '@/module/workflow/chat_turn_workflow'
import { initWorker } from '@/module/jobs/job_queue_service'
import { logger } from './service/logger'

registerSource('overview_workflow', OverviewWorkflow)
registerSource('review_workflow', ReviewWorkflow)
registerSource('chat_turn_workflow', ChatTurnWorkflow)

getDb()
initWorker()

logger.info('Job worker process started')

process.on('SIGINT', () => {
  logger.info('SIGINT signal received')
  process.exit(0)
})
