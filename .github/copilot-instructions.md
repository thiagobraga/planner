# Copilot instructions for Planner

Purpose: concise, actionable guidance for Copilot/CLI sessions in this repo.

## Quick commands
- Start full dev stack (recommended):
  - cp .env.example .env && docker compose up -d
- App (frontend) local (inside repo/app):
  - dev: npm run dev
  - build: npm run build
  - lint: npm run lint
  - test (all): npm run test
  - single test file: npm exec vitest run src/path/to/file.test.ts
- API (backend) local (inside repo/api):
  - dev: npm run dev
  - build: npm run build
  - start (prod): npm run start
  - typecheck: npm run typecheck
  - lint: npm run lint
  - test (all): npm run test
  - single test file (via Docker): docker compose exec api npm exec vitest run src/path/to/file.test.ts
  - or locally: (cd api && npm exec vitest run src/path/to/file.test.ts)
- Run both package builds/tests via compose (CI-like):
  - docker compose exec api npm run build && docker compose exec app npm run build
  - docker compose exec api npm test && docker compose exec app npm test

## High-level architecture (short)
- Mono-repo with two packages: `api/` (Express + PostgreSQL + Redis) and `app/` (React + Vite).
- Real-time sync: mutation → DB write in API service → services/syncService.publishEvent() → Redis Pub/Sub → Socket.IO emits "sync" to rooms `user:{userId}` and `collection:{collectionId}`.
- API: routes under /api/v1; Socket.IO on same HTTP server; JWT + DB session validation on every request.
- DB: Postgres (migrations run at API startup). Redis: three clients (general, pub, sub).
- Frontend state: React Query for server cache, Zustand for global client state, stores/optimistic.ts for optimistic updates and auto-revert.

## Key repo conventions (must-know)
- Node >= 24 and TypeScript strict mode.
- Every backend mutation MUST call publishEvent() in services/syncService.ts after the DB write (single broadcast entry point).
- Auth middleware validates the JWT AND checks the DB session (sessions are revocable).
- All API routes live under /api/v1. Add new route files to api/src/routes and export in routes/index.ts.
- Tests are Vitest-based. Integration tests use a real PostgreSQL instance (no mocked DBs). Use the docker-compose dev stack for reproducible runs.
- Optimistic update helpers live at app/src/stores/optimistic.ts — follow runOptimistic({apply, revert}) pattern for safe UI updates.
- Pre-commit / pre-push hooks are optional; setup via ./.hooks/setup-hooks.sh (recommended to reproduce CI checks locally).
- Commit messages follow Conventional Commits. Add `Co-authored-by: Copilot (<model-used> <effort>) <copilot@github.com>` trailer. See CLAUDE.md/AGENTS.md for agent-specific formats.
- Peggy parser files (parsers/*.peggy) and DB migrations must be copied into dist during API build (see api/package.json build step).

## Helpful files to consult
- CLAUDE.md — in-repo engineering notes, dataflow and coding rules.
- AGENTS.md — agent onboarding, quickstart, and worktree/specs workflow.
- DESIGN.md — design system and visual guidelines.
- .github/workflows/*.yml — CI steps; mirror these locally when reproducing pipeline checks.

## Specs & worktree workflow (agent-oriented)
- Follow .specs/ pattern for Plan Mode: create `.specs/yyyy-mm-dd-slug/{plan.md,task.md}`.
- For isolated feature work: create a worktree `git worktree add ../planner-<slug> -b feat/<slug>`, copy .env.example → .env, set COMPOSE_PROJECT_NAME/APP_SUBDOMAIN per agent, then docker compose up -d.
- After implementing, open a browser at `https://<agent>.planner.local` to visually verify the change.
- Tear down with docker compose down -v and git worktree remove when done.
- Create a Pull Request against `main` and provide the link to the user.

---
Sources used: README.md, CLAUDE.md, AGENTS.md, app/package.json, api/package.json, .github workflows.

If you want, I can add short examples for common Copilot CLI tasks (e.g., "find all publishEvent() callers" or "run a single API integration test with DB logs").
