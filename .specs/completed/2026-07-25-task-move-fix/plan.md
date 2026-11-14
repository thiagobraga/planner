# Task Move Fix — Plan

## Context

`PATCH /api/v1/tasks/:id/move` has two confirmed problems:

1. **Wrong drop position.** Dragging a task down past its own original position in the
   list saves it further down than where it was actually dropped.
2. **Bloated response.** The endpoint returns full `formatTask()` rows (every column) for
   every task whose order shifted — routinely dozens of tasks for a single-row drag —
   which the frontend then spreads into brand-new object references, defeating
   `TaskItem`'s `React.memo` for rows that didn't need to change at all.

Both are traced to root cause, not just symptoms:

- **Bug 1** lives in `app/src/utils/taskProjection.ts` (`projectMove`) and its two callers
  (`app/src/hooks/useTaskDrag.ts:resolveMove`, `app/src/components/TaskList.tsx`). The
  drop target's index is computed **before** the dragged block is removed from the row
  list, but consumed **after** removal — whenever the block sits earlier in the list than
  the target, the index overshoots by the block's length.
- **Bug 2** stems from `api/src/services/taskService.ts`'s `renumberCollectionScope` /
  `renumberDayScope`, which do a full `i * 1000` rewrite of **every** sibling on every
  move (a "splice into ordered array, renumber everyone" scheme), and
  `normalizeCollectionScope` / `normalizeDayScope`, which do the same to the *source*
  list. `moveTask` then re-fetches and returns full rows for all of it.

The fix replaces the index-passing contract in `projectMove` with an id-based lookup
(eliminating the whole bug class, not just this instance), and replaces the "renumber
everyone" ordering scheme with midpoint/gap-based insertion (the sibling `order_value`s
are already spaced 1000 apart specifically to support this), falling back to today's full
renumber only on the rare occasion a gap collapses. This cuts writes, response size, and
frontend re-renders down to the 1 row that actually moved in the common case, without
touching `TaskList`'s rendering architecture or introducing React Query/Zustand for this
path (that would be a much larger, unrelated rewrite).

## Approach

### 1. Fix the position bug (frontend, isolated, do first)

`app/src/utils/taskProjection.ts`: change `projectMove` and `applyProjection` to take
`overId: string | null` instead of `overIndex: number` (`null` = append at end of scope).
Resolve the target's index **inside** the function, after `removeBlock`, via a shared
`resolveAt(rest, overId)` helper — both functions call it against `rest` (post-removal),
so they can no longer disagree, and no caller can hand in a now-stale pre-removal index.

Update the two call sites to pass the row id instead of a derived index:
- `app/src/hooks/useTaskDrag.ts` (`resolveMove`, ~lines 338-344)
- `app/src/components/TaskList.tsx` (~line 121)

Untouched: `MAX_DEPTH`/depth-clamp math, `insertBlock`'s own clamp, the
`over.kind === 'collection' | 'day'` branches in `resolveMove` (never call `projectMove`,
keep the `Number.MAX_SAFE_INTEGER` position sentinel as today).

### 2. Gap-based (midpoint) reordering, minimal writes

`api/src/services/taskService.ts`: add `midpointOrFallback(prev, next)` — returns the
integer midpoint between two gap-numbered `order_value`s, or `null` if there's no integer
room (collision).

- `renumberCollectionScope`: keep the existing sibling `SELECT ... FOR UPDATE` (same
  locking guarantee), but instead of splicing and rewriting every id, compute the midpoint
  at the target position. Non-null → single `UPDATE` for the moved task only. Null
  (collision) → fall back to today's splice + `i * 1000` rewrite loop.
- `normalizeCollectionScope`: delete it and its call site (the `sourceDiffers` branch in
  `moveTask`). With gap numbering, removing a task from a list doesn't require touching
  the remaining siblings.
- `renumberDayScope`: same midpoint idea against `task_order.position`, but only when
  **both** neighbors at the target position already have a materialized `task_order` row
  (mixing raw `order_value` with `task_order.position` isn't valid). Unseeded neighbors →
  keep today's full-seed-and-rewrite loop.
- `normalizeDayScope`: delete it and its call site, same reasoning.
- `appendToDayScope`: already single-row — no change.

Preserve unchanged: `MAX_DEPTH` check, subtree depth/collection/date carry-over to
descendants, the day-membership carry-over block, the transaction boundary, and the
`Number.MAX_SAFE_INTEGER` append-sentinel clamp semantics.

`moveTask`'s post-commit read: drop the broad `reorderedResult` re-query — build
`reordered` directly from whatever `renumberCollectionScope`/`renumberDayScope` returned
(0-2 rows in the common case).

Leave the Socket.IO `publishEvent()` call untouched — separate transport to other
sessions/tabs, and its full-task payload shape is explicitly documented as load-bearing
for existing consumers.

### 3. Trim the HTTP response payload

Add a `MovedTaskSummary` shape in `taskService.ts` (`id, parentTaskId, collectionId,
dueDate, orderValue, depth` — no `sectionId`, the frontend never reads it) and map
`moved`/`reordered` to it before returning.

`app/src/api/client.ts`: change `TaskMoveResponse` to use `MovedTaskSummary[]` instead of
`ApiTask[]`. `apiMoveTask` itself is unchanged.

`app/src/hooks/useTaskDrag.ts` (`.then()` handler): field reads already match the trimmed
shape — purely a type-level change. Add a cheap no-op guard so a task whose patched fields
didn't actually change keeps its object identity (skips `TaskItem`'s memo instead of
forcing a re-render for nothing).

No route-handler change needed — `api/src/routes/tasks.ts` already forwards `moveTask`'s
return value as-is.

### 4. Tests

- `api/src/services/__tests__/taskService.move.test.ts`: update the "1000-unit gap"
  assertion to expect a single midpoint write; add a "collision falls back to full
  renumber" test; split the day-scope reorder test into seeded-neighbors (fast path) and
  unseeded-neighbors (fallback) cases.
- `app/src/utils/__tests__/taskProjection.test.ts`: update call sites to the new
  `overId`-based signature; add a regression test dragging the first of 3 siblings down
  onto the last, asserting it lands immediately before it (not past it).
- `app/src/hooks/__tests__/useTaskDrag.parity.test.ts`: update the call site; add a
  `position` parity assertion (today only checks `depth`/`parentTaskId`, which is why
  preview and commit silently agreed on the wrong answer).
- `api/src/routes/__tests__/tasks.test.ts` and `taskService.sync.test.ts`: no changes
  needed (mock `taskService` wholesale / don't test `moveTask`).

### 5. Optional — composite index

`renumberCollectionScope`'s neighbor query filters on `collection_id, section_id,
parent_task_id` with no `user_id` predicate — no existing index covers that shape. Add
migration `031_task_collection_scope_index.sql`:

```sql
CREATE INDEX idx_tasks_collection_scope_ordered
  ON tasks(collection_id, section_id, parent_task_id, order_value, created_at);
```

Use the `db-migration` skill when authoring it, to match house conventions.

## Verification

1. `docker compose exec api npm test` and `docker compose exec app npm test` — all updated
   and new tests pass.
2. `docker compose exec api npm run build && docker compose exec app npm run build` — no
   type errors from the `TaskMoveResponse`/`projectMove` signature changes.
3. Manual, in the running dev app: create 3+ sibling tasks, drag the first down past the
   third, confirm it lands exactly where dropped.
4. DevTools Network tab: drag a task within a list of ~10+ siblings, compare the
   `PATCH /tasks/:id/move` response body before/after — confirm it shrinks from N full
   task objects to 1-2 trimmed summaries in the common case.
5. React DevTools Profiler: confirm only the moved row (and, on a forced collision
   fallback, the renumbered siblings) re-render — not the whole list.
6. Exercise cross-collection and cross-date drags (sidebar drop, Daily date-crossing) to
   confirm carry-over/`MAX_DEPTH`/day-membership behavior is unchanged.
