# Undo/Redo Action History — Plan

## Context

User request (verbatim intent): a simple, cross-app action history — habits, tasks, completions,
moves (order/collection/inbox), deletes all count. Depth is configurable (10/15/20, in Settings).
Ctrl+Z/Cmd+Z undoes N entries; Shift+Ctrl+Z/Shift+Cmd+Z and Ctrl+Y/Cmd+Y redo.

This is an ARCHITECTURAL feature: a new cross-cutting subsystem touching every mutating service
(`taskService`, `habitService`, `collectionService`, `sectionService`, ...), `syncService`
(undo/redo IS a mutation and must broadcast), `preferencesService` (depth setting), and
`hooks/shortcuts.ts` (new modifier-aware keybindings). This plan was produced self-directed
(no interactive stakeholder available during drafting) — decisions below are made and justified
explicitly rather than left as open questions. It has not yet been reviewed/approved by the user.

### Scope decisions

| # | Decision | Why |
|---|---|---|
| 1 | **Dedicated `history_entries` table**, not a reuse/extension of `activity_events` — but every undo/redo ALSO writes a normal `activity_events` row. | `activity_events` is an unbounded audit log with partial before-data (e.g. delete only stores `{title}`) and no undone/redone state; it can't carry the ring-buffer/status semantics undo needs. But undoing/redoing IS a real user action collaborators should see in the project activity feed ("Thiago undid: deleted 'Buy milk'") — so `historyService.undo()`/`redo()` call `activityService`'s existing insert (same as any other mutation) in addition to flipping `history_entries.status`. Two tables, two jobs, both written on every undo/redo. **Approved.** |
| 2 | **Per-user, not per-session/per-tab — and this is the headline feature, not a side effect.** History is stored server-side keyed by `user_id`, shared across all of that user's tabs/devices. Ctrl+Z in tab A performs the real undo server-side, broadcasts via `publishEvent()` (decision #7); tab B receives the sync event, patches its state, and its Redo button/shortcut is now live for the exact same entry — switching tabs and hitting Ctrl+Shift+Z/Ctrl+Y in tab B redoes it there. **Approved, called out explicitly as the flagship UX**, distinct from apps where undo is a local, per-window stack. | A per-tab stack would silently lose entries on tab close/reload and couldn't do this at all. Because the stack and the pointer (`sequence`, `status`) live in Postgres and every undo/redo is a normal `publishEvent()`-broadcast mutation, cross-tab undo/redo isn't extra work — it falls out of decisions #3 and #7 for free. The one addition this requires: the frontend's history indicator (undo/redo availability, count) must be driven by the synced stack state, never by local optimistic assumptions, so it's instantly correct after switching tabs. |
| 3 | **Server owns the undo stack and enforces the ring buffer.** Every mutating service call pushes an entry via a shared `historyService.record(...)` helper, symmetric to how `publishEvent()` is the sole sync entry point. | Matches CLAUDE.md's "every mutation must call publishEvent()" convention — `historyService.record()` becomes the second mandatory call alongside `publishEvent()` for any undoable mutation, inside the same DB transaction as the write. |
| 4 | **Inverse-operation + full before-snapshot record, not a diff.** Each entry stores `entity_type`, `entity_id`, `operation` (an enum: `task_create`, `task_update`, `task_delete`, `task_complete`, `task_uncomplete`, `task_move`, `task_reorder`, `habit_toggle`, `collection_move`, ...), `before_data` (JSONB, full row snapshot pre-mutation), `after_data` (JSONB, full row snapshot post-mutation, nullable for delete). | A full snapshot (not a field-level diff) is simplest to apply correctly under concurrent schema/data drift, at the cost of some storage — acceptable given rows are small JSON and the buffer is capped at ≤20/user. Diffs would require per-field replay logic per entity type; snapshots let undo be one generic "restore before_data" (or "re-run inverse for creates/deletes") operation. |
| 5 | **Undo/Redo endpoints, not implicit stack pop client-side.** New `POST /api/v1/history/undo` and `POST /api/v1/history/redo`, each accepting `{ count?: number }` (default 1, supports "undo N entries" from the request) and returning the applied entries + resulting entity states. | Undo is itself a real mutation against real data (a task may have been touched by a collaborator since) — it must go through the same transactional, ownership-checked, sync-broadcasting path as every other write. It cannot be a pure client-side operation. |
| 6 | **Redo stack invalidated by any new undoable action after an undo**, standard undo-stack semantics: entries have a `status` (`active` / `undone`); undo flips the N most-recent `active` entries to `undone` (ordered by `sequence`, newest first) and returns them as the "redo pool"; redo flips them back; any brand-new mutation appends a fresh `active` entry and hard-deletes all currently-`undone` entries for that user (the redo pool is discarded, matching the browser/editor convention). |
| 7 | **Undo/redo broadcasts via `publishEvent()` like any other mutation**, using the underlying entity's existing `entityType`/`eventType` (e.g. undoing a delete emits `eventType: 'created'` for that task) plus a new `entityType: 'history'` / `eventType: 'undone'|'redone'` meta-event so other tabs can also refresh their history-affordance UI (e.g. disable the Undo toast/button when the stack is empty). | Multi-tab consistency is non-negotiable per the sync architecture in CLAUDE.md — undo from tab A must reflect in tab B exactly like a normal edit. |
| 8 | **Depth is configurable per-user (10/15/20) via `preferences.history_depth`**, migration adds the column with default 15, validated against `[10, 15, 20]` in `preferencesService.validatePreferences`, enforced server-side as a ring buffer: on every push, if `count(active+undone) > depth`, hard-delete the oldest entries beyond the limit. | Matches the existing `preferencesService` pattern exactly (`VALID_DATE_FORMATS`-style constant, `formatPreferences`, `PATCH /preferences`) — no new settings subsystem needed. |
| 9 | **Failure mode: skip-and-report, never crash.** If the entity referenced by a history entry no longer exists or was mutated by someone else in a conflicting way since the snapshot was taken (e.g. undo an edit but the task was hard-deleted by a collaborator), that specific entry is marked `status: 'failed'` (not applied, not retried), excluded from the ring-buffer count, and the response includes `{ applied: [...], skipped: [...] }` so the frontend can toast "Could not undo 1 of 3 actions — item no longer exists" without blocking the other N-1 entries in the batch. | "Undo N entries" implies a best-effort batch; one stale entity shouldn't abort the whole undo. Optimistic concurrency check: compare `updated_at`/`version` if present, else just attempt and catch not-found. |
| 10 | **Extend the in-house matcher (`hooks/shortcuts.ts`) with a `modifiers` field — no third-party hotkey library.** `KeyEvent`/`Binding` have zero concept of modifier keys today (`SingleBinding.key` is a bare string like `'q'`); Ctrl+Z/Cmd+Z/Shift+Ctrl+Z/Ctrl+Y can't be expressed. **Decision: extend, don't replace.** Evaluated and rejected: `tinykeys` (tiny, handles `$mod` cross-platform, but runs its own `keydown` listener — a second, parallel shortcut system alongside the existing matcher, with its own text-input-focus guard to reimplement and keep in sync with `isTextInputFocused`); `mousetrap`/`hotkeys-js` (larger, unmaintained-ish, same dual-listener problem, plus this repo has zero other runtime deps of that shape). | The existing matcher is already the single source of truth for shortcut context — `isTextInputFocused` suppression, `Escape`/`always` context, chord timing (`CHORD_WINDOW_MS`) — and it's deliberately a pure, dependency-free, unit-testable function (`shortcuts.test.ts` tests it with zero DOM). Bolting a second library's event listener on top would mean two independent systems deciding "did the user just press a shortcut," with real risk of double-fires or diverging text-input guards. A four-line additive field (`modifiers?: { ctrlOrCmd?: boolean; shift?: boolean }`, default `{}`, so every existing binding is unaffected) keeps one matcher, one mental model, one test file. **Approved.** |
| 11 | **Toast-with-inline-Undo is included as a UI complement**, shown after every undoable mutation (task complete, delete, move, habit toggle, etc.), with an "Undo" button that calls the same `POST /history/undo` (count=1) as Ctrl+Z. | This is the dominant UX pattern in comparable apps precisely because keyboard-only undo is easy to miss having just happened; it also gives non-keyboard users (mobile, trackpad-only) access to undo. Toast auto-dismiss should NOT remove the ability to undo via Ctrl+Z afterward — the toast is a shortcut to the same stack, not the only path. |

---

## Backend

### Migration `api/src/db/migrations/040_history_entries.sql` (new — confirm exact next-free number against `main` at implementation time)

```sql
CREATE TABLE history_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  sequence BIGINT NOT NULL,               -- monotonic per-user ordering (undo/redo pointer)
  entity_type VARCHAR(20) NOT NULL,       -- 'task' | 'habit' | 'collection' | 'section' | ...
  entity_id UUID NOT NULL,
  operation VARCHAR(30) NOT NULL,         -- 'task_create' | 'task_update' | 'task_delete' |
                                           -- 'task_complete' | 'task_uncomplete' | 'task_move' |
                                           -- 'task_reorder' | 'habit_toggle' | 'collection_*' ...
  before_data JSONB,                      -- full row snapshot pre-mutation (null for create)
  after_data JSONB,                       -- full row snapshot post-mutation (null for delete)
  status VARCHAR(10) NOT NULL DEFAULT 'active',  -- 'active' | 'undone' | 'failed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_history_user_sequence ON history_entries(user_id, sequence DESC);
CREATE SEQUENCE history_entries_seq;  -- per-DB monotonic source for `sequence`
```

Use the `db-migration` skill / follow existing migration authoring conventions when this is
actually implemented — not run as part of writing this spec.

Also extend `preferences` (likely piggybacking migration `040` or a `041`):
```sql
ALTER TABLE preferences ADD COLUMN history_depth SMALLINT NOT NULL DEFAULT 15;
```

### `api/src/services/historyService.ts` (new)

The undo/redo counterpart to `syncService.publishEvent()` — the single entry point every mutating
service calls.

```ts
export async function record(client: PoolClient, entry: {
  userId: string;
  collectionId?: string | null;
  entityType: SyncEntityType;
  entityId: string;
  operation: HistoryOperation;
  beforeData?: unknown;
  afterData?: unknown;
}): Promise<void>
// Inserts inside the caller's existing transaction (mirrors the activity_events INSERT pattern
// in taskService.deleteTask). Also enforces the ring buffer: deletes entries beyond
// preferences.history_depth for that user, oldest-first, and hard-deletes anything currently
// 'undone' if this is a fresh 'active' push (redo-stack invalidation, decision #6).

export async function undo(userId: string, count: number): Promise<UndoRedoResult>
export async function redo(userId: string, count: number): Promise<UndoRedoResult>
// UndoRedoResult = { applied: HistoryEntry[]; skipped: { entry: HistoryEntry; reason: string }[] }
// Each entry undo/redo runs its own sub-transaction: re-fetch current entity state, apply the
// inverse (restore before_data for update/delete; re-delete for create-undo; re-toggle for
// habit_toggle), flip status, call publishEvent() for the entity + a meta 'history' event,
// AND call activityService's insert (same as any other mutation) so undo/redo shows up in the
// project activity feed (decision #1) — e.g. "undid: deleted 'Buy milk'".
```

Each service's existing mutation function gets one extra call, inside its existing transaction,
right where `activity_events` inserts already happen (e.g. `taskService.deleteTask`,
`taskService.updateTask`, `taskService.moveTask`, `taskService.completeTask`,
`habitService.toggleCompletion`, `collectionService.updateCollection`'s move-related paths).

### `api/src/routes/history.ts` (new)

```
GET  /api/v1/history                 — list current stack (for UI, e.g. "3 actions available to undo")
POST /api/v1/history/undo  { count?: number }
POST /api/v1/history/redo  { count?: number }
```
Registered in `routes/index.ts` alongside `activityRoutes`.

### `syncService.ts` (extend)

Add `'history'` to `SyncEntityType` and `'undone' | 'redone'` are already covered by existing
`SyncEventType` values reused per-entity (see decision #7) — the only new type is the meta-event
entity type `'history'` with event types `'undone' | 'redone'`.

### `preferencesService.ts` (extend)

Add `historyDepth` to `PreferencesRow`/`formatPreferences`/`UpdatePreferencesInput`, and a
`VALID_HISTORY_DEPTHS = [10, 15, 20] as const` validated the same way `VALID_DATE_FORMATS` is.

---

## Frontend

### `app/src/api/client.ts` (extend)

```ts
export async function apiUndo(count = 1): Promise<UndoRedoResult>
export async function apiRedo(count = 1): Promise<UndoRedoResult>
export async function fetchHistory(): Promise<HistoryEntry[]>
```

### `hooks/shortcuts.ts` (extend — required matcher change, decision #10)

Current `SingleBinding`/`KeyEvent` carry no modifier info. Minimal additive extension:

```ts
export interface KeyEvent {
  key: string;
  ctrlOrCmd: boolean;   // Ctrl on Windows/Linux, Cmd (metaKey) on Mac — normalized by the caller
  shift: boolean;
  isTextInputFocused: boolean;
  timestamp: number;
}

export interface SingleBinding {
  key: string;
  modifiers?: { ctrlOrCmd?: boolean; shift?: boolean };  // undefined/false = "must NOT be pressed"
  context?: ShortcutContext;
  action: string;
}
```

`matchKey`'s single-binding lookup gains a modifier-equality check (both `ctrlOrCmd` and `shift`
must match exactly what the binding declares, defaulting to `false`) so plain `'q'` keeps matching
only when no modifiers are held, and doesn't accidentally fire on Ctrl+Q etc. This is backward
compatible: every existing binding omits `modifiers`, defaults to `{}`, unchanged behavior.

New bindings appended to `DEFAULT_BINDINGS`:
```ts
{ key: 'z', modifiers: { ctrlOrCmd: true }, context: 'global', action: 'history:undo' },
{ key: 'z', modifiers: { ctrlOrCmd: true, shift: true }, context: 'global', action: 'history:redo' },
{ key: 'y', modifiers: { ctrlOrCmd: true }, context: 'global', action: 'history:redo' },
```
The caller site (wherever `handleKey`/`window.addEventListener('keydown', ...)` currently lives —
likely `AppShell.tsx`) must be updated to populate `ctrlOrCmd`/`shift` from the native
`KeyboardEvent` (`e.metaKey || e.ctrlKey`, `e.shiftKey`) when constructing the `KeyEvent`.

### `hooks/useHistory.ts` (new)

Thin wrapper mirroring `useReorganize.ts`'s shape: exposes `undo(count)`/`redo(count)`, wires the
`history:undo`/`history:redo` shortcut actions, calls `apiUndo`/`apiRedo`, then either patches
Zustand stores directly from the returned entity states (fast path, same pattern as `taskStore`'s
`setTasks/updateTask/removeTask`) or invalidates the relevant React Query keys — whichever the
touched `entityType` normally uses for that mutation kind (task changes go through
`optimistic.ts`-style patches + `taskStore`; habit changes through the habit store/query keys).
Also subscribes to the `'history'` sync event so a second tab's stack-availability indicator stays
in sync.

### Toast-with-inline-Undo (extend existing toast/notification component, decision #11)

Every call site that already does a mutation (`completeTask`, `deleteTask`, `moveTask`, habit
toggle, etc.) — surface a toast with an "Undo" action button that calls `apiUndo(1)`. Reuse
whatever toast primitive already exists in the app (grep for existing toast/snackbar component
before adding a new one).

### `SettingsPage.tsx` (extend)

New "History depth" control (radio/segmented control: 10 / 15 / 20), wired through
`usePreferences.ts`'s existing `PATCH /preferences` mutation path — same pattern as the font/theme
controls already on that page.

### i18n (`en.ts` + `pt-BR.ts`)

```
history.undo            'Undo'                 / 'Desfazer'
history.redo            'Redo'                 / 'Refazer'
history.undoToast       'Undid: {{action}}'    / 'Desfeito: {{action}}'
history.skipped         'Could not undo {{count}} action(s) — item no longer exists'
                                                 / 'Não foi possível desfazer {{count}} ação(ões) — item não existe mais'
settings.historyDepth   'History depth'        / 'Profundidade do histórico'
```

---

## Risks / mitigations

- **Cross-service snapshot drift** — a generic `before_data`/`after_data` JSONB restore assumes
  the entity's shape hasn't changed structurally since the entry was recorded (e.g. a column was
  dropped in a later migration). Mitigation: undo/redo apply is defensive — unknown/missing
  columns in the snapshot are ignored on restore (partial `UPDATE ... SET` from whatever keys are
  present), never a hard schema match.
- **Concurrent mutation during undo** — flagged in decision #9 (skip-and-report). Additionally,
  undo of a `task_move`/`task_reorder` could conflict with another concurrent reorder; treat the
  same as any other stale-entity case — attempt, catch, skip, report.
- **Ring-buffer race across tabs** — two tabs mutating simultaneously could both push near the
  depth limit; the `sequence` column (from a DB sequence, not client-generated) plus the eviction
  query being part of the same transaction as the push avoids double-counting.
- **Toast fatigue** — showing a toast on every single mutation could be noisy for power users doing
  bulk operations (e.g. reorganize's batch move). Mitigation: batch operations like
  `POST /tasks/reorganize` record ONE history entry per moved task but should coalesce into a
  single toast ("Undo reorganize (10 tasks)") rather than 10 separate toasts — the toast layer
  groups by a shared `batchId` if the mutation call was a batch endpoint.
- **Matcher extension breaking existing shortcuts** — decision #10's `modifiers` field is additive
  and defaults to `{}`; existing tests in `shortcuts.test.ts` must be re-run/extended, not just
  trusted, before this ships.

---

## Verification

```bash
docker compose exec api npm run build && docker compose exec api npm run lint
docker compose exec app npm run build && docker compose exec app npm run lint
docker compose exec api npm test && docker compose exec app npm test
```

**Automated tests:**
- `api/src/services/__tests__/historyService.test.ts` — record/ring-buffer eviction, undo/redo
  status flips, redo-stack invalidation on new action, skip-on-stale-entity.
- `api/src/routes/__tests__/history.test.ts` — auth guard, `count` param, response shape.
- Extend `api/src/services/__tests__/taskService.test.ts` / `habitService.test.ts` for the new
  `historyService.record()` calls inside each mutation.
- `app/src/hooks/__tests__/shortcuts.test.ts` — extend for modifier matching (Ctrl+Z fires,
  bare `z` doesn't fire undo, Shift+Ctrl+Z fires redo, Ctrl+Y fires redo, existing bare-key
  bindings unaffected).
- `app/src/hooks/__tests__/useHistory.test.ts` — undo/redo call wiring, sync-event handling.

**Manual, in the browser:**
1. Create/complete/delete/move several tasks and toggle a habit → each shows an Undo toast.
2. Press Ctrl+Z (Cmd+Z on Mac) repeatedly → actions reverse in LIFO order.
3. Press Shift+Ctrl+Z / Ctrl+Y → redo restores them.
4. Perform a new action after an undo → redo stack clears (Ctrl+Y does nothing further).
5. Open two tabs, undo in tab A → tab B reflects the change and its stack indicator updates.
6. Set history depth to 10 in Settings, perform 15 actions → only the last 10 are undoable.
7. Delete a task in tab A, then undo that delete from tab A after a collaborator (tab B, different
   user) permanently deleted a *different dependent* record → graceful skip + toast, no crash.

---

## Status

Reviewed and approved by the user (2026-08-13): decisions #1 (dedicated table + activity_events
dual-write), #2 (per-user shared stack, cross-tab redo as flagship feature), #3–#9, and #10
(extend in-house matcher, no third-party hotkey library) are all confirmed. Ready to move to an
implementation plan (`writing-plans` skill) when work on this begins.
