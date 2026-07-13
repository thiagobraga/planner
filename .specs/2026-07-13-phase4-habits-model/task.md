# Phase 4 — Habits Model & Daily Integration

- [x] Create `api/src/db/migrations/021_habits.sql`
  - [x] `habits` table (user_id, name, note, order_value, timestamps)
  - [x] `habit_completions` table (habit_id, completed_date, timestamps)

- [x] Create `api/src/services/habitService.ts`
  - [x] Implement `listHabits(userId)`
  - [x] Implement `createHabit`
  - [x] Implement `updateHabit`
  - [x] Implement `deleteHabit`
  - [x] Implement `toggleCompletion`
  - [x] Add `publishEvent` calls to all mutations

- [x] Create `api/src/routes/habits.ts`
  - [x] Mount CRUD endpoints
  - [x] Add to `api/src/routes/index.ts`

- [x] Update `app/src/api/client.ts`
  - [x] Replace mock implementations from Phase 3 with `fetch` calls to backend API

- [x] Refactor `app/src/pages/HabitsPage.tsx`
  - [x] Integrate React Query `useQuery` for fetching habits
  - [x] Call real mutations
  - [x] Subscribe to `useSync` for real-time updates

- [x] Update `app/src/pages/DailyPage.tsx`
  - [x] Fetch habits alongside tasks
  - [x] Render a new "Habits" section showing today's habits
  - [x] Implement toggle handler that updates backend directly from Daily page
