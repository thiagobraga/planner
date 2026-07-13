# Phase 4 — Habits Model & Daily Integration

**Status:** Ready for implementation  
**Dependencies:** Phase 3 (Habits UI)  
**Estimated scope:** 1 DB migration, 2 backend files, 3 frontend files

## Context

Phase 3 established the frontend UI for habits. This phase implements the backend data model and integrates habits into the Daily page, bringing habits and tasks into a unified daily view.

## Database Schema

#### [NEW] `api/src/db/migrations/021_habits.sql`

```sql
CREATE TABLE habits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  note TEXT,
  order_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_habits_user ON habits(user_id, order_value, created_at);

CREATE TABLE habit_completions (
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL, -- YYYY-MM-DD in user's timezone
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (habit_id, completed_date)
);
```

## Backend Services

#### [NEW] `api/src/services/habitService.ts`
- `listHabits(userId)`: Returns all habits and their completions for the last 12 weeks.
- `createHabit(userId, name, note)`
- `updateHabit(userId, habitId, updates)`
- `deleteHabit(userId, habitId)`
- `toggleCompletion(userId, habitId, date, isCompleted)`

*Sync Integration:* Operations must emit `SyncEvent` (entityType: 'habit' and 'habit_completion') via `publishEvent()` for real-time multi-tab updates.

#### [NEW] `api/src/routes/habits.ts`
- Expose the standard REST endpoints mapped to `habitService`.
- Wire into `api/src/routes/index.ts`.

## Frontend API Integration

#### [MODIFY] `app/src/api/client.ts`
- Implement the stubs created in Phase 3 to make actual HTTP requests.
- Add React Query hooks `useHabits` in a new file or use `queryClient`.

#### [MODIFY] `app/src/pages/HabitsPage.tsx`
- Replace local state with `useQuery(['habits'])`.
- Wire up mutations for CRUD.
- Subscribe to `useSync` for real-time updates.

## Daily Integration

Habits should be actionable directly from the Daily page.

#### [MODIFY] `app/src/pages/DailyPage.tsx`
- Fetch the user's habits.
- Create a new section above or below the Today tasks, titled "Habits".
- Render each habit as a row, with a checkbox for today's completion.
- Toggling the checkbox updates `habit_completions` for today.

## Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `api/src/db/migrations/021_habits.sql` | NEW | Habits schema |
| `api/src/services/habitService.ts` | NEW | Habits business logic |
| `api/src/routes/habits.ts` | NEW | Habits endpoints |
| `api/src/routes/index.ts` | MODIFY | Mount habits router |
| `app/src/pages/DailyPage.tsx` | MODIFY | Integrate habits into today view |
| `app/src/api/client.ts` | MODIFY | Wire real API endpoints |

## Verification
- Run `pnpm -F api db:migrate` and check tables exist.
- Creating a habit on HabitsPage persists it.
- Completing a habit on HabitsPage persists the completion.
- Navigating to DailyPage shows the habit.
- Checking it on DailyPage reflects instantly on HabitsPage (via sync/cache).
