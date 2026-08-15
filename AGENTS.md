# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Project

Planner is a task manager with a paper-journal aesthetic (warm cream, Lora serif, dotted grid). Two independent npm packages: `api/` (Express + PostgreSQL + Redis) and `app/` (React + Vite). Real-time sync via Socket.IO backed by Redis Pub/Sub. Auth uses JWT (7-day expiry) with DB-side session revocation.

## Multi-Agent Instruction Synchronization Rule

Whenever updating AI agent instructions, conventions, or specs workflows, you MUST synchronize and apply the changes across all agent files: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md`.

## Andrej Karpathy Engineering Principles

When starting development, apply Karpathy core engineering principles:
- **First-Principles Reasoning**: Understand root requirements and underlying systems before writing code.
- **Extreme Simplicity**: Build the simplest working solution; avoid premature abstractions and unneeded complexity.
- **Clean & Readable**: Write clear, self-explanatory code with zero fluff.
- **Deep Understanding**: Inspect exact definitions and trace dataflows before modifying existing logic.

## Direct Task Worktree Prompting

If a user requests a coding task directly (without an existing spec or running `/plan`), the agent MUST ask whether the user wants to create a Git worktree, branch, or isolated development environment before writing code, so implementation can be tested safely.

## Quickstart

```bash
cp .env.example .env          # fill POSTGRES_PASSWORD, CORS_ORIGIN
docker compose up -d          # installs deps, runs migrations, starts api (4000) + app (5173)
bash .hooks/setup-hooks.sh    # one-time: points git at versioned hooks in .hooks/
```

Required `.env` vars: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `CORS_ORIGIN`.

### Git Hooks

`core.hooksPath` is local git config and does not carry over automatically on fresh clones or new worktrees. Run `bash .hooks/setup-hooks.sh` before your first commit:

```bash
git config --get core.hooksPath   # expect ".hooks" - if empty, run setup script
bash .hooks/setup-hooks.sh
```

### Dev hosts (Traefik on the `proxy` network)

Add to `/etc/hosts`: `planner.local`, `api.planner.local`, `db.planner.local`, `coverage.planner.local`.

- `https://planner.local` - app (also serves `/api` and `/socket.io`)
- `https://api.planner.local` - API directly (e.g. `/api/v1/...`)
- `https://db.planner.local` - pgAdmin (desktop mode, DB password `planner`)
- `https://coverage.planner.local` - Vitest HTML report & E2E coverage (writes to `app/coverage-reports`, served via static nginx container)

## Commands

| Command | What it does |
| --- | --- |
| `docker compose up -d` | Start api (4000) + app (5173) + Postgres + Redis |
| `docker compose exec api npm run build` | Build API |
| `docker compose exec app npm run build` | Build app |
| `docker compose exec api npm run lint` | Lint API |
| `docker compose exec app npm run lint` | Lint app |
| `docker compose exec api npm test && docker compose exec app npm test` | All tests (Vitest) |
| `docker compose exec api npm test` | API tests only |
| `docker compose exec app npm test` | App tests only |
| `docker compose exec api npm exec vitest run src/path/to/file.test.ts` | Single API test file |
| `docker compose exec app npm run test:e2e` | Playwright E2E tests |

## Architecture

### Mutation data flow

1. Frontend calls REST via `app/src/api/client.ts`
2. API handler → service → PostgreSQL → `publishEvent()` in `syncService.ts`
3. `publishEvent()` publishes to Redis Pub/Sub
4. Redis adapter fans out Socket.IO `"sync"` event to `user:{userId}` and `project:{projectId}` rooms
5. Frontend `useSync` hook receives event → invalidates React Query cache or patches Zustand store

### Backend (`api/src/`)

- `index.ts` - Express + Socket.IO on same HTTP server; Socket.IO validates JWT on connect
- `middleware/auth.ts` - validates Bearer JWT **and** checks DB session (sessions are revocable)
- `middleware/errorHandler.ts` - `AppError` vs generic; returns `{ error: { code, message, details? } }`
- `services/syncService.ts` - `publishEvent(event)` is the single broadcast entry point
- `services/authService.ts` - register/login (Redis rate-limit: 10 attempts/15 min), 7-day JWT
- `services/emailService.ts` - Resend wrapper; logs reset links to console when `RESEND_API_KEY` is unset
- `services/taskService.ts` - CRUD, completion, recurrence
- `services/viewService.ts` - today/upcoming/inbox aggregations
- `services/filterService.ts` - saved filter CRUD + evaluation via Peggy DSL parser
- `services/collectionService.ts` - collection (project) CRUD
- `services/habitService.ts` - habit tracking, completions, streaks
- `services/preferencesService.ts` - user preferences (font, theme, etc.)
- `services/labelService.ts` - label CRUD
- `services/sectionService.ts` - section CRUD
- `services/commentService.ts` - comment CRUD
- `services/reminderService.ts` - reminder CRUD
- `services/searchService.ts` - full-text search
- `services/activityService.ts` - activity feed
- `services/collaborationService.ts` - project collaboration
- `db/pool.ts` - PostgreSQL pool (max 20); `db/redis.ts` - three clients (general, pub, sub)
- `parsers/` - Peggy-based filter DSL and date parsers
- `engines/recurrenceEngine.ts` - daily/weekly/monthly/yearly recurrence
- `routes/index.ts` - Aggregates all routes under `/api/v1/`

All routes under `/api/v1/`. Route files: `auth`, `tasks`, `collections`, `labels`, `sections`, `views`, `filters`, `search`, `reminders`, `comments`, `preferences`, `activity`, `collaboration`, `habits`, `habitGroups`.

### Frontend (`app/src/`)

- `contexts/AuthContext.tsx` - auth source of truth; manages socket connect/disconnect lifecycle
- `utils/socket.ts` - Socket.IO singleton; token passed via `socket.auth`; stored as `planner_token` in localStorage
- `hooks/useSync.ts` - subscribes to `"sync"` events; handler receives `SyncEvent`
- `hooks/shortcuts.ts` - pure chord-aware keyboard matcher; `DEFAULT_BINDINGS` for `q /  ? Enter Delete Escape g+i g+t g+u`
- `hooks/usePreferences.ts` - User preferences hook
- `api/client.ts` - Fetch wrapper; base `/api/v1`; auto-logout on 401
- `api/queryClient.ts` - React Query config (staleTime 60s, 1 retry)
- `stores/taskStore.ts` - Zustand store; `setTasks / addTask / updateTask / removeTask`
- `stores/collectionStore.ts` - Zustand store for collections
- `stores/authStore.ts` - Zustand store for auth state
- `stores/optimistic.ts` - optimistic helpers: `runOptimistic`, `applyOptimistic`, `revertOptimistic` (2s auto-revert)

### Pages & Routes

| Route | Page | Purpose |
| --- | --- | --- |
| `/today` (default) | `TodayPage` | Overdue + today sections |
| `/inbox` | `InboxPage` | Unprocessed tasks; also `/collection/:id` |
| `/upcoming` | `UpcomingPage` | 7-day preview |
| `/monthly` | `MonthlyPage` | Monthly calendar |
| `/habits` | `HabitsPage` | Habit streaks (12-week grid) |
| `/collections` | `CollectionsPage` | Collection/project management |
| `/settings` | `SettingsPage` | Font, theme, preferences |
| `/styleguide` | `StyleguidePage` | Design system reference |

`AppShell` wraps all logged-in routes: sidebar, keyboard dispatch, QuickAdd/Search dialogs.

Logged-out routes sit outside `AppShell` and share `components/AuthShell.tsx`: `/login`, `/register`, `/forgot-password`, `/reset-password?token=`. `/auth/register` creates no session - `AuthContext.register()` chains into `login()`.

## Key Files

```
api/src/index.ts                     Express + Socket.IO server entry
api/src/middleware/auth.ts           JWT + session validation
api/src/services/syncService.ts      publishEvent() - real-time broadcast
api/src/services/taskService.ts      Task CRUD + recurrence
api/src/db/pool.ts                   PostgreSQL pool
api/src/db/redis.ts                  Redis clients (pub/sub)
api/src/db/migrations/               SQL migration files (001–025)
api/src/parsers/filterParser.ts      Peggy filter DSL parser
api/src/engines/recurrenceEngine.ts  Recurrence rule engine
api/src/utils/AppError.ts             Custom error class

app/src/contexts/AuthContext.tsx     Auth state + socket lifecycle
app/src/api/client.ts                REST Fetch wrapper
app/src/utils/socket.ts              Socket.IO singleton
app/src/hooks/useSync.ts             Real-time sync subscriber
app/src/hooks/shortcuts.ts           Keyboard shortcut matcher
app/src/stores/optimistic.ts         Optimistic update helpers
app/src/App.tsx                      Router + auth guard
app/src/components/AppShell.tsx      Layout, shortcuts, global dialogs
app/src/components/TaskItem.tsx      Task row component
```

## API Reference

**Base URL:** `/api/v1`  
**Auth:** `Authorization: Bearer <JWT>` (all endpoints except `/auth/register`, `/auth/login`, `/auth/reset-password*`)  
**Error shape:** `{ error: { code: string, message: string, details?: unknown } }`

Key route groups:

```
POST   /auth/register          POST   /auth/login
POST   /auth/logout            POST   /auth/reset-password

GET/POST          /tasks
PATCH/DELETE      /tasks/:id
POST              /tasks/:id/complete   POST /tasks/:id/reopen
PATCH             /tasks/:id/reorder

GET               /views/today     GET /views/upcoming?days=7     GET /views/inbox

GET/POST/PATCH/DELETE  /projects   /labels   /sections   /filters   /reminders   /comments
GET               /search?q=
GET/PATCH         /preferences
GET               /activity?project_id=&cursor=
```

## Real-time Sync

Socket.IO connection: pass `{ auth: { token } }` on connect.  
Event name: `"sync"`. Payload (`SyncEvent`):

```typescript
{
  id: string;
  entityType: 'task' | 'project' | 'section' | 'label' | 'comment' | 'reminder';
  eventType:  'created' | 'updated' | 'deleted' | 'completed' | 'uncompleted';
  entityId:   string;
  userId:     string;
  collectionId?: string | null;
  payload?:   unknown;
  emittedAt:  string;   // ISO 8601
}
```

Rooms: `user:{userId}` (all sessions) and `collection:{collectionId}` (collaborators).  
`publishEvent()` in `syncService.ts` is the sole entry point - call it from every mutation.

## Database

PostgreSQL 16. Pool max 20 connections. Migrations run at startup from `api/src/db/migrations/`.  
Schema tables: `users`, `sessions`, `preferences`, `password_reset_tokens`, `collections`, `collaborators`, `project_invitations`, `sections`, `tasks`, `labels`, `task_labels`, `filters`, `comments`, `reminders`, `activity_events`, `habits`, `habit_completions`, `habit_groups`.

Redis: three clients from `db/redis.ts` - `redisClient` (general), `redisPubClient` (publish), `redisSubClient` (subscribe). Auth rate-limiting uses `redisClient`.

## Frontend State

Three layers, each with a distinct role:

| Layer | Tool | Scope |
| --- | --- | --- |
| Server cache | React Query (`queryClient.ts`) | API data, staleTime 60s |
| Optimistic local | `stores/optimistic.ts` | Mutations before server confirm |
| Global client | Zustand `taskStore.ts` | Cross-component task list |

Pattern for mutations: `runOptimistic({ apply, revert })` → fire API call → on error, auto-revert after 2s.

## Design System

- **Font:** Lora serif only - no sans-serif anywhere
- **Palette:** warm cream/beige background (`--color-cream: #f5f0e8`), single brick-red accent (`--color-accent: #c9483b`, ≤10% of screen), ink (`--color-ink: #44443d`)
- **Elevation:** flat - tint + 1px border only; no `box-shadow` on cards (overlay drop-shadow only: `box-shadow: 0 8px 32px rgba(44,44,44,0.15)`)
- **Rhythm:** 24px vertical baseline - all spacing must be multiples of 24px
- **Never:** blue as primary color; `box-shadow` on cards; pure white `#fff` or pure black `#000`

Full spec: `DESIGN.md`.

## Coding Conventions & Development Rules

- TypeScript strict mode; no `any` without justification.
- Dedicated type files: All interfaces and types must live in dedicated files under `app/src/types/` or `api/src/types/`.
- Every mutation must call `publishEvent()` in `services/syncService.ts` after DB write.
- Auth middleware validates JWT **and** queries DB for session validity on every request.
- React Query manages server state; Zustand manages client-side optimistic state.
- Optimistic updates go through helpers in `stores/optimistic.ts`.
- All routes are under `/api/v1/`; add new routes to `routes/index.ts`.
- Mandatory TDD & Full Coverage: Test-Driven Development (red-green-refactor) is required. Write unit tests, real DB/Redis integration tests (no mock-DB pattern), and Playwright E2E tests for features and bugfixes.
- Mandatory Conventional Commits: All commits MUST strictly follow Conventional Commits (`feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`, etc.). Create small, focused commits per file or logical feature.
- User Prompt Commit Aliases:
  - `commit` or `gcm` -> Stage and commit using Conventional Commits format with required `Co-Authored-By` trailer.
  - `commit and push`, `gcp`, or `gcmp` -> Stage, commit (with Conventional Commits + `Co-Authored-By` trailer), and push to remote branch (`git push`).
- Add `Co-Authored-By` trailer matching the model on the last line of every commit body:
  - GitHub Copilot CLI: `Co-Authored-By: Copilot (<model-used> <effort>) <copilot@github.com>`
  - OpenCode: `Co-Authored-By: OpenCode (<real model name and effort>) <noreply@opencode.ai>`
  - Codex: `Co-Authored-By: Codex (<real model name and effort>) <codex@openai.com>`
  - Antigravity: `Co-Authored-By: Antigravity (<real model name and effort>) <noreply@antigravity.ai>`
  - Claude Code: `Co-Authored-By: Claude (<model>) <noreply@anthropic.com>` (e.g. `Claude (Sonnet 5)`). No separate reasoning-effort tier is exposed for Claude Code - model choice (Haiku/Sonnet/Opus) is the only capability lever, so effort is omitted.
- No AI Slop / Em Dash Ban: Avoid AI slop in comments. Never use em dashes (`—` or `–`) anywhere in code or documentation; use simple dashes `-`.
- UI Screenshots: Save visual test screenshots to `./app/dist/screenshots/*.png` inside the worktree and display them as clickable markdown links.
- Validate only at system boundaries (user input, external APIs).
- Comments only for non-obvious WHY - never for WHAT.
- No backwards-compat shims for removed code - delete cleanly.
- Node ≥ 24 required.

## Plan Mode — Specs Convention

All AI agents (Claude, Codex, Antigravity, OpenCode) must follow this when entering Plan mode:

1. **Create a new folder** under `.specs/` with the naming pattern: `yyyy-mm-dd-<short-kebab-case-slug>` (e.g., `2026-08-04-exact-colors`).
2. Write **`.specs/yyyy-mm-dd-slug/plan.md`** - high-level strategy, approach, and architecture decisions.
3. Write **`.specs/yyyy-mm-dd-slug/task.md`** - detailed breakdown of the plan into actionable tasks using markers: `[ ]` not started, `[~]` in progress, `[x]` completed.
4. **Update `task.md`** as work progresses.

## "Work on this spec" & Worktree Lifecycle Workflow

When instructed to work on a spec or task:

1. **Read the Spec / Request**: Review requirements carefully.
2. **Isolate Environment**:
   - Create worktree & branch: `git worktree add ../planner-<slug> -b feat/<slug>`
   - Subagents use numbered subdomains (e.g. `claude2.planner.local`, `codex2.planner.local`, `antigravity2.planner.local`).
   - **New host = regenerate SSL first**: any new subdomain needs a trusted cert before it's reachable over https, or the browser session in step 4 fails with `ERR_CERT_AUTHORITY_INVALID`. Add the new domain(s) to `/p/linux/scripts/mkcert.conf` (or confirm a wildcard already covers it), run `bash /p/linux/scripts/mkcert-local` to regenerate `/p/projects/traefik/certs/localhost.pem`, then `docker restart traefik` to pick it up. Do this once per new subdomain, before adding its `/etc/hosts` entries.
3. **Local Dev Setup & Draft PR**:
   - Copy `.env.example` to `.env` in worktree root.
   - Set `COMPOSE_PROJECT_NAME=planner-<agent>` and `APP_SUBDOMAIN=<agent>.planner`.
   - Run `bash .hooks/setup-hooks.sh`.
   - Start stack: `docker compose up -d`.
   - **Open Draft PR**: Push initial branch and open a Pull Request against `main` marked as **Draft** before starting development.
4. **Live Browser Session**:
   - Launch Chrome browser using Playwright at `https://<agent>.planner.local` right as development starts to inspect UI live throughout development.
5. **Implementation, Testing & Milestone Commits**:
   - Implement feature following TDD (unit, integration, Playwright E2E) and coding conventions.
   - Save visual test screenshots to `./app/dist/screenshots/*.png` inside worktree and display them as clickable markdown links.
   - **Checkpoint Commits & Push**: At every checkpoint, milestone, or completed block of a feature, create small Conventional Commits with `Co-Authored-By` trailer and push to remote branch (`git push`).
6. **Worktree Teardown & PR Finalization Protocol**:
   - Mark Draft PR as Ready for Review once implementation and verification are complete.
   - Keep worktree stack running during review; do NOT tear down automatically.
   - Only tear down when explicitly asked (e.g., "accept PR and remove leftovers", "remove leftovers", "tear down worktrees").
   - For "worktrees cleanup", verify branches are merged to `main`, list safe worktrees to remove, and request confirmation before running `docker compose down -v` and `git worktree remove`.
