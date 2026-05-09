# Dyff
Open-source AI-powered code review product

## Backend (`dyff/backend/`)

### Tech Stack
- **Runtime:** Bun (TypeScript 5.7 executed natively)
- **Framework:** Express.js (REST API)
- **Database:** PostgreSQL with Sequelize ORM (sequelize-typescript)
- **Job Queue:** BullMQ backed by Redis
- **Authentication:** JWT, Passport.js, GitHub OAuth (SaaS mode), email/password (self-hosted mode)
- **Git:** simple-git for local repository management
- **GitHub API:** Octokit (@octokit/rest, @octokit/app)
- **AI:** Vercel AI SDK (`ai`), @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google, @ai-sdk/xai, @ai-sdk/openai-compatible
- **Logging:** Winston
- **Testing:** Vitest
- **Other:** compression, cors, luxon, axios, bcryptjs, uuid

### Directory Structure
```
src/
├── config/                # Passport GitHub OAuth config
├── controller/            # API route handlers (16 controllers)
├── database/              # Sequelize models, migrations, db init
├── middleware/            # JWT auth middleware
├── module/                # Feature modules
│   ├── ai_agent/          # AI agent loop, session store (PostgreSQL-backed), token tracker
│   ├── ai_comment/        # AI-generated comments
│   ├── comment/           # Comment sync (GitHub ↔ Dyff)
│   ├── context_pruner/    # Context window management
│   ├── jobs/              # BullMQ job queue, worker, source handlers
│   ├── llms/              # LLM provider registry, API key encryption, AI SDK client
│   ├── message_processor/ # Enrich message with context for AI
│   ├── orchestrator/      # Workflow orchestration / factory
│   ├── tools/             # Agent tools
│   └── workflow/          # Review, overview, chat-turn workflows
├── serializer/            # Response serializers (PR, repo, comment, chat session, job, draft review)
├── service/               # Business logic layer
│   ├── github.ts              # GitHub API client
│   ├── git.ts                 # Local git operations
│   ├── git_diff.ts            # Diff computation
│   ├── git_read_files.ts      # File reading at commits
│   ├── git_search.ts          # Code search
│   ├── permission_service.ts  # Access control via repository_trackings
│   ├── requestContext.ts      # AsyncLocalStorage for user context
│   ├── cache_service.ts       # PostgreSQL-backed cache
│   ├── deployment.ts          # SaaS vs self-hosted mode detection
│   ├── github_installation.ts # GitHub App installation handling
│   ├── github_credential_service.ts # Credential management
│   └── ...
├── index.ts              # Main server entry (port 3003, HTTP + Express)
├── job_worker.ts         # Separate worker process (BullMQ consumer)
└── types.ts              # TypeScript definitions
```

### Deployment Modes
- **SaaS:** GitHub OAuth (passport-github2), GitHub App with webhooks, GitHub App install flow
- **Self-Hosted:** Email/password auth (bcryptjs), startup init script

### Database Models
- **teams** — Organizations/workspaces
- **users** — Users with team association (supports unregistered users)
- **repositories** — Tracked GitHub repositories with local storage paths
- **repository_trackings** — Permission cache (user/team → repository)
- **github_credentials** — GitHub PAT, GitHub App, or GitHub OAuth credentials (kind: oauth_user/installation/pat)
- **pull_requests** — PR metadata with github_status, dyff_status, up_to_date flag, JSONB columns (review_rounds, timeline)
- **pull_request_diffs** — Cached diffs keyed by commit SHA
- **file_reviews** — File-level review status tracking
- **comments** — Individual comments with code anchors and source IDs
- **github_comments** — GitHub-sourced comments
- **github_comment_sync** — Sync state tracking between GitHub and Dyff
- **draft_reviews** / **draft_comments** — In-progress reviews
- **chat_sessions** — AI chat session state
- **jobs** / **job_logs** — Background job state and logs (BullMQ)
- **llm_credentials** — Encrypted LLM API keys (AES, user/team scoped)
- **pg_cache** — PostgreSQL generic cache table

### API Routes
**Auth (no auth middleware):**
- `POST /api/auth/*` — GitHub OAuth flow (SaaS) or email/password login (self-hosted)
- `POST /api/webhooks/github` — GitHub App webhook receiver (SaaS, HMAC-verified)

**Protected (JWT Bearer token, 180 day expiry):**
- `/api/repositories` — CRUD, clone, content, tracked listings
- `/api/pull_requests` — List PRs, get diff, get details
- `/api/file_reviews` — File review status
- `/api/comments` — Comment CRUD and sync
- `/api/chat_sessions` — AI chat session management
- `/api/reviews` — AI review generation
- `/api/ai_reviews` — AI review CRUD
- `/api/jobs` — Background job status/monitoring
- `/api/llms` — LLM credential management
- `/api/users` — User management
- `/api/assets` — Asset management
- `/api/github-setup` — GitHub PAT and App configuration

### Architecture Patterns
- **Request Context:** AsyncLocalStorage provides current user without prop drilling
- **Permission Cache:** repository_trackings table avoids repeated GitHub API calls
- **Dual Auth:** Unified Octokit client abstracts PAT vs GitHub App differences
- **Auto User Creation:** Unregistered users created from GitHub activity
- **Local Repo:** Repositories cloned to local disk for fast file access
- **Job Queue:** BullMQ + Redis for async workflows (AI overview, review, chat-turn)
- **Separate Worker Process:** `job_worker.ts` runs as an independent BullMQ consumer
- **LLM Key Encryption:** API keys encrypted at rest in llm_credentials table
- **DB-backed Cache:** pg_cache table provides shared server-side caching
- **Database Migrations:** Versioned migrations in `database/migrations/` with runner

### Dev Commands
- `bun dev` — Start dev server with hot reload (`bun --watch`)
- `bun dev-worker` — Start worker process with hot reload
- `bun test` — Run Vitest tests
- `bun run build` — Compile TypeScript to dist/ (tsc + tsc-alias for path resolution)
- `bun run typecheck` — Type-check only (tsc --noEmit)
- `bun run sync-db` — Sync database schema
- Package manager / runtime: **Bun** (required)

---

## Frontend (`dyff/frontend/`)

### Tech Stack
- **Runtime:** Node.js / Bun
- **Framework:** Vue 3.5 (Composition API, `<script setup>`)
- **Routing:** vue-router 4 (HTML5 history mode)
- **Build:** Vite 7
- **Styling:** Tailwind CSS v4 (via @tailwindcss/vite plugin)
- **UI Components:** shadcn-vue (built on reka-ui), @tanstack/vue-table
- **Icons:** lucide-vue-next
- **State Management:** provide/inject pattern via @vueuse/core `createInjectionState`
- **HTTP Client:** axios
- **TypeScript:** ~5.9
- **Package Manager:** pnpm

### Key Libraries
- **@vueuse/core** — Vue composition utilities (createInjectionState)
- **shiki** — Syntax highlighting
- **@tiptap/vue-3** — Rich text editor
- **@vue-flow/core** — Visual flow / canvas
- **vue-virtual-scroller** — Virtual scrolling for large lists
- **floating-vue** — Tooltips, popovers, dropdowns
- **vue-sonner** — Toast notifications
- **marked + dompurify** — Markdown rendering with sanitization
- **idb** — IndexedDB client-side cache
- **ignore** — Gitignore pattern matching
- **tailwind-merge + class-variance-authority** — CSS class utilities
- **luxon + lodash-es** — Date utilities, general utilities

### Directory Structure
```
src/
├── components/ui/        # shadcn-vue UI primitives (auto-generated)
├── lib/                  # Shared libraries (idbCache, fzy fuzzy search)
├── modules/              # Feature modules (provide/inject state per module)
│   ├── account/          # Auth, login, user management
│   ├── agent/            # AI chat agent UI
│   ├── agent_management/ # AI agent configuration
│   ├── ai_overview/      # AI PR overview/summary
│   ├── bookmark/         # Code bookmarks
│   ├── code_review/      # Diff view, virtual scroll, context menu, text selection
│   ├── comment/          # Comment system with threads
│   ├── common/           # Shared styles and utilities
│   ├── github_setup/     # GitHub PAT and App setup UI
│   ├── job/              # Background job tracking
│   ├── llms/             # LLM provider configuration
│   ├── pull_request/     # PR listing and management
│   ├── repo/             # Repository browsing
│   ├── search/           # Code search with Web Worker
│   └── team/             # Team settings, password auth
├── utils/                # diffParser, syntaxHighlighter, fileIcons, markdown
├── App.vue               # Root component (provides all injection states)
├── main.ts               # App entry (createApp, router, floating-vue)
├── router.ts             # Route definitions
├── style.css             # Tailwind imports + global styles
└── types.ts              # Shared TypeScript types
```

### Architecture Patterns
- **Provide/Inject via @vueuse/core `createInjectionState`:** Each module defines a composable pair (`useProvideX` / `useX`). The provider is invoked in `App.vue`; any child component can inject the state via the getter. This replaces a global store (Pinia) with scoped reactive state.
- **Module Pattern:** Each feature is a folder under `src/modules/<name>/` containing a composable (`useX.ts`), a root page component, and optionally sub-components, API wrappers, and types.
- **IndexedDB Caching:** `lib/idbCache.ts` provides a typed, TTL-based cache layer backed by IndexedDB for client-side persistence (repo content, etc.).
- **Web Worker Search:** `search/repoSearch.worker.ts` offloads repository code search to a Worker thread for non-blocking UI.
- **shadcn-vue UI:** Components are auto-installed into `components/ui/` via `pnpm dlx shadcn-vue@latest add`. Visual style follows shadcn aesthetic (clean, modern).

### Dev Commands
- `pnpm dev` — Start Vite dev server
- `pnpm build` — Type-check + production build (`vue-tsc -b && vite build`)
- `pnpm run typecheck` — Type-check only (`vue-tsc -p tsconfig.app.json --noEmit`)
- `pnpm run preview` — Preview production build
- Package manager: **pnpm**
