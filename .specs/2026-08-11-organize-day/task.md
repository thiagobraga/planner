# Organize Day + Inline Upcoming — Tasks

## Backend

- [x] Create `api/src/routes/reorganize.ts` — batch `POST /tasks/reorganize` endpoint
- [x] Register route in `api/src/routes/index.ts` (before `/tasks/:id`)
- [x] Write tests for reorganize endpoint (`reorganize.test.ts`)

## Frontend — API & Hooks

- [x] Add `apiReorganizeTasks()` to `app/src/api/client.ts`
- [x] Create `app/src/hooks/useReorganize.ts` (algorithm + state machine)
- [x] Write tests for `useReorganize` hook

## Frontend — DailyPage

- [x] Add Upcoming toggle state + fetch (`showUpcoming`, `fetchUpcomingTasks`)
- [x] Render upcoming sections above today/overdue sections
- [x] Integrate `useReorganize` hook
- [x] Update header toolbar: `[Reorganize] [Upcoming] [Today] [✓] [📝]`
- [x] Render inline "Confirm? Yes · No" when in preview state
- [x] Write DailyPage integration tests (basic coverage; full E2E in browser)

## i18n

- [x] Add English keys (`reorganize.button`, `reorganize.confirm`, `common.yes`, `common.no`)
- [x] Add Portuguese keys

## Styling

- [x] Add reorganize confirmation prompt styles to `index.css`

---

## Test Coverage Summary

### Backend (`api/src/routes/__tests__/reorganize.test.ts`)
- ✅ Happy path: 10 tasks → 5+5 redistribution
- ✅ Validation: empty array, max 100 items, ISO date format
- ✅ Auth: task ownership check, not-found handling
- ✅ Business logic: rejects subtasks, rejects completed tasks
- ✅ Response: returns `{ updated: n }`

### Frontend Hook (`app/src/hooks/__tests__/useReorganize.test.ts`)
- ✅ Threshold detection: shows button ≥8 tasks, hides <8
- ✅ Filtering: excludes completed, subtasks, notes
- ✅ Algorithm: distributes ≤5 per day, only records actual changes
- ✅ State machine: idle → preview → persisting → idle, cancel path
- ✅ Date generation: consecutive dates from today

### Frontend DailyPage
- Manual testing documented in FEATURE_SUMMARY.md (browser-based scenarios)

## Follow-up: remove standalone Upcoming page

- [x] Delete `app/src/pages/UpcomingPage.tsx` (dead, unrouted) + its test
- [x] Repoint `g u` hotkey: `navigate:upcoming` → `toggle:upcoming` (`shortcuts.ts`, `shortcuts.test.ts`)
- [x] `AppShell.tsx`: dispatch `toggle-upcoming` CustomEvent, navigate to `/daily` first if elsewhere
- [x] `DailyPage.tsx`: listen for `toggle-upcoming`, extract shared `toggleUpcoming` callback (button + hotkey)
- [x] Update help dialog copy (`helpContent.ts`, en + pt-BR): Upcoming described as toggle, not page
- [x] Keep `fetchUpcomingTasks`, `['upcoming']` query invalidations, `page.upcoming` i18n key (reused)
