# Phase 3 — Habits UI

- [ ] Create `app/src/components/habits/HabitGrid.tsx`
  - [ ] Extract the 12-week grid rendering logic from `HabitsPage.tsx`
  - [ ] Accept `completions` Set, `today` Date, and `onToggle` callback
  - [ ] Implement capsule sequence border logic internally

- [ ] Create `app/src/components/habits/HabitBlock.tsx`
  - [ ] Extract header and stats logic from `HabitsPage.tsx`
  - [ ] Render `HabitGrid`
  - [ ] Add "more options" button to header that opens a `ContextMenu` (Edit, Delete)
  - [ ] Calculate chain stats (current streak, longest, 30-day rate)

- [ ] Create `app/src/components/habits/HabitForm.tsx`
  - [ ] Form for name and optional note
  - [ ] Submit and Cancel buttons

- [ ] Update `app/src/api/client.ts`
  - [ ] Add `ApiHabit` interface
  - [ ] Add stub functions: `fetchHabits`, `apiCreateHabit`, `apiUpdateHabit`, `apiDeleteHabit`, `apiToggleHabitCompletion`

- [ ] Refactor `app/src/pages/HabitsPage.tsx`
  - [ ] Remove hardcoded `HABITS` constant
  - [ ] Add "Create Habit" button at the top/bottom
  - [ ] Map over list of habits to render `HabitBlock`s
  - [ ] Manage local state for CRUD (creation, editing, deleting) before the real backend is wired up
