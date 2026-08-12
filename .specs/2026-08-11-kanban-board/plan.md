# Kanban Board View — Plan

## Context

Planner today renders a collection as a single vertical list grouped by section. We want a second
way to read the same collection: a horizontal board of columns, with cards that carry a tag chip, a
priority flag, a subtask checklist and a completion date.

The board is not a new data silo — it is a second projection of the tasks that already exist. The
"Agrupar por" control decides what the columns mean, so one board can be re-sliced by workflow
stage, by section, or by priority without moving any data.

The repo already has most of the machinery: `@dnd-kit` behind a single app-wide `DndContext` with a
per-kind handler registry, a transactional `PATCH /tasks/:id/move` endpoint, a `ViewToolbar` that
already ships a List/Kanban segmented control (never wired to a page), and a `task_order` side table
whose own migration comment says it was shaped to absorb more ordering scopes later.

What is genuinely missing: any notion of workflow status, and working labels — `task_labels` exists
and `labelIds` is declared on create/update but **never read**, so no code path has ever written a
task's labels.

### Scope decisions (agreed)

| # | Decision |
|---|---|
| 1 | **Statuses are per-collection.** Renaming a column on one board never touches another. |
| 2 | Seeded on first board open: **Backlog, Todo, Doing, Completed**. Renameable, recolorable, reorderable, deletable. |
| 3 | **Done stays in sync with `is_completed`.** Each collection owns exactly one `completion_status_id`; dropping into that status completes the task, completing in list view moves the card there, and reopening moves it back. |
| 4 | **Board order is separate from list order.** Board drags write `task_order`, never `tasks.order_value`. Tidying the board never shuffles the list. |
| 5 | **Group-by modes in v1: Status, Section, Priority.** All three fully draggable. |
| 6 | **Group-by Label is deferred to v2** (see Out of scope). |
| 7 | **Labels get implemented for real** — chips on cards *and* in list rows. |
| 8 | Cards show a subtask checklist **and** a `2/3` count. Children never render as their own cards. |
| 9 | Dragging a subtask from one card to another reparents it. |
| 10 | Board reachable on `/collection/:id` and `/inbox`; view + group-by persist per collection, server-side. |
| 11 | **Playwright is introduced here** as the project's long-term integration + e2e harness, not a one-off. |

### Assumptions

- Grouped by **Section**, the board reuses `tasks.order_value` — it is the same grouping dimension
  the list already orders within, so a second order there would be the churn decision 4 avoids.
  Only Status and Priority columns get their own order.
- Playwright is the only way to test dnd-kit dragging for real (jsdom has no element rects or
  pointer coordinates) and the only place this repo will have DB-backed API coverage. Set up so
  later features just add spec files.

### Out of scope (v2)

Group-by **Label**. Deferred deliberately: labels are account-wide while columns are per-collection,
so a label board needs a rule for which labels appear; and a task carrying three labels renders as
three cards sharing one `taskId`, which breaks the `over.taskId === active.taskId` identity checks
throughout the drag layer. v1 keeps `columnId` one-card-one-task. Recorded for v2: dropping into a
*No label* column strips all labels. The `BoardGroupBy` union and the group-by select are built to
take a fourth member; adding it later is additive.

---

## Migrations

Claim all three numbers in one commit — `031_` is already duplicated and `migrate.ts:30-33` sorts
lexically.

### `api/src/db/migrations/037_task_statuses.sql`

```sql
CREATE TABLE task_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  name VARCHAR(60) NOT NULL,
  color VARCHAR(64) NOT NULL DEFAULT '#adb9c1',
  is_done_like BOOLEAN NOT NULL DEFAULT false,
  order_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT task_statuses_color_format
    CHECK (color ~* '^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]+\)|hsla?\([^)]+\))$')
);

CREATE UNIQUE INDEX idx_task_statuses_collection_name ON task_statuses(collection_id, LOWER(name));
CREATE INDEX idx_task_statuses_collection_order ON task_statuses(collection_id, order_value);

-- SET NULL, never CASCADE: deleting a column must not delete work.
ALTER TABLE tasks ADD COLUMN status_id UUID REFERENCES task_statuses(id) ON DELETE SET NULL;
-- Where the task sat before completion moved it, so reopen returns it to its real column.
ALTER TABLE tasks ADD COLUMN previous_status_id UUID REFERENCES task_statuses(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_collection_status ON tasks(collection_id, status_id);
```

Reuse the color CHECK regex verbatim from `033_exact_collection_label_colors.sql`.
Seeding is **not** in the migration — it needs one row set per collection plus a task backfill, so
it lives in `statusService.ensureCollectionStatuses()` and runs on first board open.

### `api/src/db/migrations/038_task_order_board_scopes.sql`

```sql
-- 025 shaped this table to absorb more scopes; this is that.
ALTER TABLE task_order DROP CONSTRAINT task_order_scope_type_check;
ALTER TABLE task_order ADD CONSTRAINT task_order_scope_type_check
  CHECK (scope_type IN ('day', 'collection', 'status', 'priority'));
```

`scope_id` is already `VARCHAR(64)` — holds a status UUID or `'1'`..`'4'` unchanged.

### `api/src/db/migrations/039_preferences_board_view.sql`

```sql
-- { "<collection-uuid>": { "view": "kanban", "groupBy": "status" } }
ALTER TABLE preferences ADD COLUMN board_view_modes JSONB NOT NULL DEFAULT '{}'::jsonb;
```

A JSONB map, not the `UUID[]` shape of `036`: `groupBy` is an enum, so arrays would mean three more
columns plus an unenforced "a collection appears in at most one" invariant. Not its own table
either — it is a UI preference, and a table would split the single `['preferences']` query the whole
app already reads. Inbox needs no special case; it is a collection row with `is_inbox = true`.

`provisionUser.ts` and `seed.ts` need **no change** — both `INSERT INTO preferences (user_id)` and
rely on column defaults.

### `api/src/db/migrations/040_collection_completion_status.sql`

This forward migration replaces the original per-status `is_done_like` flag after `037` has already
run in development. It adds nullable `collections.completion_status_id`, backfills the first
configured done-like status (or the last ordered column on legacy boards with none), enforces that the referenced status belongs to the same
collection, and then drops `task_statuses.is_done_like`. The pointer is nullable only before the
board's statuses are first seeded; after seeding, the service maintains exactly one completion
status per collection.

---

## Backend

### `api/src/services/completionSync.ts` (new)

The single place `tasks.is_completed` and `collections.completion_status_id` reconcile. Its own module to avoid a
`taskService ↔ statusService` import cycle.

```ts
syncCompletionToStatus(client, { taskId, userId, statusId, collectionId })
  // completion status + not completed -> set is_completed/completed_at, cascade to descendants
  //                               (same recursive CTE as completeTask, taskService.ts:176-190)
  // other status + completed        -> clear both, no cascade (matches reopenTask)
  // already aligned            -> null

syncStatusToCompletion(client, { taskId, userId, collectionId, isCompleted })
  // completing -> previous_status_id = status_id; status_id = collection.completion_status_id
  // reopening  -> status_id = COALESCE(previous_status_id, first other status); clear previous
```

Both take an open `PoolClient` so they run inside the caller's transaction. **Exactly four call
sites:** `completeTask`, `reopenTask`, `moveTask` (only when the destination status differs), and
the collection-level completion-status mutation when the canonical status changes.

**`updateTask` must never accept `statusId`.** It is the obvious next request and granting it adds a
fifth site that will drift. Column changes go through `moveTask`.

### `api/src/services/statusService.ts` (new)

Modelled on `sectionService.ts` — same `verifyCollectionAccess`/`verifyStatusAccess` pair, same
splice-and-rewrite reorder — plus the `publishEvent` calls sections are missing.

- `listStatuses(collectionId, userId)`
- `ensureCollectionStatuses(collectionId, userId)` — idempotent; takes
  `SELECT id FROM collections WHERE id = $1 FOR UPDATE` so two tabs cannot double-seed. Creates the
  four defaults, writes `collections.completion_status_id` to Completed, then files every status-less
  task: completed ones into that column, the rest into the first other column. Assigning explicitly (rather than treating `NULL` as "first
  column" at render time) keeps one state to one representation.
- `createStatus` / `updateStatus` / `deleteStatus(statusId, userId, { reassignToStatusId })` —
  creation locks the collection and makes the first manually created status canonical; delete is
  409 on the collection's last status; deleting the completion status requires a
  same-collection reassignment, which becomes the new completion status.
- `setCollectionCompletionStatus(collectionId, userId, statusId)` — validates ownership, updates
  the single collection pointer, completes tasks already in the new status, and reopens tasks in
  the former status in one transaction.

Default names are localized server-side from `preferences.locale` (they become user-owned data the
moment they exist, so they are not i18n keys):
`Backlog / Todo / Doing / Completed` · `Backlog / A fazer / Fazendo / Concluído`.
The seeded `Completed` status is written to `collections.completion_status_id`.

All status mutations publish `entityType: 'status'` with `collectionId` set.
`SyncEntityType` (`syncService.ts:18`) and `app/src/hooks/useSync.ts:6` both gain `"status"`;
`AppShell.tsx:36-49` gains a branch invalidating `['collection']`.

### Labels, implemented

- `createTask` — when `input.labelIds?.length`, verify ownership
  (`WHERE id = ANY($1::uuid[]) AND user_id = $2`, 400 on mismatch) then bulk-insert `task_labels`.
  Promote to a transaction only when labels are present; keep the single-query fast path otherwise.
- `updateTask` — when `labelIds !== undefined`, replace the whole set. The transaction condition at
  `taskService.ts:554` becomes `shiftsDescendants || input.labelIds !== undefined`.
- `labelService.attachLabels<T extends {id}>(tasks)` — **one** query for a whole page; N+1 is not
  acceptable on a board. Applied by `getCollectionView`, `getInboxView`, and the single-task returns
  of create/update/complete/reopen. `formatTask` stays a synchronous row→DTO mapper.
- `labelService.ensureSeedLabels(userId)` — creates `feature`/`bug`/`chore`, only for a user with no
  labels at all.
- `labelService` create/update/delete gain `publishEvent` — today it publishes nothing, violating
  the CLAUDE.md rule.
- **Note:** `labels.name` is regex-constrained to `/^[a-zA-Z0-9_]+$/` (`labelService.ts:6`). The
  chip/rename UI must surface that 400 rather than swallow it.

### `moveTask` — extend, do not add endpoints

Every board drag is still a move: list membership + position, sometimes parent. Splitting it into
`PATCH /status` + `PATCH /reorder` is two transactions and two sync events for one gesture — exactly
the partial-move failure the function's own docblock (`taskService.ts:837-845`) exists to prevent.
The client also already has one hardened path (`apiMoveTask` → `trackMove` → optimistic patch →
reconcile via `affectedIds`), including the echo suppression in `utils/moveEcho.ts`.

```ts
export type TaskOrderScope =
  | { kind: 'collection'; collectionId: string }
  | { kind: 'day';        dueDate: string }
  | { kind: 'section';    sectionId: string }
  | { kind: 'status';   collectionId: string; statusId: string | null }   // NEW
  | { kind: 'priority'; collectionId: string; priority: number };         // NEW

export interface MoveTaskInput {
  parentTaskId: string | null;
  collectionId?: string;
  sectionId?: string | null;
  dueDate?: string | null;
  statusId?: string | null;   // NEW — root only, never descendants
  priority?: number;          // NEW — root only
  scope: TaskOrderScope;
  position: number;
}
```

- `validateMoveInput` (`:758`) gains `statusId` string|null, `priority` int 1-4, and the two new
  scope kinds with their required fields.
- **A cross-collection move nulls `status_id`** unless one is given explicitly — statuses belong to a
  collection and the FK will not stop a foreign id. The target's seeder reassigns on next open.
- Root UPDATE (`:932`) gains `status_id` and, when provided, `priority`.
- One completion call right after the root UPDATE:
  `if (destStatusId !== task.status_id) await syncCompletionToStatus(client, …)`.
- **Ordering.** `renumberDayScope` (`:1192`) generalizes to
  `renumberOrderTableScope(client, { scopeType, scopeId, … })` — identical logic, the two literals
  become parameters. `status` and `priority` scopes route to it; `collection` and `section` keep
  `renumberCollectionScope` (`:1117`) untouched. This is decision 4 made concrete: board positions
  land in `task_order`, `tasks.order_value` is never written by a board drag.
- `MovedTaskSummary` (`:817`) gains `statusId`, `priority`, `isCompleted` so the board reconciles
  without a refetch. Additive — `useTaskDrag.ts:185-217` reads fields by name.
- Correct the comment at `:946-947` ("completion, priority … never written here") — they are now,
  on the root only.
- Published sync event keeps its shape (`payload: { ...root, affectedIds }`).

### Read path

Extend `getCollectionView` (`viewService.ts:299`) and `getInboxView` — do not add a board endpoint.
One query key `['collection', id]` means switching list↔board is instant with no refetch and no
cache split, and the list view needs labels anyway.

Both gain:
- `statuses: Status[]` (one indexed SELECT),
- `attachLabels` over the task array,
- `boardOrder: { status: Record<taskId, number>; priority: Record<taskId, number> }` — one SELECT on
  `task_order` for this collection's tasks where `scope_type IN ('status','priority')`. A task with
  no row falls back to `order_value`, then `created_at`.

**Both copies of `formatTask`** (`taskService.ts:32` *and* `viewService.ts:35`) gain
`statusId: row.status_id`.

Seeding stays out of the GET: the board sees `statuses.length === 0` on mount, fires
`POST /collections/:id/statuses/seed` once, then invalidates.

### Routes — `api/src/routes/statuses.ts` (new)

Mirrors `routes/sections.ts`; mounted `router.use("/", statusRoutes)` in `routes/index.ts`.

```
GET    /api/v1/collections/:id/statuses
POST   /api/v1/collections/:id/statuses          { name, color? }
POST   /api/v1/collections/:id/statuses/seed     -> Status[]  (idempotent)
PATCH  /api/v1/statuses/:id                      { name?, color?, position? }
PATCH  /api/v1/collections/:id/completion-status { statusId }
DELETE /api/v1/statuses/:id?reassignTo=<uuid>
```

### Preferences

Six sites in `preferencesService.ts`: `PreferencesRow` (:6), `formatPreferences` (:23) with
`?? {}`, new `VALID_GROUP_BYS = ['status','section','priority']` and
`VALID_VIEW_MODES = ['list','kanban']` near :42, `UpdatePreferencesInput` (:64),
`validatePreferences` (:80) — every key a UUID, every value `{ view?, groupBy? }` from the valid
sets, **≤200 keys** to bound growth — and one `board_view_modes = $n` clause at :180-231. Keys for
deleted collections are inert; no pruning.

---

## Frontend

### Drag types — `app/src/types/drag.ts`

Cards **reuse `DragKind: 'task'`** and register as `DropKind: 'task'` droppables with
`containerId = boardContainerId(columnId)`. `containerIdOf` (`collision.ts:48-58`) already handles
`'task'`, so no new row kind is needed and "rows win inside their own container" works unchanged.

```ts
DragKind  += 'board-column'
DropKind  += 'board-column'         // the column body — a container
           + 'board-column-header'  // the row a column drag reorders against
           + 'card-subtasks'        // a card's checklist region

type BoardGroupBy = 'status' | 'section' | 'priority';   // 'label' reserved for v2
```

The `board-column` / `board-column-header` split mirrors the existing `section` /
`section-header` split, for the reason documented at `drag.ts:19-23`.

`columnId` is one synthetic id space so a column is addressable uniformly:
`status:<uuid>` · `section:<uuid>` | `section:none` · `priority:1`..`priority:4`.

### Collision — `app/src/components/dnd/collision.ts`

- allow-matrix: `task` gains `'board-column'`, `'card-subtasks'` (keep `'collection'` — filing a
  card into a sidebar collection still works); `'board-column'` → `{'board-column-header'}`.
- `CONTAINER_KINDS` gains both; `containerIdOf` maps `board-column` → `data.containerId` and
  `card-subtasks` → `` `card:${data.taskId}` ``.
- **Required fix at :121.** `containers.find(c => hitIds.has(c.id))` picks by set membership and
  throws away `pointerWithin`'s distance ranking. A `card-subtasks` region nests inside a
  `board-column`, so both hit and the winner is registration-order-dependent. Iterate
  `containerHits` in order and take the first matching container. Behaviour-visible to existing
  drags — the current `collision.test.ts` must stay green.

### Handler-registry conflict — `app/src/contexts/usePlannerDrag.ts`

`registerHandlers` holds **one** handler set per `DragKind` (`PlannerDragContext.tsx:108`), and both
`useTaskDrag` and the new `useBoardDrag` claim `'task'`. Hooks cannot be conditional, so both run on
a page that can switch views. Add a ~5-line `enabled` option:

```ts
usePlannerDragHandlers(kind, handlers, { enabled?: boolean })  // default true; false = no registration
```

`useTaskDrag` gets `enabled: view === 'list'`, `useBoardDrag` gets `enabled: view === 'kanban'`.
Without this a stale registration silently swallows every drag after a view switch.

### Auto-scroll

`AUTO_SCROLL` (`PlannerDragContext.tsx:72`) is `{ x: 0, y: 0.08 }` app-wide — horizontal scroll is
deliberately off ("sideways movement means nesting here, never travel"). The board is the app's
first horizontally-scrolling surface. Make it provider state with a `setAutoScrollAxis` setter;
`BoardView` sets `{ x: 0.12, y: 0.08 }` on mount and restores on unmount. Without it, a card cannot
reach an off-screen column.

### New files

```
app/src/utils/boardColumns.ts                  buildColumns / buildColumnId / parseColumnId —
                                               pure, the unit-test centre of gravity
app/src/hooks/useBoardDrag.ts                  registers 'task'; exports resolveBoardMove +
                                               applyBoardMoveLocally for direct testing
app/src/hooks/useBoardColumnDrag.ts            registers 'board-column'
app/src/hooks/useBoardPreferences.ts           reads/writes preferences.boardViewModes[collectionId]
app/src/components/board/BoardView.tsx         horizontal grid; owns the SortableContexts
app/src/components/board/BoardColumn.tsx       header + droppable body + add-card input
app/src/components/board/BoardColumnHeader.tsx name (InlineNameInput), count, color dot,
                                               ⋯ ContextMenu (recolor / completion status / delete)
app/src/components/board/BoardCard.tsx         title, chips, priority flag, checklist, done date
app/src/components/board/BoardCardChecklist.tsx subtask rows — draggable task + Checkbox
app/src/components/board/AddColumnButton.tsx
app/src/components/board/ColumnDeleteModal.tsx reassign-or-delete, per SectionDeleteModal
app/src/components/ui/GroupBySelect.tsx        wraps the existing CustomSelect
app/src/components/CollectionBoard.tsx         the one component both pages mount
```

API bindings go in the existing `app/src/api/client.ts` (one client module; every test mocks it by
path): `fetchStatuses`, `apiSeedStatuses`, `apiCreateStatus`, `apiUpdateStatus`, `apiDeleteStatus`,
`fetchLabels`, `apiCreateLabel`, plus type extensions to `TaskOrderScope`, `TaskMoveInput`,
`MovedTaskSummary`, `ApiTask` (`labels`, `statusId`), `Preferences.boardViewModes`, `CollectionView`
(`statuses`, `boardOrder`).

`utils/moveEcho.ts` needs no change — board drags go through `apiMoveTask`.

### Page duplication — the pragmatic call

**Do not unify `CollectionsPage` and `InboxPage`.** They differ on 504 of 909 + 719 lines; unifying
them is its own multi-day change with real list-view regression risk, and it is not what this
feature needs. Extract only the board surface — each page gains ~25 lines:

```tsx
const { view, groupBy, setView, setGroupBy } = useBoardPreferences(collectionId);
useTaskDrag({ …, enabled: view === 'list' });
// toolbar gains <ViewToolbar view onViewChange /> + <GroupBySelect />
{view === 'kanban'
  ? <CollectionBoard collectionId={collectionId} tasks={tasks} setTasks={setTasks}
                     sections={sections} statuses={statuses} groupBy={groupBy} … />
  : <>{/* existing list JSX, untouched */}</>}
```

`CollectionBoard` owns `useBoardDrag`, `useBoardColumnDrag` and all column/card state. For `/inbox`
the collection id is `data.inboxCollectionId` (`viewService.ts:294`); the board shows a loading
state until it is known. Log the ~25 duplicated lines as debt.

---

## Design treatment

Bound by `DESIGN.md`: Page-Shows-Through (:214), no side stripes >1px (:323), flat elevation, 24px
baseline (:196), Lora only, accent ≤10%.

- **Column** — `background: color-mix(in srgb, var(--planner-board-column-bg) 22%, transparent)`, a
  *tint* so the dot grid reads through. `1px solid var(--color-border)`, radius 8px, **no
  box-shadow**. Width 288px (12 × 24), gap 24px, padding 12px, 24px header→first card.
- **Column header** — Label style (Lora 500, 11px/24px, uppercase, `.1em`), 7px status-color dot,
  ink-light count. **No colored top bar, no left stripe.**
- **Card** — `color-mix(in srgb, var(--planner-board-card-bg) 55%, transparent)`, 1px border, radius
  6px, padding 12px, **no shadow** — the drag overlay is the only shadowed surface and reuses
  `.planner-drag-overlay`. Every internal row 24px tall. Title Lora 400 14px/24px.
- **Priority** — lucide `Flag` + word, colored from the existing `taskPriorityClasses.ts` map.
  P1 accent · P2 `priority-2` · P3 `priority-3` · **P4 hidden** (it is the default).
- **Label chips** — existing `<Chip>` with `color-mix(in srgb, <label-color> 18%, transparent)` so a
  busy board cannot blow the accent budget.
- **Completion date** — Caption (Lora 400 italic, 12px/24px, ink-light) + small `Check`.
- **Drop indicator** — 2px `--color-dot` rule at the insertion index, matching the list idiom. Not a
  ghost card.
- **New shell tokens** in `AppShell.tsx:55-81`, following the beige/white pattern:
  `--planner-board-column-bg` (`#dcd6cc` / `#e8e8e8`), `--planner-board-card-bg`
  (`var(--color-cream)` / `#ffffff`).
- Motion `var(--motion-fast)` ease-out, no bounce.

Add a Board card to `StyleguidePage.tsx` driving the real `BoardColumn`/`BoardCard`, per the
"specimen drives the component" rule (`DESIGN.md:293`).

---

## i18n

`TranslationKey = keyof typeof englishCatalog`, so a key added to `en.ts` without `pt-BR.ts` is a
compile error. `toolbar.list` / `toolbar.kanban` **already exist** — verify, do not re-add.

```
board.groupBy 'Group by' | 'Agrupar por'
groupBy.status/.section/.priority
board.addColumn · board.addCard · board.noSection · board.emptyColumn
board.renameColumn · board.columnColor · board.markDoneLike · board.deleteColumn
board.deleteColumnMessage {{count}} {{name}} · board.deleteColumnLastError
board.subtaskCount {{done}}/{{total}} · board.completedOn {{date}}
board.labelNameInvalid
priority.high / .medium / .low
board.a11y.pickedUp · .dropToColumn · .movedToColumn · .dropAsSubtask
```

---

## Test plan

**API** — unit, `pg` mocked at the module boundary, matching every existing service test. Do not try
to make Vitest talk to Postgres; DB-backed coverage is Playwright's job now.

| File | Pattern from | Covers |
|---|---|---|
| `services/__tests__/statusService.test.ts` | `sectionService.test.ts` | seed idempotent; seed sets the collection completion pointer; completed→completion status, open→first other; create appends; rename; reorder; changing the completion pointer realigns affected tasks; delete/reassign preserves the invariant; every mutation publishes |
| `services/__tests__/completionSync.test.ts` | same | completion status completes + cascades; another status reopens without cascade; no-op when aligned; `previous_status_id` round-trips |
| `services/__tests__/taskService.move.status.test.ts` | `taskService.move.test.ts` (`mockTransaction`, asserts recorded `{sql, params}`) | scope `status` writes `status_id` and a `task_order` row and **never** `order_value`; completion-status drop issues the completion UPDATE; cross-collection nulls `status_id`; response carries `statusId`/`isCompleted` |
| `services/__tests__/taskService.move.priority.test.ts` | same | `priority` written; `task_order` scope `priority` |
| `services/__tests__/taskService.labels.test.ts` | same | create/update write `task_labels`; foreign `labelIds` → 400; update replaces rather than appends |
| `services/__tests__/preferencesService.test.ts` (extend) | existing | non-UUID key, bad enum, >200 keys, the setClause |
| `services/__tests__/taskService.property.test.ts` (extend) | `fast-check` | renumbering a status column never yields duplicate positions |
| `routes/__tests__/statuses.test.ts` | supertest + `createApp` (`routes/__tests__/testUtils.ts`) | all six endpoints; 404/403/validation shapes |
| `routes/__tests__/views.test.ts` (extend) | existing | view returns `statuses`, `boardOrder`, per-task `labels` |

**App** — vitest/jsdom, Testing Library, `fireEvent` (no `user-event` in this repo).

| File | Covers |
|---|---|
| `utils/__tests__/boardColumns.test.ts` | `buildColumns` per mode; "No section" column; exactly four priority columns; `parseColumnId` round-trip; board order beats `order_value` |
| `hooks/__tests__/useBoardDrag.test.ts` | `resolveBoardMove` called as a pure function per mode — jsdom gives dnd-kit zero-size rects, which is exactly why the existing `useTaskDrag.*.test.ts` files test `resolveMove` directly |
| `hooks/__tests__/useBoardDrag.reparent.test.ts` | drop on `card-subtasks` → `parentTaskId` set, appended |
| `hooks/__tests__/useBoardDrag.completion.test.ts` | drop into the collection completion column optimistically ticks the card |
| `components/dnd/__tests__/collision.test.ts` (extend) | board allow-matrix; nested `card-subtasks` beats its column; existing cases stay green |
| `contexts/__tests__/PlannerDragContext.test.tsx` (extend) | `enabled: false` skips registration and does not clobber the live one |
| `components/board/__tests__/BoardCard.test.tsx` | `2/3`, flag + word, chips, completion date; ticking a checklist item calls back |
| `components/board/__tests__/BoardColumn.test.tsx` | header count, add-card submit, empty state |
| `components/board/__tests__/BoardView.test.tsx` | four columns in priority mode; switching group-by re-columns |
| `pages/__tests__/CollectionsPage.kanban.test.tsx` | toolbar toggle swaps list↔board and PATCHes preferences |
| `components/__tests__/TaskItem.test.tsx` (extend) | label chips render |

### Playwright — new, and built to outlive this feature

A third top-level npm package, sibling to `api/` and `app/`. Not inside either: it tests both
together and must not inherit their jsdom vitest config.

```
e2e/package.json                 @playwright/test only
e2e/playwright.config.ts         baseURL from E2E_BASE_URL (default https://planner.local),
                                 ignoreHTTPSErrors: true (local certs are self-signed),
                                 projects: chromium; trace/video on first retry; retries: 1 in CI
e2e/global-setup.ts              registers a throwaway user over the REST API, writes
                                 storageState.json with planner_token in localStorage
e2e/fixtures/api.ts              authed fetch helper — specs build their own data over the API,
                                 never over the UI, and never share a collection
e2e/fixtures/drag.ts             dragCard(page, from, to) — see the warning below
e2e/specs/api/statuses.spec.ts   DB-backed status CRUD, seeding idempotency, last-column 409
e2e/specs/api/task-move.spec.ts  DB-backed move: status/priority scopes, task_order rows written,
                                 order_value NOT touched, cross-collection nulls status_id
e2e/specs/board/*.spec.ts        the board specs (milestone 12)
```

**`locator.dragTo()` does not work with dnd-kit.** Its `PointerSensor` needs a real pointer
sequence past a 6px activation distance (`PRESS_ACTIVATION` in `components/dnd/sensors.ts:78`), and
`dragTo` fires too few intermediate moves. `dragCard` must do
`mouse.move → mouse.down → several mouse.move steps → mouse.up`, with a short settle after `down`.
Get this helper right once; every future drag spec depends on it.

Board components need stable hooks: `data-column-id` on columns, `data-card-id` on cards. Task rows
already carry `data-task-id` (`TaskItem.tsx`).

**Running it.** A compose service under an `e2e` profile, using
`mcr.microsoft.com/playwright:v1.x-noble`, so it matches how everything else in this repo runs and
needs no host browser install:

```bash
docker compose --profile e2e run --rm e2e            # whole suite
docker compose --profile e2e run --rm e2e npx playwright test specs/board
```

Add that to the commands table in `CLAUDE.md`, `AGENTS.md` and `GEMINI.md`, plus a `Testing` note
that unit/component tests are Vitest and anything crossing the network or needing a real browser is
Playwright. Add a CI job to `.github/workflows/quality.yml` that boots the stack with
`docker compose up -d`, waits for health, and runs the suite; upload the trace artifact on failure.
`e2e/storageState.json`, `e2e/test-results/`, `e2e/playwright-report/` go in `.gitignore`.

**Board specs (milestone 12):**

| Spec | Asserts |
|---|---|
| `board/seed.spec.ts` | first open seeds exactly four columns; reload does not seed eight |
| `board/drag-card.spec.ts` | drag between columns persists across reload |
| `board/completion-sync.spec.ts` | drop into Completed → list view shows it struck through; untick there → card leaves Completed and returns to its previous column |
| `board/order-isolation.spec.ts` | **the decision-4 guard** — reorder inside a column, switch to List, list order byte-identical |
| `board/group-by.spec.ts` | Priority mode renders exactly four columns; dragging changes the card's flag |
| `board/subtask-reparent.spec.ts` | drag a subtask onto another card; both `2/3` counts update |
| `board/columns.spec.ts` | rename, recolor, reorder, delete-with-reassign, last-column 409 surfaced |

---

## Execution order

Worktree `../planner-kanban-board` on `feat/kanban-board`, with
`COMPOSE_PROJECT_NAME=planner-claude` / `APP_SUBDOMAIN=claude.planner`.

Each milestone ends with `docker compose exec api npm run build && … npm run lint` (and the `app`
equivalents) green, plus one Conventional Commit.

1. **Statuses** — migration 037, `statusService`, `routes/statuses.ts`, `SyncEntityType`.
2. **Completion sync** — `completionSync.ts` wired into complete/reopen/updateStatus.
3. **Labels** — `labelIds` write path, `attachLabels`, label sync events, `ensureSeedLabels`.
4. **Move scopes** — migration 038, `renumberOrderTableScope`, `status`/`priority` scopes.
5. **Preferences** — migration 039, six service sites, `boardOrder` in the views.
6. **Playwright harness** — `e2e/` package, compose profile, CI job, the two API specs.
7. **Drag plumbing** — drag types, collision fix, `boardColumns.ts`, client bindings, `enabled` flag,
   auto-scroll axis. No UI.
8. **Board UI** — components, tokens, i18n, styleguide specimen. Static, no drag.
9. **Card drag** — `useBoardDrag`, optimistic apply, a11y announcements.
10. **Column CRUD** — `useBoardColumnDrag`, add/rename/recolor/delete.
11. **Page wiring** — `ViewToolbar`, `GroupBySelect`, `useBoardPreferences` on both pages.
12. **Board e2e** — the seven specs, and the `dragCard` helper done carefully.
13. **List-view label chips** — last, because it touches the riskiest shared surface.

---

## Verification

```bash
docker compose exec api npm run build && docker compose exec api npm run lint
docker compose exec app npm run build && docker compose exec app npm run lint
docker compose exec api npm test && docker compose exec app npm test
docker compose --profile e2e run --rm e2e
```

Migrations run at startup; confirm 037/038/039 applied and idempotent by restarting the api
container twice.

**Automated by Playwright:** seeding idempotency, drag persistence, completion sync both
directions, list-order isolation, group-by column counts, subtask reparent, column CRUD including
the last-column 409.

**Manual, in the browser** at `https://claude.planner.local` — the things a spec cannot judge:

1. Wide board: drag a card toward an off-screen column → the board auto-scrolls sideways.
2. Both background themes (beige + white): the dot grid reads through columns and cards; no shadows
   on cards; no colored stripes.
3. Column and card heights land on the 24px baseline; accent stays under budget on a busy board.
4. `/styleguide` shows the Board specimen.
5. Board on `/inbox`; view + group-by survive a reload and stay per-collection.

Then `docker compose down -v`, `git worktree remove`, open the PR.

---

## Risks / mitigations

- **Handler-registry collision** — `useTaskDrag` and `useBoardDrag` both claim `DragKind: 'task'`
  and only one registration survives. Miss the `enabled` flag and drags die silently after the
  first view switch, with no error. Covered by a `PlannerDragContext` test.
- **Nested droppable resolution** (`collision.ts:121`) picks containers by set membership, ignoring
  `pointerWithin` ranking. Subtask-drop-into-card needs the fix, and the fix is behaviour-visible to
  every existing drag — keep `collision.test.ts` green.
- **Horizontal auto-scroll is off app-wide by deliberate design.** Easy to forget until QA on a
  6-column board.
- **Changing `collections.completion_status_id` on a busy board** completes tasks in the new
  completion status and reopens tasks in the former status in one transaction. Add a confirmation
  dialog; consider a row cap.
- **Ticking a subtask cascades** — `POST /tasks/:id/complete` cascades to descendants and may move
  that subtask into the collection's completion column it will never be seen in. Harmless but invisible.
- **`previous_status_id` is a second place status lives.** Delete that status and the FK nulls it;
  reopen falls back to the first status other than the collection completion status.
- **`updateTask` will be asked to accept `statusId`.** Refuse — it would be a fifth completion-sync
  call site. Route it through `moveTask` with `position: Number.MAX_SAFE_INTEGER`.
- **Migration numbering** — `031_` is already duplicated and the runner sorts lexically. Claim 037,
  038 and 039 in one commit.
- **Playwright is new infrastructure riding on a feature branch.** It can turn flaky (dnd-kit +
  real pointer timing) or grow feature-specific. Mitigation: milestone 6 lands standalone with only
  API specs, so the harness proves itself before any board spec exists.
- **E2E needs a disposable database.** Specs create their own collections and a throwaway user, so
  they can run against the dev stack — but a leaking spec pollutes it. Every spec cleans up; CI runs
  against a fresh `docker compose up -d`.
- **Scope.** Thirteen milestones. Milestones 1-6 are shippable behind an unwired UI; the natural
  v1.5 cut line is after milestone 9 (board works, columns not yet editable in place).
