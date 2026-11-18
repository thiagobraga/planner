# Development home - execution log

What to build: `plan.md`. This file records how the run is executed, the slice queue, and per-slice evidence (branch, PR, CI, deploy, screenshots, unverified items).

## Corrections to plan.md

- Line counts on origin/main: `taskService.ts` 483, `CollectionsPage.tsx` 519, `CollectionsIndexPage.tsx` 360. MCP registration is `api/src/mcp/server.ts:24-31` (write gate `:28`).
- `BoardCard.tsx:82` clamps the description to 2 lines (`boards.css:189-197`); the card has no click handler (`:28`).
- Next migration number: **053**. `api/src/db/migrate.ts` runs each file in its own transaction, forward only. Prod migrates the next color before the switch and the rollback trap never reverts the DB, so every migration is additive and the old color must run on the new schema.
- No transaction helper exists. `createTask` records activity after the write, outside a transaction. Actor context already flows through `middleware/requestContext.ts`; the runner reuses it.
- `commentService.ts` emits no sync event although `'comment'` is a `SyncEntityType`.
- Shared contracts: no `shared/` package (Dockerfiles copy one package, `api/tsconfig.json` has `rootDir: "src"`). Instead, byte-identical type-only files at `api/src/contracts/*.ts` and `app/src/contracts/*.ts`, checked by `scripts/check-contracts.sh` in pre-push and `2a.quality.yml`.
- No lazy chunk exists yet: the detail panel + editor becomes the first; measure main bundle before/after.
- Search uses `ILIKE` on title/description; documents are searched through the derived plain-text `description`.
- `TaskDetail.tsx` and `stores/taskStore.ts` have no production importers: delete in a separate `refactor` commit.
- Collections view ignores remote `task`/`section` events (`CollectionsPage.tsx:67-76`). `CollectionTreeNav.tsx` has no importer.
- Window ("Janela") control leaves every page toolbar and becomes "Largura total" in the Planner menu next to the global display toggles (`TopBarMenus.tsx:26-33`); `v f` keeps working. Shedding order: compact date, then Today.

## Rules for every slice

- Fresh `origin/main`, `.worktrees/<slug>`, branch `<type>/<slug>`, one concern, draft PR with first commit.
- TDD per behavior; handwritten files touched stay at most 419 lines; no weakened tests.
- Gate: api and app lint/test/build, relevant Playwright specs, line check, contract check, desktop + 390px screenshots for UI.
- Review: security and code review on every diff; high/critical unresolved = stop.
- Merge only with all checks green (`gh pr merge --merge --delete-branch`). Release PR merged at milestone ends only.
- Postgres stays as deployed (`--no-recreate`) until M5. No slice touches the postgres service in `compose.prod.yml`.

## Slice queue

| # | Slice | Branch | PR | State |
| --- | --- | --- | --- | --- |
| M0.1 | Merge #433 theme color scales | feat/theme-color-scales | #433 | merged `c1ab013d` |
| M0.1 | Update and merge #436 daily chip names | perf/daily-chip-names | #436 | in progress |
| M0.1 | Spec, archive finished specs, close #460 | docs/development-home | - | in progress |
| M0.3 | S-B backup, restore check, rollback | feat/db-backup-restore | - | queued |
| M0.4 | S1 line check, contract check, test fixtures | chore/line-limits-fixtures | - | queued |
| M0.5 | S-MCP parent and status tools | feat/mcp-parent-status | - | queued |
| R0 | Release and verify | - | - | queued |
| M1.6 | S-H task hierarchy reliability | fix/task-hierarchy | - | queued |
| M1.7 | S2 CollectionsPage split | refactor/collections-page-split | - | queued |
| M1.8 | S3 collections split view | feat/collections-split-view | - | queued |
| M1.9 | S3b toolbar buttons, Window to Planner menu | style/toolbar-buttons | - | queued |
| STOP 1 | R1 report, panel/card mock approval | - | - | - |
| M2.10 | S4 contracts, mutation runner, comment sync | refactor/mutation-runner | - | queued |
| M2.11 | S5 documents and detail panel (migration 053) | feat/task-documents | - | queued |
| M3.12 | S6 embedded subtasks, five-row cards | feat/embedded-subtasks | - | queued |
| M4.13 | S7 MCP document/comment/claim/batch | feat/mcp-documents | - | queued |
| M4.14 | S8 Markdown import, dry run, undo | feat/markdown-import | - | queued |
| M4.15 | S9 pilot import and cutover | - | - | queued |
| STOP 2 | Report before Postgres upgrade | - | - | - |
| M5.16 | Postgres 16 to 18 | chore/postgres-18 | - | needs user confirmation |

## Housekeeping done

- Removed merged worktrees and stacks: `core-module-boundaries`, `daily-query-repository`, `dependabot-alerts`, `theme-color-scales`, orphan `planner-antigravity`.
- Archived finished specs to `.specs/completed/` and removed the stale root duplicate of `daily-ux-adjustments`.

## Releases

| Release | Tag | Deploy run | Health | Rollback |
| --- | --- | --- | --- | --- |
| R0 | - | - | - | `CORS_ORIGIN=https://planner.thiagobraga.dev bash scripts/blue-green-deploy.sh "$(cat deploy/.previous-image)"` |
