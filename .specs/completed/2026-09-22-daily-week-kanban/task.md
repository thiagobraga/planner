# Task Breakdown: Daily Page Week Kanban View

Detailed implementation breakdown with technical architecture and actionable subtasks.

## Key existing infrastructure this reuses

- `useTaskDrag.ts` (already mounted on `DailyPage` for the chronological list) already resolves a drop with `over.kind === 'day'` to `{ dueDate: over.date, scope: { kind: 'day', dueDate: over.date } }` (`:320-334`) - this is reused as-is for the 7 day columns, no new hook. See section 3.
- `TaskMoveInput`/`apiMoveTask` already accept `dueDate` directly (`app/src/api/client.ts:410-452`) - no API changes needed.
- `BoardCard.tsx` (`app/src/components/board/`) is reused as-is - it's already `ApiTask`-based and groupBy-agnostic (drag via `useSortable`, `onToggle`, reads `task.dueDate`). `BoardColumn.tsx`/`BoardView.tsx` are NOT reused directly: both are typed to `BoardGroupBy`/`BoardColumnModel` and carry column reorder/rename/recolor/delete logic that doesn't apply to fixed day columns. `DailyWeekBoard.tsx` builds its own column shell (`useDroppable`, same droppable pattern `BoardColumn.tsx:60-70` shows, without the `useSortable` column-drag-handle part).
- `buildWeekDays`, `startOfWeek`, `shiftWeek`, `weekdayShortNames`/`weekdayColumnIndex` (`app/src/utils/date.ts`) already compute weekStart-aware week ranges, proven in `HabitTimeline.tsx`.

---

## 1. Column model and task slotting (pure logic, TDD first)

- [x] **1.1 `buildDayColumns(weekAnchor, today, weekStart)` in `app/src/utils/dayColumns.ts`**
  - [x] Returns `[{ id: 'overdue', ... }, ...7 day columns from buildWeekDays..., { id: 'no-date', ... }]`
  - [x] Unit tests: correct column order, correct dates for both `weekStart` settings, droppable flags (`app/src/utils/__tests__/dayColumns.test.ts`)
- [x] **1.2 `slotTaskIntoColumn(task, todayKey)` pure function**
  - [x] Unit tests covering overdue/today/future/no-date branches

## 2. `DailyWeekBoard.tsx` + `DailyBoardColumn.tsx` components

- [x] **2.1 `DailyWeekBoard` props**: `tasks`, `weekAnchor`, `today`, `todayKey`, `weekStart`, `onWeekChange`, `onToggle` (visibility filtering happens server-side via prefs before tasks reach DailyPage, same as the list view - no separate props needed here)
- [x] **2.2 `DailyBoardColumn`**: own `useDroppable` with `DayDropData`/`NoDateDropData`, disabled for the Overdue column; renders header (title + count) + `BoardCard` list
- [x] **2.3 9 columns rendered** via `buildDayColumns` + a `Map<columnId, tasks>` built once from `slotTaskIntoColumn` (avoids an O(n²) re-filter per column)
- [x] **2.4 Week nav**: `StripNavigator` + `shiftWeek`/`formatWeekRangeLabel`, matching `HabitTimeline`'s header
- [x] **2.5 Cards**: `BoardCard` reused directly via a small local `Task → ApiTask` adapter (`toApiTask` in `DailyWeekBoard.tsx`)

## 3. Drag resolution - reused `useTaskDrag`, no new hook

`useTaskDrag.ts`'s existing `over.kind === 'day'` branch handles all 7 day columns for free. Added:

- [x] **3.1 Overdue column**: no `useDroppable` registration - confirmed not a valid target
- [x] **3.2 `NoDateDropData` + `'no-date'` `DropKind`** added to `app/src/types/drag.ts`
- [x] **3.3 New `resolveMove()` branch** for `over.kind === 'no-date'`: clears `dueDate`, files into `{ kind: 'collection', collectionId: active.collectionId }`
  - [x] Unit test: `app/src/hooks/__tests__/useTaskDrag.noDate.test.tsx`
- [x] **3.4 Confirmed** via the DailyPage kanban integration test - real `useTaskDrag` + real `DndContext`, no mocking of drag internals

## 4. Wire into `DailyPage.tsx`

- [x] **4.1** `dailyKanban` state (page-local, not persisted) + `weekAnchor` state
- [x] **4.2** VIEW row's `onViewChange` now flips `dailyKanban` instead of navigating to `/collections`; `view` prop reflects it
- [x] **4.3** Body swaps between the chronological list and `<DailyWeekBoard>` based on `dailyKanban`
- [x] **4.4** SHOW toggles unchanged - filtering already happens server-side via `prefs`, `allTasks` passed to the board is already filtered

## 5. Tests

- [x] **5.1** `app/src/utils/__tests__/dayColumns.test.ts` - 7 tests
- [x] **5.2** `app/src/hooks/__tests__/useTaskDrag.noDate.test.tsx` - 1 test (no separate hook needed, see section 3)
- [x] **5.3** `app/src/pages/__tests__/DailyPage.kanban.test.tsx` - 3 tests: view switch, column slotting, week nav
- [ ] **5.4** Playwright E2E drag-reschedule - not added. dnd-kit's pointer sensor isn't reachable through generic browser-automation drag (`page.dragTo`, HTML5 DragEvents) - confirmed by hand in this session - and the rest of this codebase's own test suite resolves the same limitation by unit-testing `resolveMove`/mounted-hook `handleDragEnd` directly rather than simulating a real pointer drag (see every `useTaskDrag.*.test.tsx` file). 5.2 covers the new branch the same way. A real Playwright E2E would need dnd-kit's documented keyboard-sensor drive path if this becomes a priority later.

## 6. Manual verification

- [x] Visual check in browser at `https://planner.local/daily`: entered kanban, confirmed all 9 columns, week nav (Sep 20-26 → next week), card rendering matches Collections' kanban style
- [x] Screenshots: `app/dist/screenshots/daily-week-kanban.png`

## 7. Kanban card refinement

- [x] Remove the Daily board's column frames and align column-title baselines with the 24px dot grid.
- [x] Reduce simple card height by 24px while retaining the subtask drop target.
- [x] Replace empty drop messaging with an Add task button and inline card editor, including Save/Enter, Escape/cancel, and failed-save retry.
- [x] Create tasks with the selected date (undated in Migrate), and load board tasks from existing Inbox/Collection views so future and undated cards survive reload.
- [x] Regression tests: 41 tests across Daily, board components, day columns, and no-date dragging passed.
- [x] Real-backend Playwright: dated, undated, and next-week creation, reload persistence, compact cards, baseline alignment, mobile editing/cancellation, and no page errors.
- [x] Screenshots: `app/dist/screenshots/daily-kanban-refined-desktop.png` and `app/dist/screenshots/daily-kanban-refined-mobile.png`.
