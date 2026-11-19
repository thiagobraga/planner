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
| M0.1 | Update and merge #436 daily chip names | perf/daily-chip-names | #436 | merged |
| M0.1 | Spec, archive finished specs, close #460 | docs/development-home | #461 | merged; #460 closed |
| M0.3 | S-B backup, restore check, rollback | feat/db-backup-restore | #462 | merged |
| M0.4 | S1 line check, contract check, test fixtures | chore/line-limits-fixtures | #465 | merged |
| M0.5 | S-MCP parent and status tools | feat/mcp-parent-status | #468 | merged `ee8c9d3d` |
| R0 | Release and verify | - | #469 | v0.27.0 deployed and verified |
| M1.6 | S-H task hierarchy reliability | fix/task-hierarchy | #470 | merged `a8f5bfaf` |
| M1.7 | S2 CollectionsPage split | refactor/collections-page-split | #472 | merged `41b9c072` |
| M1.8 | S3 collections split view | feat/collections-split-view | #474 | merged `b410d769` |
| R1a | Release and verify | - | #475 | v0.28.0 deployed and verified |
| M1.9 | S3b toolbar buttons, Window to Planner menu | style/toolbar-buttons | #476 | merged `cc92c5ee` |
| R1 | Release and verify | - | - | v0.28.1 deployed and verified; v0.28.2 also deployed |
| STOP 1 | R1 report, panel/card mock approval | - | - | approved |
| M2.10 | S4 contracts, mutation runner, comment sync | refactor/mutation-runner | - | in progress |
| M2.11 | S5 documents and detail panel (migration 053) | feat/task-documents | - | queued |
| M3.12 | S6 embedded subtasks, five-row cards | feat/embedded-subtasks | - | queued |
| M4.13 | S7 MCP document/comment/claim/batch | feat/mcp-documents | - | queued |
| M4.14 | S8 Markdown import, dry run, undo | feat/markdown-import | - | queued |
| M4.15 | S9 pilot import and cutover | - | - | queued |
| STOP 2 | Report before Postgres upgrade | - | - | - |
| M5.16 | Postgres 16 to 18 | chore/postgres-18 | - | needs user confirmation |

## Decisions from STOP 1

- Progress default: a thin moss bar plus "N of M".
- Task rows inside task content and in Only tasks: 28px min-height, 8px gap, 12px square checkbox.
- Tasks use a square checkbox (3px radius) everywhere, card titles and the panel header included, centered on the title's first line.
- Mocks: https://claude.ai/artifact/HY12ssBqGWYN4aC1wyQgky

## Tracking

Slices are subtasks of the milestone cards M0-M5 in the Planner collection `bulletplanner.org` (`5a0f4e37-e825-49b0-8844-30e0acbc9510`). A slice card moves to Fazendo when its branch opens and is completed when its PR merges.

## Housekeeping done

- Removed merged worktrees and stacks: `core-module-boundaries`, `daily-query-repository`, `dependabot-alerts`, `theme-color-scales`, orphan `planner-antigravity`.
- Removed merged worktrees `collections-page-split`, `collections-split-view`, `task-hierarchy`, `mcp-parent-status` and their ad hoc test containers.
- Archived finished specs to `.specs/completed/` and removed the stale root duplicate of `daily-ux-adjustments`.

## Releases

| Release | Tag | Deploy run | Health | Rollback |
| --- | --- | --- | --- | --- |
| R0 | v0.27.0 | [44392997786](https://github.com/thiagobraga/planner/actions/runs/44392997786) | App and API 200, build `20261118T203858Z`, backup restore check passed | `CORS_ORIGIN=https://planner.thiagobraga.dev bash scripts/blue-green-deploy.sh "$(cat deploy/.previous-image)"` |
| R1a | v0.28.0 | [44510474439](https://github.com/thiagobraga/planner/actions/runs/44510474439) | App 200, API health ok, release published after healthy deploy | same command |
| R1 | v0.28.1 | - | Toolbar shipped, deployed and verified; v0.28.2 also deployed | same command |
