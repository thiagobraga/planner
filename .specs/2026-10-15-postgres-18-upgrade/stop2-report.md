# STOP 2 report: before the Postgres 16 to 18 upgrade

Written 2026-11-20 at the development-home STOP 2 gate. Nothing in this report has been run against production.

## Finding: the configuration already says 18, production still runs 16

- Commit `64cdeafe` (2026-10-29, `fix(security): resolve 32 code-scanning alert(s) via dependabatch`) bumped `compose.yml`, `compose.prod.yml` and the CI service image from `postgres:16-alpine` to `postgres:18-alpine`, without the data move in `plan.md` / `task.md` (all unchecked).
- Deploys keep working because `scripts/blue-green-deploy.sh:173` runs `shared_compose up -d --no-recreate postgres redis`: the existing PG16 container is never replaced.
- **Risk:** anything that recreates `planner-prod-postgres` (a `compose down`, a manual `docker rm`, a later deploy without `--no-recreate`) starts PG18 on the PG16 volume mounted at `/var/lib/postgresql/data`. PG18 refuses that layout and exits, so the API loses its database until someone pins 16 back or runs the upgrade.
- Local dev hits it now: a fresh worktree volume fails to start with `postgres:18-alpine` on the old mount path. The main checkout carries an uncommitted pin to 16; worktrees use a `compose.override.yml`.
- CI's integration jobs already run on 18, so all 54 migrations are known to apply on 18.

## Recommendation

1. Merge the pin back to `postgres:16-alpine` in `compose.yml` and `compose.prod.yml` (draft PR alongside this report) so configuration matches what runs. No runtime effect in production because of `--no-recreate`.
2. Then run the upgrade as `plan.md` describes, in one maintenance window, with the steps in `task.md`: test-first `scripts/postgres-upgrade.sh`, verified dump, row-count comparison, old volume kept 14 days as rollback.
3. Keep CI on 18 meanwhile: it proves the schema and queries on the target version.

## Preconditions already in place

- Every deploy and the daily job run `scripts/db-backup.sh --docker` and `scripts/db-restore-check.sh --docker` (dump, sha256, row counts, scratch restore).
- `6. Rollback` can redeploy a previous image or restore a named dump after a safety backup, behind the `production-db-restore` reviewer.

## Decisions needed from you

- Approve the 16 pin (infrastructure change, not authorized for unattended merge).
- Pick the upgrade window and confirm the dump-and-restore approach before `scripts/postgres-upgrade.sh` is written and run.
