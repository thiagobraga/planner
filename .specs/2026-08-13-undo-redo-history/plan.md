# Undo/Redo Action History

Cross-app, server-backed action history covering tasks, habits, collections, and sections. Plan and task breakdown live in this single file by request.

## What the user gets

- Every undoable change - task create/edit/complete/reopen/move/reorder/reorganize/delete, habit create/edit/toggle/move/archive/delete (plus habit groups), collection create/edit/archive/delete, and section create/edit/delete - is recorded in a per-user history stack.
- `Ctrl+Z` (`Cmd+Z` on macOS) undoes the latest action (or `N` actions); `Shift+Ctrl+Z` (`Shift+Cmd+Z`) and `Ctrl+Y` (`Cmd+Y`) redo. When a text field is focused, native browser text undo/redo runs untouched.
- **Cross-tab and cross-device undo/redo**: undoing in Tab A updates Tab B live via Socket.IO, and hitting `Ctrl+Y` in Tab B redoes that exact entry. Reloading or closing a tab never loses history.
- After an undoable mutation, a compact bottom-right toast offers an inline **Undo** button (bulk operations like reorganize coalesce into a single `Undo (N items)` toast). Auto-dismissing the toast leaves `Ctrl+Z` available.
- **Settings > General** adds a **History depth** selector (`10`, `15`, `20`, default `15`) enforced server-side as a ring buffer.
- Mutations made by personal API tokens or OAuth MCP agents also enter `history_entries`, so a user can press `Ctrl+Z` in Planner to revert an unwanted agent action; write-scoped MCP clients also gain `undo_last_action` and `redo_last_action` tools.

---

## Current state (verified against `main`)

- **Migrations**: at `049_preferences_show_checkboxes.sql` (`040` in the original draft is now `040_task_type_event.sql`; `.specs/2026-11-03-agent-task-tool` also targets `050`). Next free migration number on `main` is `050_history_entries.sql` - confirm exact number against `main` when starting implementation.
- **1000-line file limit**:
  - `api/src/services/taskService.ts` is **1975 lines** (already over limit). Touch it with 1-line helper calls only; put all snapshot assembly and inverse-apply logic in new focused modules (`historyService.ts` and `historyInverse.ts`).
  - `app/src/pages/CollectionsPage.tsx` (**950 lines**), `app/src/pages/SettingsPage.tsx` (**901 lines**), and `app/src/pages/DailyPage.tsx` (**895 lines**) sit near the ceiling. Extract the settings control into `app/src/components/settings/HistoryDepthSection.tsx`, and trigger undo toasts centrally from mutation helpers/stores rather than adding per-page boilerplate.
- **Dedicated type files**: `CLAUDE.md` requires all new interfaces and types to live under `api/src/types/` and `app/src/types/` (never inline in services, hooks, or components). `Preferences` and REST contracts already live in `app/src/types/api.ts`.
- **Activity attribution**: `recordActivity()` in `api/src/services/activityService.ts` is the sole writer to `activity_events` and stamps `actor_type` (`session` / `token` / `oauth`), `api_token_id`, `oauth_grant_id`, and `actor_label` from `requestContext.ts`. Note `activity_events.entity_id` is `UUID NOT NULL` and `activity_events.event_type` is `VARCHAR(20) NOT NULL` (`015_activity_events.sql`), so undo/redo activity rows must pass a valid UUID `entityId` (for `habit_toggle`, use `habitId`, never `${habitId}:${date}`) and short event types (`'history_undone'` / `'history_redone'`).
- **Auth & scopes**: global `enforceTokenScope` in `api/src/middleware/requireScope.ts` automatically allows read-only tokens on `GET /api/v1/history` while blocking them (`403 INSUFFICIENT_SCOPE`) on `POST /api/v1/history/undo` and `POST /api/v1/history/redo`.
- **Real-time sync & echo suppression**:
  - `SyncEventType` in `api/src/services/syncService.ts` and `app/src/hooks/useSync.ts` currently contains `'created' | 'updated' | 'deleted' | 'completed' | 'uncompleted'` (`'undone' | 'redone'` do not exist yet and must be added to both unions alongside `'history'` in `SyncEntityType`).
  - `useSync.ts` suppresses self-echoes (`if (event.sourceId && event.sourceId === getSocketId()) return;`). The originating tab (Tab A) will NOT receive Socket.IO events for its own `POST /history/undo`, `POST /history/redo`, or normal mutations - Tab A must patch/invalidate its own React Query keys (`['daily']`, `['inbox']`, `['collection']`, `['collections']`, `['tasks']`, `['habits']`, `['habitGroups']`, `['history']`, `['activity']`) and Zustand stores on response, while Tab B updates via `useSync`.
  - Daily views now query `['daily', from, to]` via `app/src/hooks/useDailyTasks.ts` (invalidate prefix `['daily']`).
- **Schema additions since Aug 2026**:
  - Tasks now carry `status_id` (`037_task_statuses.sql` + `completionSync.ts`), board order columns `order_collection_board` / `order_daily_board` (`038`), `type: 'task' | 'note' | 'event'` (`040`), and time/deadline/duration fields (`044`).
  - `completeTask` on a recurring task marks the original row completed, clears its `recurrence_rule`, and clones a brand-new `nextTaskId` row + `task_labels`. Non-recurring `completeTask` cascades completion and `status_id` to descendants. `deleteTask` deletes the recursive subtree, `reminders`, and `task_labels`.
  - `habitService.ts` added `archiveHabit`, `habit_groups` CRUD/archive/move, and parent-to-child fanout in `toggleCompletion`, and currently runs direct `pool.query` calls without `PoolClient` transactions.
- **UI primitives**:
  - No generic toast/snackbar exists yet - only `AgentNotice.tsx` (bottom-right overlay, 6s auto-dismiss) and `UpdateToast.tsx` (version banner). Build `UndoToast.tsx` + `toastStore.ts` matching `AgentNotice.tsx` tokens.
  - `app/src/hooks/usePreferences.ts` is a 9-line read-only `useQuery` wrapper; `SettingsPage.tsx` mutates via `apiUpdatePreferences` directly and routes tabs under `/settings/:section` (`general`, `appearance`, `integrations`).
  - Keyboard shortcuts are listed in two places: the `?` dialog in `AppShell.tsx` and `app/src/i18n/helpContent.ts` (`HelpPage.tsx`).

---

## Scope & Architecture Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | **Dedicated `history_entries` table + dual-write to `activity_events` via `recordActivity()`.** | `activity_events` is an unbounded audit log with partial `before_data` and `VARCHAR(20)` event names; it cannot act as a status-tracked ring buffer. Every undo/redo flips `history_entries.status` AND calls `recordActivity(client, ...)` with `eventType: 'history_undone' \| 'history_redone'` so collaborators and token activity feeds see the revert with full actor attribution. |
| 2 | **Per-user server-side stack (`user_id`), shared across tabs and devices.** | Storing stack state (`sequence`, `status`) in PostgreSQL and broadcasting via `publishEvent()` makes cross-tab undo/redo work out of the box and survives tab reloads. UI undo/redo availability reads synced `['history']` query state rather than tab-local memory. |
| 3 | **Server owns recording and ring-buffer eviction inside the mutation transaction.** | Every undoable service mutation runs inside a `PoolClient` transaction and calls `historyService.record(client, ...)` alongside `recordActivity()`, then calls `publishEvent()` after `COMMIT`. |
| 4 | **Composite snapshots (`before_data` / `after_data` JSONB), not field diffs.** | Snapshots keep undo/redo generic and resilient to concurrent schema additions (`status_id`, board orders, datetime fields). Where a single user action mutates related rows - recurring `completeTask` (`spawnedTaskId`), `deleteTask` (subtree + `task_labels` + `reminders`), cascading `completeTask` (descendant rows), parent `habit_toggle` (exact previously-completed `habitIds` on `date`), or `archiveHabit` (parent + children) - the snapshot bundles those rows so restore leaves zero orphans or lost metadata. |
| 5 | **Explicit `POST /api/v1/history/undo` and `POST /api/v1/history/redo` endpoints (`{ count?: number }`).** | Undo/redo is a real ownership-checked, transactional write against live data that may have been edited by collaborators since the snapshot was recorded. `count` defaults to `1` (max `20`) and counts logical steps (a shared `batch_id` group counts as 1 step). |
| 6 | **Standard redo invalidation on fresh action.** | Entries carry `status` (`'active' \| 'undone' \| 'failed'`). Undo flips the `N` newest `active` steps to `undone`; redo flips the `N` oldest `undone` steps back to `active`; any new undoable mutation hard-deletes all `undone` entries for that user before inserting the new `active` entry. |
| 7 | **Entity sync events + `'history'` meta-event + originating-tab reconciliation.** | Undo/redo emits normal per-entity `publishEvent()` messages (`task`, `habit`, `habit_completion`, `collection`, `section`) plus `entityType: 'history'`, `eventType: 'undone' \| 'redone'`. Because `useSync.ts` filters out the caller's own `sourceId`, the calling tab reconciles its caches/stores directly from the REST response while other open tabs update via `useSync`. |
| 8 | **Configurable depth (`10 / 15 / 20`, default `15`) in `preferences.history_depth`.** | Validated in `preferencesService.ts` via `VALID_HISTORY_DEPTHS = [10, 15, 20] as const`. On every `record()`, `historyService` evicts oldest logical steps (`COALESCE(batch_id, id)`) beyond the user's `history_depth`. |
| 9 | **Skip-and-report failure handling (never crash a batch).** | Each logical step in `undo(userId, count)` / `redo(userId, count)` runs in a `SAVEPOINT` (or per-step transaction). If a target entity or required parent collection was permanently deleted by a collaborator or fails constraints, that entry is marked `status = 'failed'` (excluded from ring-buffer counts) and returned in `{ applied, skipped }` so the UI can notify `"Could not undo 1 action(s) - item no longer exists"`. |
| 10 | **Additive modifier support in `app/src/hooks/shortcuts.ts` - no third-party hotkey library.** | Keeps one pure, DOM-free shortcut matcher with unified `isTextInputFocused` handling. Key normalization preserves shifted punctuation like `?` (`Shift + /`) while matching `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` (where browsers emit uppercase `e.key === 'Z'`), and `Ctrl/Cmd+Y`. |
| 11 | **Bottom-right `UndoToast` with `batchId` coalescing.** | Reuses `AgentNotice.tsx` visual tokens (`--planner-overlay-bg`, `border-border`, `shadow-overlay`, Lora serif, 24px rhythm, `bottom-24` mobile / `sm:bottom-6 sm:right-6` desktop). Bulk actions sharing a `batchId` render one coalesced toast. |
| 12 | **API tokens & MCP parity.** | Token/OAuth mutations through `taskService` and `habitService` record history entries under `userId` (attributed via `recordActivity()`). Write-scoped MCP servers register `undo_last_action` and `redo_last_action` tools in `api/src/mcp/tools/history.ts`. |

---

## Backend Design

### 1. Migration `api/src/db/migrations/050_history_entries.sql`

Confirm next free number against `main` before creating. Follow `.agents/skills/db-migration/SKILL.md` (no `BEGIN`/`COMMIT`, no `IF NOT EXISTS`):

```sql
CREATE SEQUENCE history_entries_seq;

CREATE TABLE history_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  batch_id UUID,
  sequence BIGINT NOT NULL DEFAULT nextval('history_entries_seq'),
  entity_type VARCHAR(30) NOT NULL,
  entity_id UUID NOT NULL,
  operation VARCHAR(40) NOT NULL,
  summary VARCHAR(500),
  before_data JSONB,
  after_data JSONB,
  status VARCHAR(10) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'undone', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_history_entries_user_seq
  ON history_entries(user_id, sequence DESC)
  WHERE status IN ('active', 'undone');

CREATE INDEX idx_history_entries_user_batch
  ON history_entries(user_id, batch_id)
  WHERE batch_id IS NOT NULL;

ALTER TABLE preferences
  ADD COLUMN history_depth SMALLINT NOT NULL DEFAULT 15;
```

### 2. Dedicated Types `api/src/types/history.ts`

```ts
import type { SyncEntityType } from "../services/syncService.js";

export type HistoryStatus = "active" | "undone" | "failed";

export type HistoryOperation =
  | "task_create"
  | "task_update"
  | "task_delete"
  | "task_complete"
  | "task_reopen"
  | "task_move"
  | "task_reorder"
  | "task_reorganize"
  | "habit_create"
  | "habit_update"
  | "habit_delete"
  | "habit_archive"
  | "habit_toggle"
  | "habit_move"
  | "habit_group_create"
  | "habit_group_update"
  | "habit_group_delete"
  | "habit_group_archive"
  | "habit_group_move"
  | "collection_create"
  | "collection_update"
  | "collection_delete"
  | "collection_archive"
  | "section_create"
  | "section_update"
  | "section_delete";

export interface RecordHistoryInput {
  userId: string;
  collectionId?: string | null;
  batchId?: string | null;
  entityType: SyncEntityType;
  entityId: string;
  operation: HistoryOperation;
  summary?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
}

export interface HistoryEntry {
  id: string;
  userId: string;
  collectionId: string | null;
  batchId: string | null;
  sequence: number;
  entityType: SyncEntityType;
  entityId: string;
  operation: HistoryOperation;
  summary: string | null;
  status: HistoryStatus;
  createdAt: string;
}

export interface HistoryStateResponse {
  entries: HistoryEntry[];
  undoCount: number;
  redoCount: number;
}

export interface SkippedHistoryStep {
  entry: HistoryEntry;
  reason: string;
}

export interface UndoRedoResult {
  applied: HistoryEntry[];
  skipped: SkippedHistoryStep[];
  undoCount: number;
  redoCount: number;
}
```

### 3. Services (`historyService.ts` + `historyInverse.ts`)

Split into two modules so each stays concise (<400 lines):

- **`api/src/services/historyService.ts`**:
  - `record(client: PoolClient, input: RecordHistoryInput): Promise<void>`:
    1. Deletes `WHERE user_id = $1 AND status = 'undone'` (redo invalidation).
    2. Inserts the new `active` row into `history_entries`.
    3. Reads `(SELECT history_depth FROM preferences WHERE user_id = $1)` (fallback `15`) and deletes `active` rows belonging to logical steps (`COALESCE(batch_id, id)`) older than the newest `history_depth` steps.
  - `listHistory(userId: string): Promise<HistoryStateResponse>`: returns active/undone entries ordered by `sequence DESC` plus logical `undoCount` and `redoCount`.
  - `undo(userId: string, count = 1): Promise<UndoRedoResult>` and `redo(userId: string, count = 1): Promise<UndoRedoResult>`:
    - Selects up to `count` logical steps (`active` newest-first for undo; `undone` oldest-first for redo).
    - Runs each step via `historyInverse.applyInverse(...)` / `applyForward(...)` inside its own transaction, flips `status`, writes `recordActivity(client, { eventType: 'history_undone' | 'history_redone', ... })`, and after `COMMIT` emits entity `publishEvent()` calls plus one `'history'` meta-event (`payload: { undoCount, redoCount }`).
    - On missing target / FK conflict, marks the step `status = 'failed'` and appends to `skipped`.

- **`api/src/services/historyInverse.ts`**:
  - Snapshot helpers called from mutating services (keeping `taskService.ts` changes to 1-2 lines per function):
    - `captureTaskSubtreeSnapshot(client, taskId)` -> `{ tasks, taskLabels, reminders }` for `deleteTask` and cascading `completeTask`.
    - Defensive column-whitelisted `UPDATE` / `INSERT ... ON CONFLICT` helpers so snapshots remain safe across future additive migrations.
    - Recurring `task_complete` undo: deletes `afterData.spawnedTaskId` (if still present) and restores the original task row (including `recurrence_rule` and prior `status_id`).
    - `habit_toggle` undo/redo: restores exact `beforeData.completedHabitIds` on `beforeData.date` across parent + child habits.

### 4. Routes, Sync, Preferences, and MCP

- **`api/src/routes/history.ts`** (mounted at `router.use("/history", historyRoutes)` in `api/src/routes/index.ts`):
  - `GET /api/v1/history` -> `HistoryStateResponse`
  - `POST /api/v1/history/undo` `{ count?: number }` -> `UndoRedoResult`
  - `POST /api/v1/history/redo` `{ count?: number }` -> `UndoRedoResult`
- **`api/src/services/syncService.ts`**:
  - Add `"history"` to `SyncEntityType` and `"undone" | "redone"` to `SyncEventType`.
- **`api/src/services/preferencesService.ts`**:
  - Add `history_depth: number` to `PreferencesRow`, `historyDepth` to `formatPreferences` / `UpdatePreferencesInput` / `updatePreferences`, and `VALID_HISTORY_DEPTHS = [10, 15, 20] as const` in `validatePreferences`.
- **`api/src/mcp/tools/history.ts`** (registered in `api/src/mcp/server.ts` inside `if (ctx.scopes.includes("write"))`):
  - `undo_last_action` (`count?: number`, default `1`) and `redo_last_action` (`count?: number`, default `1`).

---

## Frontend Design

### 1. Dedicated Types (`app/src/types/history.ts` & `app/src/types/api.ts`)

- Create `app/src/types/history.ts` for `HistoryEntry`, `HistoryStateResponse`, `UndoRedoResult`, `HistoryDepth` (`10 | 15 | 20`), and `UndoToastItem` (`id`, `message`, `batchId?`, `count`).
- Extend `Preferences` in `app/src/types/api.ts` with `historyDepth: 10 | 15 | 20`.
- Mirror `'history'` in `SyncEntityType` and `'undone' | 'redone'` in `SyncEventType` inside `app/src/hooks/useSync.ts`.

### 2. Shortcut Matcher (`app/src/hooks/shortcuts.ts`)

Extend `KeyEvent` and `SingleBinding` (or extract their types into `app/src/types/hooks.ts` if touched alongside type cleanup) without breaking shifted punctuation (`?`):

```ts
export interface KeyEvent {
  key: string;
  ctrlOrCmd?: boolean;
  shift?: boolean;
  alt?: boolean;
  isTextInputFocused: boolean;
  timestamp: number;
}

export interface SingleBinding {
  key: string;
  modifiers?: { ctrlOrCmd?: boolean; shift?: boolean; alt?: boolean };
  context?: ShortcutContext;
  action: string;
}
```

Matching rules in `matchKey`:
- Chord prefix and completion require `!event.ctrlOrCmd && !event.alt`.
- When `b.modifiers?.ctrlOrCmd` is `true`: require `Boolean(event.ctrlOrCmd) && !event.alt && Boolean(b.modifiers.shift) === Boolean(event.shift) && b.key.toLowerCase() === event.key.toLowerCase()`. This handles browsers emitting uppercase `'Z'` on `Ctrl+Shift+Z`.
- When `b.modifiers?.ctrlOrCmd` is omitted/`false`: require `!event.ctrlOrCmd && !event.alt && b.key === event.key` (plus `Boolean(b.modifiers.shift) === Boolean(event.shift)` only when `b.modifiers?.shift !== undefined`). That keeps `'q'` from firing on `Ctrl+Q` or `Shift+Q` (`'Q'`) while preserving `'?'` (`Shift + /`).

Append to `DEFAULT_BINDINGS`:
```ts
{ key: 'z', modifiers: { ctrlOrCmd: true }, context: 'global', action: 'history:undo' },
{ key: 'z', modifiers: { ctrlOrCmd: true, shift: true }, context: 'global', action: 'history:redo' },
{ key: 'y', modifiers: { ctrlOrCmd: true }, context: 'global', action: 'history:redo' },
```

Update `AppShell.tsx` `keydown` listener to pass `ctrlOrCmd: e.metaKey || e.ctrlKey`, `shift: e.shiftKey`, `alt: e.altKey`, and wire `'history:undo'` / `'history:redo'` in `handleAction`. Document the shortcuts in both `AppShell.tsx` (the `?` modal) and `app/src/i18n/helpContent.ts`.

### 3. `useHistory.ts`, `toastStore.ts`, `UndoToast.tsx`, and `HistoryDepthSection.tsx`

- **`app/src/api/client.ts`**: add `fetchHistory()`, `apiUndo(count = 1)`, `apiRedo(count = 1)`, and trigger undo toast notifications centrally on undoable API mutation helpers (with `batchId` grouping for `apiReorganizeTasks`) so 900-line page components do not need per-handler toast plumbing.
- **`app/src/hooks/useHistory.ts`**:
  - Queries `['history']` via React Query (`fetchHistory`).
  - Exposes `undo(count = 1)`, `redo(count = 1)`, `canUndo`, `canRedo`, `undoCount`, `redoCount`, `isPending`.
  - On `undo`/`redo` resolve (Tab A): updates `['history']` counts, invalidates affected React Query prefixes (`['daily']`, `['inbox']`, `['collection']`, `['collections']`, `['tasks']`, `['habits']`, `['habitGroups']`, `['activity']`), reconciles `taskStore`/`collectionStore`, and shows feedback toast (including skipped-item notice if `skipped.length > 0`).
  - Subscribes via `useSync` to `'history'` events (Tab B) to update `['history']` immediately across tabs, and invalidates `['history']` when `event.actor` arrives from an agent.
- **`app/src/stores/toastStore.ts` + `app/src/components/UndoToast.tsx`**:
  - Lightweight Zustand queue/current-item store (`showUndoToast`, `dismissToast`) coalescing rapid items with matching `batchId`.
  - Rendered in `AppShell.tsx` coordinated with `AgentNotice.tsx` (`--planner-overlay-bg`, `border-border`, `shadow-overlay`, Lora serif, 24px rhythm, `bottom-24` on mobile to clear `BottomBar`, `sm:bottom-6 sm:right-6` on desktop).
- **`app/src/components/settings/HistoryDepthSection.tsx`**:
  - Segmented radio cards (`10`, `15`, `20`) matching `WEEK_START_OPTIONS` styling in `SettingsPage.tsx`, rendered inside the `general` tab of `SettingsPage.tsx`.

### 4. i18n (`app/src/i18n/locales/en.ts` + `pt-BR.ts`)

Flat typed `TranslationKey` entries (no em dashes):

- `'history.undo'`: `'Undo'` / `'Desfazer'`
- `'history.redo'`: `'Redo'` / `'Refazer'`
- `'history.actionDone'`: `'{{action}}'` / `'{{action}}'`
- `'history.reorganizedCount'`: `'Reorganized {{count}} tasks'` / `'{{count}} tarefas reorganizadas'`
- `'history.undidToast'`: `'Undid: {{action}}'` / `'Desfeito: {{action}}'`
- `'history.redidToast'`: `'Redid: {{action}}'` / `'Refeito: {{action}}'`
- `'history.skipped'`: `'Could not undo {{count}} action(s) - item no longer exists'` / `'Não foi possível desfazer {{count}} ação(ões) - item não existe mais'`
- `'shell.undo'`: `'Undo last action'` / `'Desfazer última ação'`
- `'shell.redo'`: `'Redo action'` / `'Refazer ação'`
- `'settings.historyDepth'`: `'History depth'` / `'Profundidade do histórico'`
- `'settings.historyDepthDescription'`: `'Maximum number of recent actions kept for undo and redo'` / `'Número máximo de ações recentes mantidas para desfazer e refazer'`
- `'settings.historyDepthSteps'`: `'{{count}} actions'` / `'{{count}} ações'`

---

## Risks & Mitigations

- **Cross-service schema drift**: `historyInverse.ts` filters snapshot keys against current table columns on restore instead of assuming fixed column lists, so additive/dropped columns in future migrations never break existing ring-buffer rows.
- **Recurring & cascading task side-effects**: Bundling `spawnedTaskId` (recurring complete) and subtree/labels/reminders (`deleteTask` / cascading `completeTask`) prevents orphan clones or lost metadata on undo.
- **Self-echo drop in `useSync.ts`**: Explicitly reconciling caches in `useHistory.ts` on REST completion guarantees Tab A updates instantly while Tab B updates via Socket.IO.
- **Near-limit files (`taskService.ts`, `SettingsPage.tsx`, `CollectionsPage.tsx`, `DailyPage.tsx`)**: Enforcing 1-line delegation in `taskService.ts`, extracting `HistoryDepthSection.tsx`, and centralizing toast triggers keeps touched files from crossing (or growing further past) the 1000-line rule.

---

## Tasks

### 0. Isolation & Setup

- [ ] Create worktree `.worktrees/undo-redo-history` on branch `feat/undo-redo-history`, configure `.env` (`COMPOSE_PROJECT_NAME`, `APP_SUBDOMAIN`), run `bash .hooks/setup-hooks.sh`, start `docker compose up -d`, and open a Draft PR against `main`.

### 1. Database, Types, Core History Service & Preferences (TDD)

- [ ] Confirm next free migration number on `main` and create `api/src/db/migrations/050_history_entries.sql` (`history_entries_seq`, `history_entries` with `batch_id`, indexes, `preferences.history_depth`).
- [ ] Create `api/src/types/history.ts` with all backend history contracts.
- [ ] Extend `SyncEntityType` (`'history'`) and `SyncEventType` (`'undone' | 'redone'`) in `api/src/services/syncService.ts`.
- [ ] Extend `api/src/services/preferencesService.ts` with `historyDepth` and `VALID_HISTORY_DEPTHS = [10, 15, 20] as const` (write unit/integration tests first in `preferencesService.test.ts`).
- [ ] Write failing real-DB tests in `api/src/services/__tests__/historyService.test.ts` covering `record()`, ring-buffer eviction by logical `batch_id` step, redo invalidation on new push, LIFO `undo(count)` / `redo(count)`, `recordActivity()` dual-write with actor attribution, and `status = 'failed'` skip-and-report on missing entities.
- [ ] Implement `api/src/services/historyInverse.ts` and `api/src/services/historyService.ts` to pass all service tests.
- [ ] Write failing route tests in `api/src/routes/__tests__/history.test.ts` (session auth, read vs write API token scope enforcement, `count` validation, response shape), then implement `api/src/routes/history.ts` and mount `/history` in `api/src/routes/index.ts`.

### 2. Service Mutation Wiring & MCP Tools (TDD)

- [ ] Wire `historyService.record()` into `api/src/services/taskService.ts` with minimal 1-line calls per mutation (`createTask`, `updateTask`, `deleteTask` with subtree/labels/reminders snapshot, `completeTask` with recurring `spawnedTaskId` / descendant cascade snapshot, `reopenTask`, `moveTask`, `reorderTask`, `reorganizeTasks` with shared `batchId`). Extend `taskService` integration tests.
- [ ] Wrap mutating functions in `api/src/services/habitService.ts` in `PoolClient` transactions and wire `historyService.record()` (`createHabit`, `updateHabit`, `deleteHabit`, `archiveHabit`, `toggleCompletion` with exact completed child IDs, `moveHabit`, `createGroup`, `updateGroup`, `deleteGroup`, `archiveHabitGroup`, `moveHabitGroup`). Extend `habitService` integration tests.
- [ ] Wire `historyService.record()` into `api/src/services/collectionService.ts` (`createCollection`, `updateCollection`, `deleteCollection`, `archiveCollection`) and `api/src/services/sectionService.ts` (`createSection`, `updateSection`, `deleteSection`) with integration tests.
- [ ] Create `api/src/mcp/tools/history.ts` (`undo_last_action`, `redo_last_action`), register in `api/src/mcp/server.ts` for `write` scope, and add MCP integration tests verifying read-only tokens cannot see or invoke them.

### 3. Frontend Shortcuts, Hook, Toast, Settings & i18n (TDD)

- [ ] Create `app/src/types/history.ts`, extend `Preferences` in `app/src/types/api.ts` with `historyDepth`, and mirror `'history'` + `'undone' | 'redone'` in `app/src/hooks/useSync.ts`.
- [ ] Add English and Portuguese (`pt-BR`) keys to `app/src/i18n/locales/en.ts` and `app/src/i18n/locales/pt-BR.ts`, and add undo/redo shortcut entries to `app/src/i18n/helpContent.ts`.
- [ ] Write failing tests in `app/src/hooks/__tests__/shortcuts.test.ts` (bare `z` ignored, `Ctrl/Cmd+Z` -> `history:undo`, `Shift+Ctrl/Cmd+Z` with uppercase `'Z'` -> `history:redo`, `Ctrl/Cmd+Y` -> `history:redo`, `?` with `shift: true` still fires `help:open`, text-input focus suppresses undo/redo), then extend `app/src/hooks/shortcuts.ts`.
- [ ] Add `fetchHistory`, `apiUndo`, and `apiRedo` to `app/src/api/client.ts`.
- [ ] Create `app/src/stores/toastStore.ts` and `app/src/components/UndoToast.tsx` (with unit tests in `UndoToast.test.tsx` including `batchId` coalescing), and trigger undo toasts from mutation client/store paths.
- [ ] Write failing tests in `app/src/hooks/__tests__/useHistory.test.ts` (calling-tab cache/store invalidation, skipped-entry notice, cross-tab `'history'` sync event handling), then implement `app/src/hooks/useHistory.ts`.
- [ ] Wire `ctrlOrCmd`/`shift`/`alt` key event fields, `history:undo` / `history:redo` dispatch, `UndoToast`, and Help modal rows in `app/src/components/AppShell.tsx`.
- [ ] Create `app/src/components/settings/HistoryDepthSection.tsx`, mount it in `SettingsPage.tsx` under `general` (verifying `SettingsPage.tsx` stays well under 1000 lines), and extend `app/src/pages/__tests__/SettingsPage.test.tsx`.

### 4. End-to-End Verification, Visual Check & Docs

- [ ] Add Playwright E2E test (`app/e2e/history.spec.ts`) covering: task create/complete/delete + habit toggle -> Undo toast click -> `Ctrl+Z` LIFO chain -> `Ctrl+Y` / `Ctrl+Shift+Z` redo -> redo stack cleared after new mutation -> cross-tab undo in Page A / redo in Page B -> Settings depth cap (`10`).
- [ ] Build and inspect UI in live Chrome at desktop and `390px` (Settings > General history depth control, Undo toast on desktop + mobile above `BottomBar`, Help dialog shortcuts), saving screenshots to `app/dist/screenshots/*.png`.
- [ ] Update `CLAUDE.md` and `README.md` (new `history_entries` table, `/api/v1/history` endpoints, `historyService`, MCP tools, keyboard shortcuts).
- [ ] Run full build, lint, Vitest unit/integration suites, and Playwright E2E tests:
  ```bash
  docker compose exec api npm run build && docker compose exec api npm run lint
  docker compose exec app npm run build && docker compose exec app npm run lint
  docker compose exec api npm test && docker compose exec app npm test
  docker compose exec app npm run test:e2e
  ```

---

## Relevant Files

```
api/src/db/migrations/050_history_entries.sql        new (confirm next free number on main)
api/src/types/history.ts                             new
api/src/services/historyService.ts                   new
api/src/services/historyInverse.ts                   new
api/src/routes/history.ts                            new
api/src/mcp/tools/history.ts                         new
api/src/routes/index.ts                              mount /history
api/src/mcp/server.ts                                register history write tools
api/src/services/syncService.ts                      add 'history' entity + 'undone' | 'redone' events
api/src/services/preferencesService.ts               add historyDepth (10 | 15 | 20)
api/src/services/activityService.ts                  reused via recordActivity() on undo/redo
api/src/services/taskService.ts                      minimal 1-line record() hooks (1975 lines - do not grow)
api/src/services/habitService.ts                     wrap mutations in PoolClient tx + record()
api/src/services/collectionService.ts                record() on create/update/delete/archive
api/src/services/sectionService.ts                   record() on create/update/delete
api/src/services/__tests__/historyService.test.ts    new
api/src/routes/__tests__/history.test.ts             new

app/src/types/history.ts                             new
app/src/types/api.ts                                 add historyDepth to Preferences
app/src/hooks/shortcuts.ts                           modifier matching + undo/redo bindings
app/src/hooks/useSync.ts                             mirror 'history' + 'undone' | 'redone'
app/src/hooks/useHistory.ts                          new
app/src/stores/toastStore.ts                         new
app/src/components/UndoToast.tsx                     new
app/src/components/settings/HistoryDepthSection.tsx  new (keeps SettingsPage.tsx < 1000 lines)
app/src/components/AppShell.tsx                      keydown modifiers, shortcut dispatch, UndoToast, help rows
app/src/pages/SettingsPage.tsx                       mount HistoryDepthSection in General tab
app/src/api/client.ts                                fetchHistory, apiUndo, apiRedo + toast triggers
app/src/i18n/locales/en.ts                           English history & settings strings
app/src/i18n/locales/pt-BR.ts                        Portuguese history & settings strings
app/src/i18n/helpContent.ts                          Help page undo/redo shortcut entries
app/src/hooks/__tests__/shortcuts.test.ts            modifier & shifted-punctuation tests
app/src/hooks/__tests__/useHistory.test.ts           new
app/src/pages/__tests__/SettingsPage.test.tsx        history depth preference tests
app/e2e/history.spec.ts                              new Playwright E2E suite
CLAUDE.md, README.md                                 architecture & shortcut docs
```
