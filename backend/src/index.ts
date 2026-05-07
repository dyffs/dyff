import process from 'node:process'
import { createServer } from 'http'
import express from 'express'
import cors from 'cors'
import compression from 'compression'
import 'dotenv/config'
import { logger } from './service/logger'
import '@/config/passport'
import '@/service/github_credential_service'
import authController from '@/controller/auth_controller'
import { isSaaS, isSelfHosted, getDeploymentMode } from './service/deployment'

if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_APP_PRIVATE_KEY) {
  logger.warn('GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY not set. GitHub App auth will not work. PAT only.')
}

import { authMiddleware } from './middleware/auth'
import passport from 'passport'

import repositoryController from './controller/repository_controller'
import pullRequestController from './controller/pull_request_controller'
import fileReviewController from './controller/file_review_controller'
import publicController from './controller/public_controller'
import assetController from './controller/asset_controller'
import reviewController from './controller/review_controller'
import userController from './controller/user_controller'
import chatSessionController from './controller/chat_session_controller'
import commentController from './controller/comment_controller'
import aiReviewController from './controller/ai_review_controller'
import jobController from './controller/job_controller'
import llmController from './controller/llm_controller'
import passwordAuthController from './controller/password_auth_controller'
import githubSetupController from './controller/github_setup_controller'
import { githubAppAuthRouter, githubAppWebhookRouter } from './controller/github_app_controller'

import { sync, getDb } from './database/db'
import { runStartupInit } from './service/startup'

const app = express()

app.use(compression())

// CORS middleware - must be first
app.use(cors({
  origin: ['http://localhost:5173', 'http://100.116.33.14:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}))

// Other middleware
app.use(express.json({
  limit: '20mb',
  verify: (req, res, buf) => {
    (req as any).rawBody = buf
  }
}))
app.use(express.urlencoded({
  extended: true,
  verify: (req, res, buf) => {
    (req as any).rawBody = buf
  }
}))
logger.info(`Starting in deployment mode: ${getDeploymentMode()}`)

app.use('/api/public', publicController)

// Webhook route runs before auth middleware; it verifies via HMAC signature.
if (isSaaS()) {
  app.use('/api/webhooks/github', githubAppWebhookRouter)
}

if (isSaaS()) {
  app.use(passport.initialize())
  app.use('/api/auth', authController)

  // GitHub App install flow (`/install` authenticates via ?token=).
  app.use('/api/auth/github', githubAppAuthRouter)
}

if (isSelfHosted()) {
  app.use('/api/auth', passwordAuthController)
}

app.use(authMiddleware)

// Basic ping route
app.get('/ping', (req, res) => {
  res.send('pong')
})

app.use('/api/github-setup', githubSetupController)
app.use('/api/repositories', repositoryController)
app.use('/api/pull_requests', pullRequestController)
app.use('/api/file_reviews', fileReviewController)
app.use('/api/assets', assetController)
app.use('/api/reviews', reviewController)
app.use('/api/users', userController)
app.use('/api/chat_sessions', chatSessionController)
app.use('/api/comments', commentController)
app.use('/api/ai_reviews', aiReviewController)
app.use('/api/jobs', jobController)
app.use('/api/llms', llmController)

// Routes
// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

const PORT = 3003

const server = createServer(app)

server.listen(PORT, '0.0.0.0', async () => {
  try {
    // sync()
    getDb()
    if (isSelfHosted()) {
      await runStartupInit()
    }
    logger.info(`Server listening on port ${PORT}`)
  } catch (error) {
    logger.error('Failed to start server:', error)
  }
})

process.on('SIGINT', () => {
  logger.info('SIGINT signal received')
  process.exit(0)
})


