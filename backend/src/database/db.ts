import { Sequelize } from "sequelize-typescript";
import User from "./user";
import Team from "./team";
import Repository from "./repository";
import RepositoryTracking from "./repository_tracking";
import GithubCredential from "./github_credential";
import PullRequest from "./pull_request";
import PullRequestDiff from "./pull_request_diff";
import FileReview from "./file_review";
import PGCache from "./pg_cache";
import ChatSessionModel from "./chat_session";
import CommentModel from "./comment";
import GithubCommentSyncModel from "./github_comment_sync";
import JobModel from "./job";
import JobLogModel from "./job_log";
import LlmCredential from "./llm_credential";
import { logger, dbLogger } from "@/service/logger";

const db = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  logging: (msg) => dbLogger.debug(msg),
  models: [
    User,
    Team,
    Repository,
    RepositoryTracking,
    GithubCredential,
    PullRequest,
    PullRequestDiff,
    FileReview,
    PGCache,
    ChatSessionModel,
    CommentModel,
    GithubCommentSyncModel,
    JobModel,
    JobLogModel,
    LlmCredential,
  ],
});

logger.info('Database connected')

async function sync() {
  logger.info('Syncing database...')
  await db.sync({ alter: true });
}

function getDb() {
  return db
}

function closeDb() {
  db.close()
}

export { sync, getDb, closeDb }
