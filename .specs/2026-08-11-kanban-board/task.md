# Kanban Board View — Tasks

Source plan: `plan.md`.

Work in a worktree: `git worktree add ../planner-kanban-board -b feat/kanban-board`, then
`COMPOSE_PROJECT_NAME=planner-claude` / `APP_SUBDOMAIN=codex.planner` in `.env` and
`docker compose up -d`. Mark tasks `[~]` when started, `[x]` when done.

## Milestone 1 — Per-collection task statuses (`api/src/services/statusService.ts`)

- [x] Write `api/src/db/migrations/037_task_statuses.sql` — `task_statuses` table, the two indexes,
      `tasks.status_id` and `tasks.previous_status_id` (both `ON DELETE SET NULL`),
      `idx_tasks_collection_status`. Copy the color CHECK regex verbatim from
      `033_exact_collection_label_colors.sql`.
- [x] Create `api/src/services/statusService.ts` modelled on `sectionService.ts` — `Status` type,
      `formatStatus`, `verifyCollectionAccess` / `verifyStatusAccess`.
- [x] `listStatuses(collectionId, userId)` ordered by `order_value`.
- [x] `ensureCollectionStatuses(collectionId, userId)` — idempotent, opens with
      `SELECT id FROM collections WHERE id = $1 FOR UPDATE`; seeds Backlog / Todo / Doing /
      Completed (only Completed `is_done_like`), names localized from `preferences.locale`; files
      every status-less task — completed into the first done-like, the rest into the first column.
- [x] `createStatus` (append at `MAX(order_value) + 1000`), `updateStatus` (name / color /
      isDoneLike / position, splice-and-rewrite siblings), `deleteStatus` with
      `reassignToStatusId` and a 409 on the collection's last status.
- [x] Publish `entityType: 'status'` with `collectionId` from all four mutations.
- [x] Add `"status"` to `SyncEntityType` (`api/src/services/syncService.ts:18`) and
      `app/src/hooks/useSync.ts:6`; add the invalidation branch in `AppShell.tsx:36-49`.
- [x] Create `api/src/routes/statuses.ts` (five endpoints per plan) and mount it in
      `api/src/routes/index.ts`.
- [x] Both `formatTask` copies (`taskService.ts:32`, `viewService.ts:35`) gain
      `statusId: row.status_id`.
- [x] Tests: `services/__tests__/statusService.test.ts`, `routes/__tests__/statuses.test.ts`.
- [x] Verify: `docker compose exec api npm run build && docker compose exec api npm run lint && docker compose exec api npm test`
- [x] Commit: `feat(api): add per-collection task statuses`

## Milestone 2 — Completion sync (`api/src/services/completionSync.ts`)

- [x] Create `completionSync.ts` with `syncCompletionToStatus` and `syncStatusToCompletion`, both
      taking an open `PoolClient`.
- [x] `syncCompletionToStatus` — done-like sets `is_completed`/`completed_at` and cascades to
      descendants with the same recursive CTE as `completeTask` (`taskService.ts:176-190`);
      non-done-like clears both without cascading; returns null when already aligned. Record the
      matching activity event.
- [x] `syncStatusToCompletion` — on complete write `previous_status_id` then the first done-like
      status; on reopen restore `COALESCE(previous_status_id, first non-done-like)` and clear it.
- [x] Wire into `completeTask` (`taskService.ts:81`) and `reopenTask` (`:623`).
- [x] Wire into `statusService.updateStatus` when `isDoneLike` flips.
- [x] Confirm `updateTask` does **not** accept `statusId` — a fifth call site is forbidden.
- [x] Tests: `services/__tests__/completionSync.test.ts`.
- [x] Verify: `docker compose exec api npm run build && docker compose exec api npm run lint && docker compose exec api npm test`
- [x] Commit: `feat(api): reconcile completion with done-like statuses`

## Milestone 3 — Labels, implemented (`api/src/services/labelService.ts`)

- [x] `createTask` — verify `labelIds` ownership, bulk-insert `task_labels`; keep the single-query
      fast path when no labels are given.
- [x] `updateTask` — when `labelIds !== undefined`, replace the whole set; the transaction
      condition at `taskService.ts:554` becomes `shiftsDescendants || input.labelIds !== undefined`.
- [x] `labelService.attachLabels<T extends {id}>(tasks)` — one query per page, no N+1.
- [x] Apply `attachLabels` in `getCollectionView`, `getInboxView`, and the single-task returns of
      create / update / complete / reopen.
- [x] `labelService.ensureSeedLabels(userId)` — `feature` / `bug` / `chore`, only for a user with
      no labels at all. The status seed endpoint invokes it on first board open.
- [x] Add `publishEvent` to `labelService` create / update / delete (it publishes nothing today).
- [x] Tests: `services/__tests__/taskService.labels.test.ts`; extend
      `routes/__tests__/views.test.ts` for per-task `labels`.
- [x] Verify: `docker compose exec api npm run build && docker compose exec api npm run lint && docker compose exec api npm test`
- [x] Commit: `feat(api): implement task labels end to end` (implementation plus follow-up coverage
      and invariant hardening)

## Milestone 4 — Board ordering scopes in `moveTask` (`api/src/services/taskService.ts`)

- [ ] Write `api/src/db/migrations/038_task_order_board_scopes.sql` — widen the
      `task_order_scope_type_check` CHECK to `('day','collection','status','priority')`.
- [ ] Extend `TaskOrderScope` with `status` and `priority`; extend `MoveTaskInput` with `statusId`
      and `priority` (root only).
- [ ] Extend `validateMoveInput` (`:758`) for both new fields and both new scope kinds.
- [ ] Destination resolution: a cross-collection move nulls `status_id` unless one is given
      explicitly.
- [ ] Root UPDATE (`:932`) writes `status_id` and, when provided, `priority`.
- [ ] Call `syncCompletionToStatus` right after the root UPDATE, only when the destination status
      differs.
- [ ] Generalize `renumberDayScope` (`:1192`) into
      `renumberOrderTableScope(client, { scopeType, scopeId, … })`; route `status` and `priority`
      to it. Leave `renumberCollectionScope` (`:1117`) untouched for `collection` / `section`.
- [ ] `MovedTaskSummary` (`:817`) gains `statusId`, `priority`, `isCompleted`.
- [ ] Correct the stale comment at `:946-947`.
- [ ] Tests: `taskService.move.status.test.ts` (asserts `order_value` is **never** written),
      `taskService.move.priority.test.ts`; extend `taskService.property.test.ts`.
- [ ] Verify: `docker compose exec api npm run build && docker compose exec api npm run lint && docker compose exec api npm test`
- [ ] Commit: `feat(api): add board ordering scopes to task move`

## Milestone 5 — Board view preferences (`api/src/services/preferencesService.ts`)

- [ ] Write `api/src/db/migrations/039_preferences_board_view.sql` — `board_view_modes JSONB NOT
      NULL DEFAULT '{}'`.
- [ ] Update all six sites: `PreferencesRow` (:6), `formatPreferences` (:23) with `?? {}`,
      `VALID_GROUP_BYS` / `VALID_VIEW_MODES` (near :42), `UpdatePreferencesInput` (:64),
      `validatePreferences` (:80) — UUID keys, enum values, ≤200 keys — and the `setClauses` branch
      (:180-231).
- [ ] Add `statuses` and `boardOrder` to `getCollectionView` and `getInboxView`.
- [ ] Confirm `provisionUser.ts` and `seed.ts` need no change (they rely on column defaults).
- [ ] Tests: extend `services/__tests__/preferencesService.test.ts` and
      `routes/__tests__/views.test.ts`.
- [ ] Verify: `docker compose exec api npm run build && docker compose exec api npm run lint && docker compose exec api npm test`
- [ ] Commit: `feat(api): persist per-collection board view preferences`

## Milestone 6 — Playwright harness (`e2e/`)

- [ ] Create `e2e/package.json` with `@playwright/test` only.
- [ ] `e2e/playwright.config.ts` — `baseURL` from `E2E_BASE_URL` (default
      `https://planner.local`), `ignoreHTTPSErrors: true`, chromium project, trace/video on first
      retry, `retries: 1` in CI.
- [ ] `e2e/global-setup.ts` — register a throwaway user over the REST API, write
      `storageState.json` with `planner_token` in localStorage.
- [ ] `e2e/fixtures/api.ts` — authed fetch helper; specs build their own data over the API and
      never share a collection.
- [ ] `e2e/fixtures/drag.ts` — `dragCard(page, from, to)` using
      `mouse.move → mouse.down → several mouse.move steps → mouse.up` with a settle after `down`.
      `locator.dragTo()` does **not** clear dnd-kit's 6px activation distance.
- [ ] Add an `e2e` compose profile service on `mcr.microsoft.com/playwright:v1.x-noble`.
- [ ] `e2e/specs/api/statuses.spec.ts` — DB-backed CRUD, seeding idempotency, last-column 409.
- [ ] `e2e/specs/api/task-move.spec.ts` — status/priority scopes write `task_order`, leave
      `order_value` untouched, cross-collection nulls `status_id`.
- [ ] Add the CI job to `.github/workflows/quality.yml` (boot the stack, wait for health, run the
      suite, upload traces on failure).
- [ ] Add `e2e/storageState.json`, `e2e/test-results/`, `e2e/playwright-report/` to `.gitignore`.
- [ ] Document the commands and the Vitest-vs-Playwright split in `CLAUDE.md`, `AGENTS.md` and
      `GEMINI.md`.
- [ ] Verify: `docker compose --profile e2e run --rm e2e`
- [ ] Commit: `chore(e2e): add playwright harness`

## Milestone 7 — Board drag plumbing (`app/src/types/drag.ts`)

- [ ] Extend `DragKind` with `'board-column'`; extend `DropKind` with `'board-column'`,
      `'board-column-header'`, `'card-subtasks'`; add `BoardGroupBy` and the four data interfaces.
- [ ] Extend the `collision.ts` allow-matrix and `CONTAINER_KINDS`; teach `containerIdOf` the two
      new container kinds.
- [ ] **Fix `collision.ts:121`** — iterate `containerHits` in `pointerWithin` order instead of
      `containers.find(c => hitIds.has(c.id))`, so a nested `card-subtasks` beats its column.
- [ ] Add the `enabled` option to `usePlannerDragHandlers` (`contexts/usePlannerDrag.ts`) and skip
      registration when false.
- [ ] Make `AUTO_SCROLL` (`PlannerDragContext.tsx:72`) provider state with a `setAutoScrollAxis`
      setter.
- [ ] Create `app/src/utils/boardColumns.ts` — `buildColumns`, `buildColumnId`, `parseColumnId`.
- [ ] Extend `app/src/api/client.ts` — status bindings, label bindings, and the type extensions to
      `TaskOrderScope`, `TaskMoveInput`, `MovedTaskSummary`, `ApiTask`, `Preferences`,
      `CollectionView`.
- [ ] Tests: `utils/__tests__/boardColumns.test.ts`; extend `collision.test.ts` (existing cases
      must stay green) and `PlannerDragContext.test.tsx` for `enabled: false`.
- [ ] Verify: `docker compose exec app npm run build && docker compose exec app npm run lint && docker compose exec app npm test`
- [ ] Commit: `feat(app): add board column model and drag plumbing`

## Milestone 8 — Board UI, static (`app/src/components/board/`)

- [ ] `BoardView.tsx` — horizontal grid, owns the `SortableContext`s, sets the auto-scroll axis on
      mount and restores on unmount.
- [ ] `BoardColumn.tsx` (with `data-column-id`), `BoardColumnHeader.tsx`, `BoardCard.tsx` (with
      `data-card-id`), `BoardCardChecklist.tsx`, `AddColumnButton.tsx`.
- [ ] `CollectionBoard.tsx` — the single component both pages mount.
- [ ] `components/ui/GroupBySelect.tsx` wrapping the existing `CustomSelect`.
- [ ] Add `--planner-board-column-bg` and `--planner-board-card-bg` to `AppShell.tsx:55-81` for
      both background themes.
- [ ] Column and card CSS per the design section — translucent tint, 1px border, **no box-shadow**,
      no side stripes, 24px rhythm, 288px column width.
- [ ] Add every i18n key to **both** `en.ts` and `pt-BR.ts` (`toolbar.list` / `toolbar.kanban`
      already exist — do not re-add).
- [ ] Add a Board card to `StyleguidePage.tsx` driving the real components.
- [ ] Tests: `BoardCard.test.tsx`, `BoardColumn.test.tsx`, `BoardView.test.tsx`.
- [ ] Verify: `docker compose exec app npm run build && docker compose exec app npm run lint && docker compose exec app npm test`
- [ ] Commit: `feat(app): render the kanban board`

## Milestone 9 — Card drag (`app/src/hooks/useBoardDrag.ts`)

- [ ] `useBoardDrag` registering `DragKind: 'task'` with `enabled: view === 'kanban'`; export
      `resolveBoardMove` and `applyBoardMoveLocally` as pure functions.
- [ ] Resolve drops for all three group-by modes, plus `card-subtasks` → reparent.
- [ ] Optimistic apply, `trackMove` echo suppression, reconciliation from `MovedTaskSummary`.
- [ ] Done-like columns tick the card optimistically.
- [ ] a11y announcements using the `board.a11y.*` keys.
- [ ] Set `enabled: view === 'list'` on the existing `useTaskDrag` call sites.
- [ ] Tests: `useBoardDrag.test.ts`, `useBoardDrag.reparent.test.ts`,
      `useBoardDrag.completion.test.ts`.
- [ ] Verify: `docker compose exec app npm run build && docker compose exec app npm run lint && docker compose exec app npm test`
- [ ] Commit: `feat(app): drag cards between board columns`

## Milestone 10 — Column CRUD (`app/src/hooks/useBoardColumnDrag.ts`)

- [ ] `useBoardColumnDrag` registering `'board-column'`, dispatching to `apiUpdateStatus({position})`
      or `apiUpdateSection({position})` by group-by mode.
- [ ] Inline rename via `InlineNameInput`; recolor via `ColorPickerPopover`; done-like toggle in the
      `⋯` `ContextMenu`.
- [ ] `ColumnDeleteModal.tsx` — reassign-or-delete, modelled on `SectionDeleteModal`.
- [ ] Surface the last-column 409 and the label-name 400 as messages, not swallowed errors.
- [ ] Confirmation dialog before flipping `isDoneLike` on a non-empty column.
- [ ] Tests: extend the board component tests.
- [ ] Verify: `docker compose exec app npm run build && docker compose exec app npm run lint && docker compose exec app npm test`
- [ ] Commit: `feat(app): reorder, rename and delete board columns`

## Milestone 11 — Page wiring (`app/src/pages/`)

- [ ] `hooks/useBoardPreferences.ts` — read/write `preferences.boardViewModes[collectionId]`.
- [ ] `CollectionsPage.tsx` — mount `ViewToolbar` + `GroupBySelect` in the header toolbar, branch
      between the list JSX and `CollectionBoard`.
- [ ] `InboxPage.tsx` — same, with the collection id from `data.inboxCollectionId` and a loading
      state until it resolves.
- [ ] Tests: `pages/__tests__/CollectionsPage.kanban.test.tsx`.
- [ ] Verify: `docker compose exec app npm run build && docker compose exec app npm run lint && docker compose exec app npm test`
- [ ] Commit: `feat(app): wire the board into collection and inbox pages`

## Milestone 12 — Board e2e (`e2e/specs/board/`)

- [ ] `seed.spec.ts` — first open seeds exactly four columns; reload does not seed eight.
- [ ] `drag-card.spec.ts` — drag between columns persists across reload.
- [ ] `completion-sync.spec.ts` — drop into Completed strikes it through in List; unticking there
      returns the card to its previous column.
- [ ] `order-isolation.spec.ts` — **the decision-4 guard**: reorder inside a column, switch to
      List, list order unchanged.
- [ ] `group-by.spec.ts` — Priority mode renders exactly four columns; dragging changes the flag.
- [ ] `subtask-reparent.spec.ts` — drag a subtask onto another card; both counts update.
- [ ] `columns.spec.ts` — rename, recolor, reorder, delete-with-reassign, last-column 409.
- [ ] Verify: `docker compose --profile e2e run --rm e2e npx playwright test specs/board`
- [ ] Commit: `test(e2e): cover the kanban board end to end`

## Milestone 13 — Label chips in the list view (`app/src/components/TaskItem.tsx`)

- [ ] Change `Task.labels` from `string[]` to `LabelSummary[]` and update `apiToTask` in both pages.
- [ ] Render chips in `TaskItem` using the same `<Chip>` treatment as the board.
- [ ] Tests: extend `components/__tests__/TaskItem.test.tsx`.
- [ ] Verify: `docker compose exec app npm run build && docker compose exec app npm run lint && docker compose exec app npm test`
- [ ] Commit: `feat(app): show label chips in the list view`

## Verification (whole spec)

- [ ] `docker compose exec api npm run build && docker compose exec api npm run lint`
- [ ] `docker compose exec app npm run build && docker compose exec app npm run lint`
- [ ] `docker compose exec api npm test && docker compose exec app npm test`
- [ ] `docker compose --profile e2e run --rm e2e`
- [ ] Restart the api container twice — migrations 037/038/039 apply once and are idempotent.
- [ ] Manual: horizontal auto-scroll on a wide board.
- [ ] Manual: both background themes — dot grid reads through columns and cards, no shadows, no
      colored stripes.
- [ ] Manual: 24px baseline holds for column and card heights; accent under budget.
- [ ] Manual: `/styleguide` shows the Board specimen.
- [ ] Manual: board on `/inbox`; view + group-by survive a reload and stay per-collection.
- [ ] `docker compose down -v` and `git worktree remove ../planner-kanban-board`.
- [ ] Open the PR against `main` and hand the link to the user.
