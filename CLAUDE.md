# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Planner is a task manager with a paper-journal aesthetic (warm cream, Lora serif, dotted grid). pnpm monorepo: `api/` (Express + PostgreSQL + Redis) and `app/` (React + Vite).

## Commands

```bash
# Development
pnpm dev:api          # API dev server (tsx watch, port 4000)
pnpm dev:app          # Vite dev server (port 5173)

# Build / lint
pnpm build            # Build all packages
pnpm lint             # Lint all packages

# Tests
pnpm test                                         # All tests (Vitest)
pnpm -F api test                                  # API tests only
pnpm -F app test                                  # App tests only
pnpm -F api vitest run src/path/to/file.test.ts   # Single test file

# Docker (full stack)
docker-compose up -d
```

Copy `.env.example` → `.env` before first run. Required vars: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `JWT_SECRET`, `CORS_ORIGIN`.

### Dev hosts (Traefik on the `proxy` network)

Add to `/etc/hosts`: `planner.local`, `api.planner.local`, `db.planner.local`.

- `https://planner.local` — app (also serves `/api` and `/socket.io`)
- `https://api.planner.local` — API directly (e.g. `/api/v1/...`)
- `https://db.planner.local` — pgAdmin (desktop mode, no master password). The Planner
  database is auto-registered; connect with DB password `planner`.

## Architecture

### Data flow for any mutation

1. Frontend calls REST endpoint via Fetch client (`app/src/api/client.ts`)
2. API handler calls service → updates PostgreSQL → calls `publishEvent()` in `syncService.ts`
3. `publishEvent()` publishes to Redis Pub/Sub
4. Redis adapter fans out Socket.IO "sync" event to:
   - `user:{userId}` room — all sessions of that user (multi-device)
   - `project:{projectId}` room — collaborators
5. Frontend `useSync` hook receives event → updates Zustand store or React Query cache

### Backend (`api/src/`)

- `index.ts` — Express + Socket.IO attached to same HTTP server; Socket.IO validates JWT on connect
- `middleware/auth.ts` — validates JWT **and** checks DB session (sessions can be revoked)
- `services/syncService.ts` — core sync engine; `publishEvent()` is the single entry point for broadcasting
- `services/authService.ts` — register, login (rate-limited via Redis: 10 attempts/15 min), JWT 7-day expiry
- `services/taskService.ts` — CRUD, completion, recurrence logic
- `db/pool.ts` — PostgreSQL pool (max 20 conns); `db/redis.ts` — three Redis clients (general, pub, sub)
- All routes under `/api/v1/`; route aggregation in `routes/index.ts`

### Frontend (`app/src/`)

- `contexts/AuthContext.tsx` — single source of auth truth; manages socket connect/disconnect lifecycle
- `utils/socket.ts` — Socket.IO singleton; token passed via `socket.auth`; token stored in `localStorage` as `planner_token`
- `hooks/useSync.ts` — subscribes to "sync" Socket.IO events; triggers cache invalidation or store updates
- `api/client.ts` — Fetch wrapper; auto-logout on 401
- `api/queryClient.ts` — React Query config (staleTime 60s, 1 retry)
- Zustand stores in `stores/` for client-side task cache; optimistic helpers in `stores/optimistic.ts`
- Pages in `pages/`; reusable components in `components/`

## Design System

See `DESIGN.md` for full spec. Key rules:
- **Font**: Lora serif only — no sans-serif
- **Palette**: warm cream/beige background, single brick-red accent (≤10% of screen)
- **Elevation**: flat design — tint + 1px border only; no shadows except overlay drop shadow
- **Rhythm**: 24px vertical baseline
- Never use blue as primary color; never use box shadows on cards
