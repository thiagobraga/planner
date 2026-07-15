# Planner - Agent Onboarding

Task manager with a paper-journal aesthetic (warm cream, Lora serif, dotted grid). Two independent npm packages: `api/` (Express + PostgreSQL + Redis) and `app/` (React + Vite).

## Quickstart

```bash
cp .env.example .env          # fill POSTGRES_PASSWORD, JWT_SECRET, CORS_ORIGIN
docker compose up -d          # installs deps, runs migrations, starts api (4000) + app (5173)
```

Required `.env` vars: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `JWT_SECRET`, `CORS_ORIGIN`.

## Commands

| Command                                                              | What it does                          |
| ---------------------------------------------------------------------- | -------------------------------------- |
| `docker compose up -d`                                                | Start api (4000) + app (5173) + Postgres + Redis |
| `docker compose exec api npm run build`                               | Build API                             |
| `docker compose exec app npm run build`                               | Build app                             |
| `docker compose exec api npm run lint`                                | Lint API                              |
| `docker compose exec app npm run lint`                                | Lint app                              |
| `docker compose exec api npm test && docker compose exec app npm test` | All tests (Vitest)                    |
| `docker compose exec api npm test`                                    | API tests only                        |
| `docker compose exec app npm test`                                    | App tests only                        |
| `docker compose exec api npm exec vitest run src/path/to/file.test.ts` | Single test file                      |

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
- `services/taskService.ts` - CRUD, completion, recurrence
- `services/viewService.ts` - today/upcoming/inbox aggregations
- `services/filterService.ts` - saved filter CRUD + evaluation via Peggy DSL parser
- `db/pool.ts` - PostgreSQL pool (max 20); `db/redis.ts` - three clients (general, pub, sub)
- `parsers/` - Peggy-based filter DSL and date parsers
- `engines/recurrenceEngine.ts` - daily/weekly/monthly/yearly recurrence

All routes under `/api/v1/`. Route files: `auth`, `tasks`, `projects`, `labels`, `sections`, `views`, `filters`, `search`, `reminders`, `comments`, `preferences`, `activity`, `collaboration`.

### Frontend (`app/src/`)

- `contexts/AuthContext.tsx` - auth source of truth; manages socket connect/disconnect lifecycle
- `utils/socket.ts` - Socket.IO singleton; token passed via `socket.auth`; stored as `planner_token` in localStorage
- `hooks/useSync.ts` - subscribes to `"sync"` events; handler receives `SyncEvent`
- `hooks/shortcuts.ts` - pure chord-aware keyboard matcher; `DEFAULT_BINDINGS` for `q /  ? Enter Delete Escape g+i g+t g+u`
- `api/client.ts` - Fetch wrapper; base `/api/v1`; auto-logout on 401
- `api/queryClient.ts` - React Query config (staleTime 60s, 1 retry)
- `stores/taskStore.ts` - Zustand store; `setTasks / addTask / updateTask / removeTask`
- `stores/optimistic.ts` - optimistic helpers: `runOptimistic`, `applyOptimistic`, `revertOptimistic` (2s auto-revert)

### Pages & Routes

| Route              | Page             | Purpose                                |
| ------------------ | ---------------- | -------------------------------------- |
| `/today` (default) | `TodayPage`      | Overdue + today sections               |
| `/inbox`           | `InboxPage`      | Unprocessed tasks; also `/project/:id` |
| `/upcoming`        | `UpcomingPage`   | 7-day preview                          |
| `/monthly`         | `MonthlyPage`    | Monthly calendar                       |
| `/habits`          | `HabitsPage`     | Habit streaks (12-week grid)           |
| `/styleguide`      | `StyleguidePage` | Design system reference                |

`AppShell` wraps all routes: sidebar, keyboard dispatch, QuickAdd/Search dialogs.

## Key Files

```
api/src/index.ts                     Express + Socket.IO server entry
api/src/middleware/auth.ts           JWT + session validation
api/src/services/syncService.ts      publishEvent() - real-time broadcast
api/src/services/taskService.ts      Task CRUD + recurrence
api/src/db/pool.ts                   PostgreSQL pool
api/src/db/redis.ts                  Redis clients (pub/sub)
api/src/db/migrations/               SQL migration files (001–015)
api/src/parsers/filterParser.ts      Peggy filter DSL parser
api/src/engines/recurrenceEngine.ts  Recurrence rule engine
api/src/utils/AppError.ts            Custom error class

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
  projectId?: string | null;
  payload?:   unknown;
  emittedAt:  string;   // ISO 8601
}
```

Rooms: `user:{userId}` (all sessions) and `project:{projectId}` (collaborators).  
`publishEvent()` in `syncService.ts` is the sole entry point - call it from every mutation.

## Database

PostgreSQL 16. Pool max 20 connections. Migrations run at startup from `api/src/db/migrations/`.  
Schema tables: `users`, `sessions`, `preferences`, `password_reset_tokens`, `projects`, `collaborators`, `project_invitations`, `sections`, `tasks`, `labels`, `task_labels`, `filters`, `comments`, `reminders`, `activity_events`.

Redis: three clients from `db/redis.ts` - `redisClient` (general), `redisPubClient` (publish), `redisSubClient` (subscribe). Auth rate-limiting uses `redisClient`.

## Frontend State

Three layers, each with a distinct role:

| Layer            | Tool                           | Scope                           |
| ---------------- | ------------------------------ | ------------------------------- |
| Server cache     | React Query (`queryClient.ts`) | API data, staleTime 60s         |
| Optimistic local | `stores/optimistic.ts`         | Mutations before server confirm |
| Global client    | Zustand `taskStore.ts`         | Cross-component task list       |

Pattern for mutations: `runOptimistic({ apply, revert })` → fire API call → on error, auto-revert after 2s.

## Design System

- **Font:** Lora serif only - no sans-serif anywhere
- **Palette:** warm cream/beige background (`#FAF7F2`), single brick-red accent (`#C0392B` family, ≤10% of screen)
- **Elevation:** flat - tint + 1px border only; no `box-shadow` on cards (overlay drop-shadow only)
- **Rhythm:** 24px vertical baseline
- **Never:** blue as primary color; `box-shadow` on cards

Full spec: `DESIGN.md`.

## Coding Conventions

- TypeScript strict mode; no `any` without justification
- Comments only for non-obvious WHY - never for WHAT
- No error handling for impossible cases; trust framework guarantees
- Validate only at system boundaries (user input, external APIs)
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, etc.), many small per file/feature
- No backwards-compat shims for removed code - delete cleanly
- Tests: Vitest; integration tests hit real DB (no mock-DB pattern)
- Node ≥ 20 required
