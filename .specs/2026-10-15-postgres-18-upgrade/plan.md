# Postgres 16 to 18 Upgrade

## What

Move Planner's database from PostgreSQL 16 to PostgreSQL 18 everywhere: local dev, CI and production. No app behavior changes. Nobody should lose data, and the API should be down for a few minutes at most during the production cutover.

## Why

- PostgreSQL 16 is supported until Nov 2028, 18 until Nov 2030. Doing one major hop now is cheaper than doing it under pressure later.
- 16, 17 and 18 all ship the same `gosu 1.19 (go1.24.6)` today, so this does **not** clear the gosu Trivy alerts (those need an upstream image rebuild). It is independent housekeeping.

## What changes for me

### As the developer (local dev)

- `docker compose up -d` starts Postgres 18.
- The PG18 image stores data in a new place (`/var/lib/postgresql/<major>/docker`), so the old dev volume is **not** reused. Postgres 18 refuses to start on an old-layout volume instead of silently creating an empty database.
- Local dev data is disposable. After pulling, run `docker compose down -v && docker compose up -d` to get a fresh 18 database (migrations recreate the schema). If I want to keep local data, there is a documented dump and restore snippet.
- Each worktree has its own `planner-<slug>_pgdata` volume, so this is needed once per worktree. Stale volumes can be pruned.

### As the production operator

- One command, run on the server: `bash scripts/postgres-upgrade.sh`.
- It takes a verified backup, stops the API for the maintenance window, moves the data into a fresh PG18 cluster, checks row counts match, and starts the API again.
- The old PG16 volume is kept untouched as the rollback path for 14 days.
- Regular blue/green deploys keep working as before.

### In CI

- Unit and integration jobs run against `postgres:18-alpine`, so all 48 migrations are proven on PG18 before anything ships.

## Approach: dump and restore (not `pg_upgrade`)

The database is small and single-tenant, so a logical dump and restore is the simplest safe path:

- No binary-compatibility tooling in an Alpine image (two Postgres versions side by side).
- Works around the PG18 default change to data checksums (`pg_upgrade` needs both clusters to match).
- A fresh cluster, so no leftover state, and the restore is easy to rehearse beforehand.
- The old volume stays intact, so rollback is trivial.

Trade-off: downtime scales with database size. If the dump turns out to take more than a few minutes, fall back to `pg_upgrade --link` (see Open Questions).

## Out of scope

- Using PG18 features (`uuidv7()`, async I/O tuning, etc.).
- Fixing the gosu CVEs, replacing `uuid_generate_v4()` or the CI Redis 7 versus prod Redis 8 drift.
- Setting up scheduled production backups (the upgrade script takes a one-off backup only). Worth a follow-up spec.

## Open Questions

1. Is a maintenance window of a few minutes acceptable for production (API returns 502, the app shell stays up)? Default: yes.
2. How big is the production database? If more than about 1 GB, switch to `pg_upgrade --link`. Default: assume small and measure with `pg_database_size` during pre-flight.
3. Are old local dev volumes fine to wipe? Default: yes.

## Relevant Files

- `compose.yml` - dev Postgres image tag and volume mount
- `compose.prod.yml` - prod Postgres image tag, new `pgdata18` volume, mount path
- `.github/workflows/2a.quality.yml` - two `postgres:16-alpine` service containers
- `scripts/postgres-upgrade.sh` [new] - production cutover with backup, verify and rollback
- `scripts/postgres-upgrade.test.sh` [new] - mocked-docker test, same pattern as `blue-green-deploy.test.sh`
- `scripts/blue-green-deploy.sh` - unchanged, but its `up -d --no-recreate postgres` is why the cutover needs a separate script
- `CLAUDE.md` (GEMINI.md/AGENTS.md symlinks) - "PostgreSQL 16" text
- `.claude/agents/db-migrator.md`, `.codex/agents/db-migrator.toml` - "PostgreSQL 16" text
- `README.md` - upgrade and rollback notes for dev and prod
