# Phase 4 — Habits Model & Daily Integration

- [ ] Create `api/src/db/migrations/021_habits.sql`
  - [ ] `habits` table (user_id, name, note, order_value, timestamps)
  - [ ] `habit_completions` table (habit_id, completed_date, timestamps)

- [ ] Create `api/src/services/habitService.ts`
  - [ ] Implement `listHabits(userId)`
  - [ ] Implement `createHabit`
  - [ ] Implement `updateHabit`
  - [ ] Implement `deleteHabit`
  - [ ] Implement `toggleCompletion`
  - [ ] Add `publishEvent` calls to all mutations

- [ ] Create `api/src/routes/habits.ts`
  - [ ] Mount CRUD endpoints
  - [ ] Add to `api/src/routes/index.ts`

- [ ] Update `app/src/api/client.ts`
  - [ ] Replace mock implementations from Phase 3 with `fetch` calls to backend API

- [ ] Refactor `app/src/pages/HabitsPage.tsx`
  - [ ] Integrate React Query `useQuery` for fetching habits
  - [ ] Call real mutations
  - [ ] Subscribe to `useSync` for real-time updates

- [ ] Update `app/src/pages/DailyPage.tsx`
  - [ ] Fetch habits alongside tasks
  - [ ] Render a new "Habits" section showing today's habits
  - [ ] Implement toggle handler that updates backend directly from Daily page
