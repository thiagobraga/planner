# Gates: core module boundaries

OWNS: .specs/2026-11-12-core-module-boundaries/**, app/src/**, app/e2e/**, api/src/**, GATES.md

Scope: Preserve Planner behavior while completing each refactor phase in the spec.

- [x] G1: Record the graph, file size, active work, test, and build baseline.
  EVIDENCE: Baseline recorded in `.specs/2026-11-12-core-module-boundaries/plan.md`.
- [x] G2: Consolidate equivalent preference queries and verify cache and sync behavior.
  EVIDENCE: Shared `usePreferences` hook used across `DailyPage`, `CollectionsPage`, `DailyRoutes`, `InboxPage`, `HabitsPage`, `StyleguidePage`, and `useFullWidth`; covered by `usePreferences.test.tsx` and page test suites.
- [x] G3: Split the API client by responsibility without changing transport contracts.
  EVIDENCE: `app/src/api/client.ts` (9 lines) re-exports `transport`, `auth`, `tasks`, `preferences`, `collections`, `integrations`, `labels`, `habits`, and `admin` (all under 190 lines).
- [x] G4: Extract cohesive Collections and Daily responsibilities and verify interactions.
  EVIDENCE: `CollectionsPage.tsx` (519 lines) and `DailyPage.tsx` (423 lines) compose extracted hooks and overlay components; verified by 21 CollectionsPage tests, 56 DailyPage/DailyRoutes tests, and 10 Playwright E2E tests.
- [x] G5: Split task service operations while preserving authorization, transactions, activity, and sync.
  EVIDENCE: `api/src/services/taskService.ts` (482 lines) and `api/src/services/task/*` modules verified by 112 API test files (1,148 tests) including `taskService.lifecycle.integration.test.ts` on real PostgreSQL 18 + Redis 8.
- [x] G6: Reduce HabitTimeline below 1000 lines and document decisions on other candidates.
  EVIDENCE: `HabitTimeline.tsx` is 138 lines; `CollectionTreeNav.tsx` is 354 lines (`utils/collectionTree.ts` 169, `SortableCollectionRow.tsx` 164); `habitService.ts` is 675 lines (`types/habit.ts` 80); `SettingsPage.tsx` (873 lines) held for settings redesign coordination.
- [x] G7: Run applicable tests, integration checks, lint, builds, and desktop and mobile browser verification.
  EVIDENCE: API tests (112 files, 1,148 passed), App tests (176 files, 1,563 passed), API + App lint & builds passed, 10 Playwright E2E tests passed, and 6 desktop/390px screenshots saved under `app/dist/screenshots/` with 0 console/page errors.
- [x] G8: Compare final graph and file sizes against baseline and update the spec checklist.
  EVIDENCE: All handwritten source files across `api/src` and `app/src` are under 1,000 lines (max 873 lines in `SettingsPage.tsx`), and `.specs/2026-11-12-core-module-boundaries/plan.md` checklist is complete.
