# PostgreSQL 16 to 18 upgrade tasks

Worktree `.worktrees/postgres-18-upgrade`, branch `chore/postgres-18-upgrade`, PR #538.

## 1. Preflight

- [x] Inspect PR #506 and resolve how existing production deploys stay on PostgreSQL 16 before the cutover.
- [x] Run a manual PostgreSQL 16 production backup and verify its checksum and scratch restore before implementation. Keep the dump and sidecars on the server.
- [x] Measure the production database size and confirm the existing Compose project and PG16 volume.

## 2. Environments

- [x] Move dev Compose to the PG18 volume and mount path. Document how to keep local PG16 data.
- [x] Run API, E2E, backup and restore CI services on PG18. Use matching backup client utilities.
- [x] Configure the production PG18 volume and guard against an unprepared cluster. Preserve the existing PG16 Compose configuration as the deployment override until cutover.
- [x] Verify both production Compose configurations and start the isolated dev stack on PG18.7 with 56 migrations applied.

## 3. Cutover and rollback

- [x] Share the deploy lock. Check the current cluster, target volume, disk capacity and active API before stopping writers.
- [x] Rehearse a checksum-verified backup on PG18, then stop writers and stage the final dump, compare all table counts and analyze.
- [x] Recreate PostgreSQL on the staged PG18 volume, verify its version and table counts, record deploy state and restart writers. Check public API health.
- [x] Recreate PG16 and restart writers on failures before any writer can reach PG18. Preserve the newer cluster on failures after that point.
- [x] Test blue-green deploy behavior on both majors and reject interrupted cutover state.
- [x] Verify the upgrade and automatic rollback on disposable PostgreSQL clusters, including lock contention and corrupt backup rejection.

## 4. Rollout

- [ ] Confirm PR CI runs the recovery and rollback rehearsal plus quality and scans.
- [ ] After merge and approval for a maintenance window, run the upgrade in production and verify the public API and application workflows.
- [ ] Recheck production backup and scratch recovery on PG18.
- [ ] Review PostgreSQL image scan findings. Retain the old volume and final dump for at least 14 days.
