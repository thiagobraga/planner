# Phase 3 - Habits Page (UI & Frontend Logic)

**Status:** Ready for implementation  
**Dependencies:** Phase 1 (for ContextMenu reuse)  
**Estimated scope:** 4 new files, 2 modified files

## Context

The current `HabitsPage.tsx` is a static prototype. It demonstrates the 12-week dot-based grid and the capsule sequence connection (consecutive days fuse their borders), but uses hardcoded seed data and has no UI for creating, editing, or deleting habits.

This phase transforms the prototype into a fully functional frontend page with CRUD UI, ready to be wired up to the backend in Phase 4.

## Proposed Changes

### 1. Refactor Habits Component Architecture

Break down the monolithic `HabitsPage.tsx` into reusable components:

#### [NEW] `app/src/components/habits/HabitGrid.tsx`

- Responsible purely for rendering the 12-week grid (dot-based grid).
- Accepts `completions` (Set of ISO date strings), `onToggle(isoDate, isCompleted)`, and `today`.
- Implements the capsule rule (sequence connection) for border radiuses.

#### [NEW] `app/src/components/habits/HabitBlock.tsx`

- Renders a single habit (Header, Stats, and includes `HabitGrid`).
- Uses `ContextMenu` (from Phase 1) on a "more options" button in the header (Edit, Delete).
- Computes streak stats (current chain, longest chain, 30-day rate).

### 2. Frontend State & UI Forms

#### [NEW] `app/src/components/habits/HabitForm.tsx`

- Reusable form (used for Create and Edit) with inputs for:
  - `name` (text, max 100 chars)
  - `note` (text, optional)
- Uses the standard `Input` component.

#### [MODIFY] `app/src/pages/HabitsPage.tsx`

- Remove the hardcoded `HABITS` constant.
- Implement a "Create Habit" button at the top/bottom of the page.
- Add local state `useState` to manage the list of habits (while waiting for Phase 4 API integration).
- Build the "Create" and "Edit" inline dialogs or expandable sections.

### 3. API Stubs (Preparation for Phase 4)

#### [MODIFY] `app/src/api/client.ts`

Add TypeScript interfaces and stub functions (that currently just return local/mocked data) so the UI can be built against the final contract:

- `export interface ApiHabit { id: string; name: string; note?: string; orderValue: number; }`
- `fetchHabits()`, `apiCreateHabit()`, `apiUpdateHabit()`, `apiDeleteHabit()`, `apiToggleHabitCompletion()`

## Design System Constraints

- Maintain the 12-week grid layout (fits exactly into the desktop view).
- Grid cells: 16x16px, 6px gap.
- "Dot-based grid": Empty cells are `border-dot`, filled cells are `bg-ink`, today is `1.5px solid ink`.
- Capsule rule: when left/right cells are also completed, `borderRadius` drops to `0` on the connecting edge.

## Files Changed Summary

| File                                       | Action | Description                              |
| ------------------------------------------ | ------ | ---------------------------------------- |
| `app/src/components/habits/HabitGrid.tsx`  | NEW    | 12-week tracking grid with capsule logic |
| `app/src/components/habits/HabitBlock.tsx` | NEW    | Wrapper for a single habit + stats       |
| `app/src/components/habits/HabitForm.tsx`  | NEW    | Add/edit form UI                         |
| `app/src/pages/HabitsPage.tsx`             | MODIFY | Wire up components, add creation UI      |
| `app/src/api/client.ts`                    | MODIFY | Add interfaces and stubs for Habits API  |

## Verification

- Can add a new habit to the page (in local state).
- Can edit a habit's name/note.
- Can click cells in the grid to toggle them.
- Streak numbers update immediately when clicking cells.
- Consecutive clicked cells form a capsule (sequence connection).
