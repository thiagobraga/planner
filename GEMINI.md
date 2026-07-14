# GEMINI.md

This file provides guidance to Gemini CLI when working with code in this repository.

## Project

Planner is a task manager with a paper-journal aesthetic (warm cream, Lora serif, dotted
grid). pnpm monorepo: `api/` (Express + PostgreSQL + Redis) and `app/` (React + Vite).
Real-time sync via Socket.IO backed by Redis Pub/Sub. Auth uses JWT (7-day expiry) with
DB-side session revocation.

## Setup

```bash
cp .env.example .env          # fill in vars before first run
pnpm install
docker-compose up -d          # starts postgres + redis
pnpm -F api db:migrate        # run migrations
```

Required `.env` vars: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `JWT_SECRET`,
`CORS_ORIGIN`.

## Commands

```bash
# Development
pnpm dev:api          # API dev server (tsx watch, port 4000)
pnpm dev:app          # Vite dev server (port 5173)

# Build / lint
pnpm build            # build all packages
pnpm lint             # lint all packages

# Tests
pnpm test                                          # all tests (Vitest)
pnpm -F api test                                   # API tests only
pnpm -F app test                                   # App tests only
pnpm -F api vitest run src/path/to/file.test.ts    # single test file

# Docker (full stack)
docker-compose up -d
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
| `stores/optimistic.ts`     | Optimistic update helpers                                                               |
| `pages/`                   | InboxPage, TodayPage, MonthlyPage, HabitsPage, LoginPage, StyleguidePage                |
| `components/AppShell.tsx`  | Layout wrapper with sidebar                                                             |
| `index.css`                | Design system tokens and global styles                                                  |

## Design System

See `DESIGN.md` for the full spec. These rules are non-negotiable:

- **Font**: Lora serif only - no sans-serif anywhere
- **Palette**: warm cream `#f5f0e8` background, brick-red `#c0392b` accent (≤10% of screen), ink `#2c2c2c`
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
pnpm test                                          # run everything
pnpm -F api test                                   # backend only
pnpm -F app test                                   # frontend only
pnpm -F api vitest run src/services/__tests__/taskService.sync.test.ts
```

Test files live alongside source (`__tests__/` subdirectories or `.test.ts` suffix).
Sync-related tests require Redis running (use `docker-compose up -d redis`).

## Gemini CLI Notes

Gemini CLI tools differ from Claude Code tool names. Use the `activate_skill` tool to load
skills (equivalent of Claude Code's `Skill` tool). File editing tools follow the same
read-before-edit discipline: always read a file before modifying it, and grep for all
callers before changing a function signature.
