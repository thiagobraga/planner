# Postgres 16 to 18 Upgrade - Tasks

Branch/worktree: `git worktree add ../planner-postgres-18 -b chore/postgres-18`

## Findings (verified 2026-10-15)

- `postgres:18-alpine` sets `PGDATA=/var/lib/postgresql/18/docker` and declares `VOLUME /var/lib/postgresql`. 16 uses `/var/lib/postgresql/data`. Mounting at `/var/lib/postgresql/data` on 18 is wrong; mount `/var/lib/postgresql`.
- `uuid-ossp.control` is present in 18-alpine (migration `001_users.sql` does `CREATE EXTENSION "uuid-ossp"`; ~20 tables default to `uuid_generate_v4()`).
- No other extensions. `to_tsvector('english', ...)` GIN index in `009_tasks.sql` only.
- `pg` driver is `^8.23.1`, supports PG18 and SCRAM.
- `scripts/blue-green-deploy.sh` line 168 uses `up -d --no-recreate postgres redis`, so merging a new image tag never recreates the running prod container. The cutover must be an explicit script.
- PG18 `initdb` enables data checksums by default. 16 clusters have them off. Irrelevant for dump/restore, blocking for `pg_upgrade`.
- `backups/` is already in `.gitignore`.
- No existing prod backup procedure in the repo.

## 1. Tests first (red)

- [ ] 1.1 Write `scripts/postgres-upgrade.test.sh` using the mock-docker pattern from `scripts/blue-green-deploy.test.sh`. Cases:
  - [ ] happy path: order is backup, verify dump, stop api, final dump, stop pg16, up pg18, restore, row-count compare, analyze, start api
  - [ ] aborts before stopping anything if the dump fails `pg_restore --list`
  - [ ] aborts and restarts api if row counts differ after restore
  - [ ] refuses to run if `pgdata18` already contains a cluster (idempotency guard)
  - [ ] lock: second concurrent run exits 1
- [ ] 1.2 Run it, confirm it fails because the script does not exist.

## 2. CI (cheapest proof first)

- [ ] 2.1 `.github/workflows/2a.quality.yml` lines 22 and 98: `postgres:16-alpine` -> `postgres:18-alpine`.
- [ ] 2.2 Push the branch and confirm unit + integration jobs pass on 18 (all 48 migrations, tsvector index, uuid-ossp).
- [ ] 2.3 Leave Redis 7 in CI alone (out of scope).

## 3. Dev compose

- [ ] 3.1 `compose.yml`: image `postgres:18-alpine`; volume `pgdata:/var/lib/postgresql`.
- [ ] 3.2 Local verify in the worktree: `docker compose down -v && docker compose up -d`; api starts, migrations apply, health ok.
- [ ] 3.3 Confirm an old-layout PG16 volume makes the 18 container exit loudly (not silently reinit) and document the message.
- [ ] 3.4 README note: one-time `docker compose down -v` per worktree; optional dump/restore snippet:
  `docker compose exec postgres pg_dump -U planner -Fc planner > backups/dev.dump` (on the old stack), then
  `docker compose exec -T postgres pg_restore -U planner -d planner --no-owner < backups/dev.dump` (on the new).

## 4. Production compose

- [ ] 4.1 `compose.prod.yml`: image `postgres:18-alpine`; volume `pgdata18:/var/lib/postgresql`; add `pgdata18:` under `volumes:`. Keep `pgdata:` declared so it is not treated as orphaned and stays as the rollback copy.
- [ ] 4.2 `docker compose -f compose.prod.yml config` passes; the CI `compose-config` hardening job (cap_drop ALL, no-new-privileges) still passes. Confirm PG18 starts with the existing `cap_add` list.
- [ ] 4.3 Note: postgres running as non-root after `gosu` drop needs CHOWN, SETUID, SETGID, DAC_OVERRIDE (already present).

## 5. `scripts/postgres-upgrade.sh`

Same conventions as `blue-green-deploy.sh` (`set -euo pipefail`, `flock` on `deploy/.deploy.lock`, resolve shared compose project from the `planner-prod-postgres` label).

- [ ] 5.1 Pre-flight
  - [ ] container `planner-prod-postgres` running and healthy, `SHOW server_version` starts with 16
  - [ ] `pgdata18` volume absent or empty; refuse otherwise
  - [ ] free disk >= 2x `pg_database_size`
  - [ ] print DB size; abort with a pointer to `pg_upgrade` if over the threshold (default 1 GB, `--force` to override)
- [ ] 5.2 Rehearsal dump (app still up): `docker exec planner-prod-postgres pg_dump -U "$(cat user)" -Fc -f /tmp/pre.dump "$(cat db)"`, copy to `backups/planner-pg16-<ts>.pre.dump`, `pg_restore --list` must succeed.
- [ ] 5.3 Scratch restore: start a throwaway `postgres:18-alpine` on a temp volume, restore the pre-dump, run row-count compare. Proves the procedure before any downtime. Remove the scratch container and volume.
- [ ] 5.4 Maintenance
  - [ ] stop api containers of the active color (`deploy/.active-color`); keep app and router up
  - [ ] final dump to `backups/planner-pg16-<ts>.final.dump`, `pg_restore --list` check
  - [ ] record per-table `count(*)` from a generated query over `information_schema.tables`
- [ ] 5.5 Switch
  - [ ] `docker stop -t 30 planner-prod-postgres`
  - [ ] `shared_compose up -d --force-recreate postgres` (now PG18 + `pgdata18`), `wait_for_container_health planner-prod-postgres`
  - [ ] `pg_restore --exit-on-error --single-transaction --no-owner -d <db>` from the final dump
  - [ ] `vacuumdb --all --analyze-only` (dump/restore carries no planner stats)
  - [ ] recompute row counts, compare; on mismatch -> rollback (5.7)
- [ ] 5.6 Resume
  - [ ] start api of the active color, `wait_for_health`, run `verify_public`
  - [ ] print rollback instructions and the 14-day old-volume retention date
- [ ] 5.7 Rollback path (also used by the error trap)
  - [ ] before api resumes: stop pg18, restore compose to 16 + `pgdata`, start, restart api. No data lost.
  - [ ] after api resumed and wrote data: document `pg_dump` from 18 into the old 16 volume as a best-effort path; recommend avoiding it by checking quickly.
- [ ] 5.8 Make `1.x` tests green, shellcheck clean.

## 6. Rehearsal (before touching prod)

- [ ] 6.1 On the dev stack: seed from a prod-like dump if available, otherwise create tasks, habits, collections, sessions, API tokens and an OAuth grant through the UI/MCP.
- [ ] 6.2 Run the upgrade steps by hand against a 16 dev stack, then exercise the app: login with existing session, search (tsvector), recurrence, activity feed, Socket.IO sync.
- [ ] 6.3 Time the dump and restore to size the maintenance window.

## 7. Docs and agent instructions

- [ ] 7.1 `CLAUDE.md` line "PostgreSQL 16." -> "PostgreSQL 18." (symlinked copies follow automatically).
- [ ] 7.2 `.claude/agents/db-migrator.md` and `.codex/agents/db-migrator.toml`: "PostgreSQL 16" -> "PostgreSQL 18".
- [ ] 7.3 `README.md`: dev volume note, prod upgrade and rollback commands. Mention the `--no-recreate` reason in a comment in `compose.prod.yml` only if non-obvious.

## 8. Rollout order

- [ ] 8.1 PR 1 `ci:` CI to 18 (task 2). Merge once green.
- [ ] 8.2 PR 2 `chore:` dev + prod compose, script, tests, docs (tasks 1, 3 to 7). CI passes.
- [ ] 8.3 Merge PR 2, then immediately run `bash scripts/postgres-upgrade.sh` on the server. The deploy itself does not recreate postgres (`--no-recreate`), so the order is safe, but until the script runs, any manual recreation of the container would start an empty 18 cluster. Do not recreate it by hand in the gap.
- [ ] 8.4 After 14 days of stable running: `docker volume rm <project>_pgdata` and delete old dumps from `backups/`.
- [ ] 8.5 Re-scan: confirm the Trivy infra alert for `postgres:18-alpine` replaces the 16 one (gosu alerts expected to persist until upstream rebuilds).

## 9. Commits

Conventional Commits, small and focused, with the Antigravity `Co-Authored-By` trailer: `ci:` workflow bump, `chore:` compose, `feat:` upgrade script + `test:`, `docs:` README/CLAUDE.md.
