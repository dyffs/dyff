# Dyff Backend

Enhanced PR review tool with advanced collaboration features beyond standard GitHub PRs.

## Overview
Dyff aggregates comments from multiple sources (GitHub, Slack, in-app), provides code search and navigation, and offers Trello-style PR management boards. Supports both personal (PAT) and organizational (GitHub App) workflows.

## Key Features
- **Multi-source commenting:** Aggregate comments from GitHub, Slack, and in-app
- **Code search & navigation:** Browse repository content at specific commits
- **Visual canvas:** Code flow discussions (planned)
- **PR management boards:** Trello-style organization (planned)
- **Dual GitHub integration:** Personal Access Token OR GitHub App
- **Local git operations:** Clone and read repos via nodegit
- **Permission caching:** Fast access checks via repository_trackings table

## Tech Stack
- **Runtime:** Bun (TypeScript 5.7 executed natively)
- **Framework:** Express.js (REST API)
- **Database:** PostgreSQL with Sequelize ORM (sequelize-typescript)
- **Authentication:** JWT, Passport.js, Google OAuth
- **Git:** simple-git for local repository management
- **GitHub API:** Octokit (@octokit/rest, @octokit/app)
- **Logging:** Winston

## Directory Structure
```
src/
├── controller/       # API route handlers
├── database/         # Sequelize models & schema
├── middleware/       # Auth middleware (JWT)
├── service/          # Business logic layer
│   ├── github.ts         # GitHub API client
│   ├── git.ts            # Local git operations
│   ├── permission_service.ts  # Access control
│   └── requestContext.ts # AsyncLocalStorage for user context
├── index.ts          # Main entry point (port 3003)
└── types.ts          # TypeScript definitions

docs/
├── github_integration.md  # Dual auth strategy
├── testing.md             # Manual API test examples
└── (dbdiagram in src/database/dbdiagram.dbml)
```

## Dev Commands
- `bun dev` - Start dev server with hot reload (`bun --watch`)
- `bun run build` - Compile TypeScript to dist/ with path aliases
- `bun install` - Install dependencies
- Package manager / runtime: **Bun** (required)

## Core Database Models
- **teams** - Organizations/workspaces
- **users** - Users with team association (supports unregistered users)
- **repositories** - Tracked GitHub repositories with local storage paths
- **repository_trackings** - Permission cache (user/team → repository)
- **pull_requests** - PR metadata with github_status, dyff_status, up_to_date flag, and JSONB columns:
- **pull_request_diffs** - Cached diffs keyed by commit SHA
- **comment_threads** - Grouped comments with source tracking (dyff/github/slack)
- **comments** - Individual comments with code anchors and source IDs
- **github_credentials** - GitHub PAT or App credentials (owner_type: user/org/pat)
- **file_reviews** - File-level review status tracking

## API Routes
**Public (no auth):**
- `POST /api/public/create_account` - Create account (returns JWT)

**Repositories (requires auth):**
- `POST /api/repositories/personal_access_token` - Store GitHub PAT
- `GET /api/repositories/` - List accessible repositories from GitHub
- `POST /api/repositories/track` - Track repositories
- `GET /api/repositories/:owner/:repo/details` - Fetch repo details from GitHub, update database, return serialized repo (5min cache)
- `POST /api/repositories/:owner/:repo/clone` - Trigger async repository cloning (returns status, poll /details for completion)
- `GET /api/repositories/:owner/:repo/content?commitSha=xxx` - Get repo content
- `GET /api/repositories/tracked-repositories` - List tracked repositories

**Pull Requests (requires auth):**
- `GET /api/pull_requests/:owner/:repo` - List PRs with up_to_date status (5min cache)
- `GET /api/pull_requests/:id/diff` - Get PR diff (cached by commit SHA)
- `GET /api/pull_requests/:id/details` - Fetch PR reviews and timeline, store in review_rounds and timeline columns, mark up_to_date=true

**Authentication:** JWT Bearer tokens in Authorization header (180 day expiry)

## GitHub Integration Strategy
Supports **two authentication modes** for flexibility:

1. **Personal Access Token (PAT):** For individual users, no webhooks (polling only)
2. **GitHub App:** For organizations, supports webhooks and installation-based auth

Both stored in `github_credentials` with polymorphic `owner_type` field.
See: docs/github_integration.md

## Architecture Patterns
- **Request Context:** AsyncLocalStorage provides current user without prop drilling
- **Permission Cache:** repository_trackings table avoids repeated GitHub API calls
- **Dual Auth:** Unified Octokit client abstracts PAT vs GitHub App differences
- **Auto User Creation:** Unregistered users created from GitHub activity
- **Local Repo**: a copy of the repo is stored in local disk for faster access


## Documentation
- GitHub integration strategy: docs/github_integration.md
- API testing examples: docs/testing.md

## Current Status
**Implemented:**
- Account creation & JWT auth
- GitHub PAT and App support
- Repository tracking with permissions
- PR fetching with up_to_date tracking
- PR details (reviews & timeline) with smart caching
- Diff retrieval (cached by commit SHA)
- Repository content at specific commits

## PR Workflow
1. **List PRs** (`GET /:owner/:repo`) - Syncs basic PR data from GitHub, sets `up_to_date: false` for new/updated PRs
2. **Fetch Details** (`GET /:id/details`) - Fetches reviews & timeline events, stores in `review_rounds` and `timeline` JSONB columns, sets `up_to_date: true`
3. Subsequent detail requests return cached data if `up_to_date: true`
