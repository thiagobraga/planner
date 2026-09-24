# Specification: Daily Page Week Kanban View

## Feature Summary & User Goals

The Daily page gets a new Kanban mode. Instead of navigating away to Collections, clicking the Kanban icon in the header's VIEW row switches the Daily page itself into a week-based board: one column per day of the current week, plus an Overdue column and a No-date column, so a user planning their week can see everything at a glance and drag tasks between days to reschedule them.

### 1. Entering Kanban mode
- The VIEW row's Kanban icon (in the hamburger menu) toggles Daily page into kanban mode instead of navigating to `/collections`.
- List icon returns to the normal chronological list.
- Calendar icon still navigates to `/monthly` (unchanged).
- Kanban mode is a page-local, non-persisted UI state (resets to list on reload), matching how Collections' kanban/list toggle already behaves per-collection but scoped only to this page visit.

### 2. Columns
- **Overdue** (leftmost): tasks whose due date is before today. Display-only - cannot drop a card here.
- **7 day columns**: one per day of the current week, using the user's `weekStart` preference (Sunday or Monday first), same week-computation already used by the Habits timeline. Each column header shows the weekday + date (e.g. "SUN 21").
- **No-date** (rightmost): tasks with no due date. A valid drop target - dropping a card here clears its due date.
- Prev/next week navigation arrows above the columns move the 7 day columns forward/back a week; Overdue and No-date stay fixed regardless of which week is shown.

### 3. Cards
- Each card shows the same task info as the existing Collections kanban cards (title, priority, labels, subtask count).
- Completed tasks and old notes respect the existing "Completed tasks" / "Old notes" SHOW toggles from the header menu - same preference, same behavior as the current Daily list view.

### 4. Dragging to reschedule
- Dragging a card from one day column to another changes that task's due date to the target day.
- Dragging a card into the No-date column clears its due date.
- Dragging a card out of Overdue into a day column sets its due date to that day (resolves the overdue state).
- Cards cannot be dropped into the Overdue column.
- Reschedule is optimistic (updates immediately, rolls back on API failure) and syncs to other sessions/tabs the same way every other task mutation does (through the existing `publishEvent` real-time sync path - no new sync code needed, the reschedule goes through the same task-move endpoint collections kanban already uses).

## Relevant Files

- `app/src/pages/DailyPage.tsx` - Daily page, gains kanban/list local view state, wires the new board in.
- `app/src/components/ui/ViewToolbar.tsx` - Kanban click currently only supports `onViewChange`; Daily page will pass a local setter instead of a navigate call.
- `app/src/components/board/DailyWeekBoard.tsx` (new) - renders the 9 columns and cards for the week-kanban view.
- `app/src/hooks/useTaskDrag.ts` - reused as-is for day-column drops (its existing `'day'`-kind drop resolution already sets due date + `{kind:'day'}` scope); gains one new branch for the No-date column's `'no-date'` drop kind.
- `app/src/types/drag.ts` - gains one new `NoDateDropData` / `'no-date'` `DropKind` variant.
- `app/src/utils/date.ts` - reuses existing `buildWeekDays`, `startOfWeek`, `shiftWeek`, `weekdayInitials`.
- `app/src/components/board/BoardCard.tsx` - reused as-is (task card chrome, already groupBy-agnostic). `BoardColumn.tsx`/`BoardView.tsx` are NOT reused directly - they're tightly coupled to `BoardGroupBy`/column reorder/rename/recolor, none of which apply to fixed day columns; `DailyWeekBoard.tsx` builds its own column shell following the same `useDroppable` pattern.
- `app/src/api/client.ts` - `apiMoveTask` (existing, reused as-is).
- `app/src/pages/__tests__/DailyPage.kanban.test.tsx` (new) - integration tests for entering kanban mode, column contents, drag-reschedule.
- `app/src/hooks/__tests__/useTaskDrag*.test.ts` - gains a case for the new `'no-date'` resolution branch.
- `app/e2e/` - Playwright E2E test for the drag-reschedule flow.

## Explicitly Out of Scope

- Changing Collections' or Inbox's kanban (status-based) board in any way.
- Persisting Daily's kanban/list choice across reloads.
- Making Overdue a valid drop target.
- Multi-week or month-at-a-glance kanban views.
