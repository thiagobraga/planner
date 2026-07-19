# GEMINI.md

This file provides guidance to Gemini CLI when working with code in this repository.

## Project

Planner is a task manager with a paper-journal aesthetic (warm cream, Lora serif, dotted
grid). Two independent npm packages: `api/` (Express + PostgreSQL + Redis) and `app/`
(React + Vite). Real-time sync via Socket.IO backed by Redis Pub/Sub. Auth uses JWT
(7-day expiry) with DB-side session revocation.

## Setup

```bash
cp .env.example .env          # fill in vars before first run
docker compose up -d          # installs deps, runs migrations, starts api + app + postgres + redis
```

Required `.env` vars: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `JWT_SECRET`,
`CORS_ORIGIN`.

## Commands

```bash
# Development (full stack: api + app + Postgres + Redis)
docker compose up -d

# Build / lint
docker compose exec api npm run build
docker compose exec app npm run build
docker compose exec api npm run lint
docker compose exec app npm run lint

# Tests
docker compose exec api npm test && docker compose exec app npm test     # all tests (Vitest)
docker compose exec api npm test                                          # API tests only
docker compose exec app npm test                                          # App tests only
docker compose exec api npm exec vitest run src/path/to/file.test.ts     # single test file
```

## Architecture

### Data flow for any mutation

1. Frontend calls REST endpoint via Fetch client (`app/src/api/client.ts`)
2. API handler calls service → updates PostgreSQL → calls `publishEvent()` in `syncService.ts`
3. `publishEvent()` publishes to Redis Pub/Sub
4. Redis adapter fans out Socket.IO "sync" event to:
   - `user:{userId}` room - all sessions of that user (multi-device)
   - `project:{projectId}` room - collaborators
5. Frontend `useSync` hook receives event → updates Zustand store or React Query cache

### Backend (`api/src/`)

| Path                          | Purpose                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `index.ts`                    | Express + Socket.IO on same HTTP server                            |
| `middleware/auth.ts`          | Validates JWT **and** checks DB session (revocation-capable)       |
| `services/syncService.ts`     | Core sync engine; `publishEvent()` is single broadcast entry point |
| `services/authService.ts`     | Register, login (Redis rate-limit: 10 attempts/15 min), JWT        |
| `services/taskService.ts`     | CRUD, completion toggle, recurrence logic                          |
| `services/viewService.ts`     | Today/upcoming/inbox aggregations                                  |
| `services/collectionService.ts` | Collection (project) CRUD                                        |
| `services/habitService.ts`    | Habit tracking, completions, streaks                               |
| `services/preferencesService.ts` | User preferences (font, theme, etc.)                            |
| `services/labelService.ts`    | Label CRUD                                                         |
| `services/sectionService.ts`  | Section CRUD                                                       |
| `services/commentService.ts`  | Comment CRUD                                                       |
| `services/reminderService.ts` | Reminder CRUD                                                      |
| `services/searchService.ts`   | Full-text search                                                   |
| `services/filterService.ts`   | Saved filter CRUD + Peggy DSL evaluation                           |
| `services/activityService.ts` | Activity feed                                                      |
| `services/collaborationService.ts` | Project collaboration                                          |
| `db/pool.ts`                  | PostgreSQL pool (max 20 conns)                                     |
| `db/redis.ts`                 | Three Redis clients: general, pub, sub                             |
| `routes/index.ts`             | Aggregates all routes under `/api/v1/`                             |
| `parsers/`                    | Peggy-based date and filter parsers                                |
| `engines/recurrenceEngine.ts` | Recurrence rule evaluation                                         |

### Frontend (`app/src/`)

| Path                       | Purpose                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `contexts/AuthContext.tsx` | Single source of auth truth; manages socket connect/disconnect                          |
| `utils/socket.ts`          | Socket.IO singleton; token via `socket.auth`; stored as `planner_token` in localStorage |
| `hooks/useSync.ts`         | Subscribes to "sync" Socket.IO events; triggers cache invalidation                      |
| `hooks/shortcuts.ts`       | Global keyboard shortcut handling                                                       |
| `hooks/usePreferences.ts`  | User preferences hook                                                                   |
| `api/client.ts`            | Fetch wrapper; auto-logout on 401                                                       |
| `api/queryClient.ts`       | React Query config (staleTime 60s, 1 retry)                                             |
| `stores/taskStore.ts`      | Zustand client-side task cache                                                          |
| `stores/collectionStore.ts` | Zustand store for collections                                                          |
| `stores/authStore.ts`      | Zustand store for auth state                                                            |
| `stores/optimistic.ts`     | Optimistic update helpers                                                               |
| `pages/`                   | DailyPage, InboxPage, UpcomingPage, MonthlyPage, HabitsPage, CollectionsPage, SettingsPage, LoginPage, StyleguidePage |
| `components/AppShell.tsx`  | Layout wrapper with sidebar                                                             |
| `index.css`                | Design system tokens and global styles                                                  |

## Design System

See `DESIGN.md` for the full spec. These rules are non-negotiable:

- **Font**: Lora serif only - no sans-serif anywhere
- **Palette**: warm cream `#f5f0e8` background, brick-red `#c9483b` accent (≤10% of screen), ink `#44443d`
- **Elevation**: flat design - tint + 1px border only; no box shadows on cards/rows
- **Rhythm**: 24px vertical baseline grid - all spacing must be multiples of 24px
- **Color rules**: no pure white `#fff` or pure black `#000`; never use blue as primary

Single allowed shadow (overlay panels only): `box-shadow: 0 8px 32px rgba(44,44,44,0.15)`

## Key Conventions

- TypeScript everywhere - no `any` unless unavoidable
- Every mutation must call `publishEvent()` in `services/syncService.ts` after DB write
- Auth middleware validates JWT **and** queries DB for session validity on every request
- React Query manages server state; Zustand manages client-side optimistic state
- Optimistic updates go through helpers in `stores/optimistic.ts`
- All routes are under `/api/v1/`; add new routes to `routes/index.ts`
- Property-based tests use `fast-check` alongside standard unit tests
- No mock databases in integration tests - use real PostgreSQL

## Testing

```bash
docker compose exec api npm test && docker compose exec app npm test     # run everything
docker compose exec api npm test                                          # backend only
docker compose exec app npm test                                          # frontend only
docker compose exec api npm exec vitest run src/services/__tests__/taskService.sync.test.ts
```

Test files live alongside source (`__tests__/` subdirectories or `.test.ts` suffix).
Sync-related tests require Redis running (use `docker compose up -d redis`).

## Gemini CLI Notes

Gemini CLI tools differ from Claude Code tool names. Use the `activate_skill` tool to load
skills (equivalent of Claude Code's `Skill` tool). File editing tools follow the same
read-before-edit discipline: always read a file before modifying it, and grep for all
callers before changing a function signature.
