# PostgreSQL 16 to 18 upgrade

Planner moves to PostgreSQL 18 across dev, CI and production. The production cutover preserves existing data and pauses API writes during the final backup and restore.

## Local development

Compose starts a PostgreSQL 18 cluster using the new `pgdata18` volume mounted at `/var/lib/postgresql`. Prior named volumes remain available. Developers can keep their local data by following the dump and restore instructions in README.md.

## Production

Production stays on PostgreSQL 16 until the operator runs `bash scripts/postgres-upgrade.sh` during a maintenance window. The release itself does not recreate the live PostgreSQL container.

The upgrade verifies a PostgreSQL 16 backup by restoring into a scratch database on PostgreSQL 18 while the API is still serving. The script then pauses API writers, takes and verifies a final dump, restores it to the new volume, and compares every application table's row count. It starts the API after the replacement database passes verification and checks public API health.

A failure before writers resume rolls back to the PostgreSQL 16 volume. Once writers can connect to PostgreSQL 18, the new database is authoritative. The old volume and final dump are retained for at least 14 days. Deploys use the persisted cutover marker and fail if it disagrees with the existing container.

Use logical dump and restore for the small production database. Evaluate a separate approach if the database grows beyond 1 GiB or rehearsal exceeds the available window. The production preflight measured 11,844,631 bytes.

## CI

API, E2E, and recovery tests use PostgreSQL 18. A disposable Docker rehearsal upgrades a PostgreSQL 16 fixture, verifies PostgreSQL 18 backups and restores, and injects a failure to prove the old volume can resume service. The scheduled production backup and approval-gated production restore workflows remain available.

Container scanning already covers the production PostgreSQL 18 Alpine tag. The major-version cutover does not close existing findings for that image. Track image findings against scan results.

## Rollout checkpoint

The manual backup `20261120T224328Z-manualpg18.dump` from production PostgreSQL 16.15 is stored on the server under `deploy/backups/postgres18/`. Its checksum and scratch restore passed before implementation. PR #506 was a temporary PG16 pin. The production override in this upgrade preserves the running major until the approved cutover.

## Relevant files

- `compose.yml`, `compose.prod.yml`, `compose.prod.pg16.yml`
- `scripts/postgres-upgrade.sh`, `scripts/postgres-upgrade.test.sh`, `scripts/prod-postgres.sh`
- `scripts/blue-green-deploy.sh`, `scripts/blue-green-deploy.test.sh`
- `.github/workflows/1.review.yml`, `.github/workflows/2a.quality.yml`, `.github/workflows/ci.yml`
- `README.md`, `CLAUDE.md`, `.claude/agents/db-migrator.md`
