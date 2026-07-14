# Phase 3 - Habits UI

- [x] Create `app/src/components/habits/HabitGrid.tsx`
  - [x] Extract the 12-week grid rendering logic from `HabitsPage.tsx`
  - [x] Accept `completions` Set, `today` Date, and `onToggle` callback
  - [x] Implement capsule sequence border logic internally

- [x] Create `app/src/components/habits/HabitBlock.tsx`
  - [x] Extract header and stats logic from `HabitsPage.tsx`
  - [x] Render `HabitGrid`
  - [x] Add "more options" button to header that opens a `ContextMenu` (Edit, Delete)
  - [x] Calculate chain stats (current streak, longest, 30-day rate)

- [x] Create `app/src/components/habits/HabitForm.tsx`
  - [x] Form for name and optional note
  - [x] Submit and Cancel buttons

- [x] Update `app/src/api/client.ts`
  - [x] Add `ApiHabit` interface
  - [x] Add stub functions: `fetchHabits`, `apiCreateHabit`, `apiUpdateHabit`, `apiDeleteHabit`, `apiToggleHabitCompletion`

- [x] Refactor `app/src/pages/HabitsPage.tsx`
  - [x] Remove hardcoded `HABITS` constant
  - [x] Add "Create Habit" button at the top/bottom
  - [x] Map over list of habits to render `HabitBlock`s
  - [x] Manage local state for CRUD (creation, editing, deleting) before the real backend is wired up
