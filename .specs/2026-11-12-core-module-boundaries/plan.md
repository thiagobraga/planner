# Core module boundaries

## Goal

Reduce oversized files and clarify responsibility boundaries without changing user-visible behavior. Use graph clusters and edge counts as leads, not proof that a split is necessary. Shared infrastructure can remain a central hub when its responsibility is clear.

## Scope

1. Verify the graph findings against the current code, identify the central hub, and establish test and build baselines.
2. Consolidate equivalent preferences queries through the existing hook while preserving caching, invalidation, and sync behavior.
3. Split the frontend API client by cohesive endpoint responsibility, keeping shared transport behavior in one place.
4. Extract focused hooks and components from the Collections and Daily pages while preserving all views and interactions.
5. Split the task service along verified business boundaries without changing transactions, authorization, activity, or sync events. Review the old refactor branch for ideas rather than merging it blindly.
6. Bring HabitTimeline below the file size limit. Review habitService and CollectionTreeNav for useful boundaries. Coordinate SettingsPage work with the active redesign rather than creating conflicting work.

## User expectations

- Existing workflows, navigation, accessibility, appearance, error handling, and real-time updates continue to work.
- Optimistic changes still reconcile or recover correctly on failure.
- Task operations retain their existing permissions, recurrence, transaction, activity, and event behavior.
- Refactoring proceeds in independently reviewable phases, with tests and verification at each phase.

## Relevant files

- `app/src/api/client.ts` and new focused modules under `app/src/api/`
- `app/src/hooks/usePreferences.ts`, `app/src/components/AppShell.tsx`, and preferences query consumers
- `app/src/pages/CollectionsPage.tsx`, `app/src/pages/DailyPage.tsx`, and their related hooks, components, and tests
- `api/src/services/taskService.ts`, related task services, routes, MCP tools, and tests
- `app/src/components/habits/HabitTimeline.tsx` and related tests
- `app/src/pages/SettingsPage.tsx`, coordinated with `.specs/2026-11-07-settings-redesign/`
- `api/src/services/habitService.ts` and `app/src/components/CollectionTreeNav.tsx`
- Relevant Playwright tests and `app/dist/screenshots/` for verification artifacts

## Acceptance criteria

- Touched handwritten files remain under 1,000 lines, with meaningful boundaries rather than a single replacement god module.
- Existing behavior and external contracts remain intact. Any intentional change requires separate approval.
- Relevant unit, real PostgreSQL/Redis integration, and Playwright tests pass, along with applicable lint, type checks, and builds. Missing infrastructure or failures are reported explicitly.
- Affected rendered views are exercised in Chrome at desktop and 390px, with console checks and screenshots saved under `app/dist/screenshots/`.
- The updated graph and current file sizes are compared with the baseline, without treating graph metrics alone as a success criterion.

## Tasks

### 1. Baseline and scope

- [x] Verify the current graph snapshot and identify the high-degree hub and its actual responsibility.
- [x] Inventory current file sizes, callers, tests, and active work. Treat inferred graph edges as hypotheses until confirmed in source.
- [x] Run and record relevant baseline tests and builds. Add characterization tests for important uncovered behavior before moving code.
- [x] Establish an isolated branch and worktree according to project workflow when implementation starts.

Baseline notes (2026-11-13):
- The existing graph report is dated 2026-11-07 and has 4,681 nodes and 12,028 edges. Its highest-degree node is `useI18n()` at 159 edges. Source inspection shows that it reads the shared translation context, so the degree alone does not justify splitting it.
- Starting line counts: API client 761, Collections page 974, Daily page 922, task service 1,975, HabitTimeline 1,012, habit service 728, CollectionTreeNav 681.
- Settings redesign is awaiting prototype approval; avoid changing SettingsPage in this refactor until coordinated.
- App and API baseline builds and lint passed.

### 2. Preferences

- [x] Compare `app/src/hooks/usePreferences.ts` with query declarations in `AppShell`, `CollectionsPage`, `DailyPage`, and other consumers, including options and lifecycle behavior.
- [x] Use the shared hook where behavior is equivalent. Preserve the `['preferences']` cache key, loading behavior, invalidation, and sync updates.
- [x] Test shared-cache behavior and preference changes across views. Do not assume repeated query declarations imply repeated network requests.

Progress: `DailyPage`, `CollectionsPage`, `DailyRoutes`, `InboxPage`, `HabitsPage`, `StyleguidePage`, and `useFullWidth` now use the shared `usePreferences` hook. `AppShell` (`retry: 2`), `ThemeSwitcher` (`refetchOnMount: false`), and `TopBarMenus` (`refetchOnMount: false`) retain their distinct options, and `SettingsPage` is left untouched for the active settings redesign.

### 3. Frontend API client

- [x] Trace all exports and consumers of `app/src/api/client.ts`, including test mocks.
- [x] Separate shared transport from cohesive endpoint modules, such as tasks, collections, preferences, and habits, based on actual dependencies.
- [x] Update imports and mocks in manageable groups; preserve requests, authentication, CSRF handling, responses, and error behavior.
- [x] Run API client and affected component tests after each group.

Progress: `client.ts` (761 lines) split into `transport` (187), `collections` (150), `habits` (102), `tasks` (96), `auth` (61), `integrations` (50), `admin` (40), `labels` (23), and `preferences` (15). `client.ts` remains a 9-line barrel so existing imports and test mocks continue to work.

### 4. Collections and Daily pages

- [x] Map state ownership, effects, event handling, drag-and-drop, optimistic updates, and existing tests in `app/src/pages/CollectionsPage.tsx` and `app/src/pages/DailyPage.tsx`.
- [x] Add regression tests for uncovered navigation, view modes, task operations, sync, and failure recovery before extracting each responsibility.
- [x] Extract focused hooks and components from Collections, including collection, task, section, and view concerns where appropriate.
- [x] Extract focused hooks and components from Daily, including date ranges, task actions, view rendering, and sync where appropriate.
- [x] Verify that the resulting pages compose clear responsibilities rather than delegating everything to another oversized module.

Progress:
- `CollectionsPage.tsx` reduced from 974 to 519 lines by extracting `useCollectionBreadcrumbs.ts` (143), `CollectionBreadcrumbs.tsx` (175), `useCollectionSections.ts` (158), and `useCollectionTasks.ts` (361).
- `DailyPage.tsx` reduced from 922 to 423 lines by extracting `useDailySync.ts` (83), `useDailyTaskActions.ts` (478), and `DailyOverlays.tsx` (206).

### 5. Task service

- [x] Trace callers, public contracts, authorization, transactions, recurrence, activity, and sync event ordering in `api/src/services/taskService.ts`.
- [x] Compare `refactor/task-service` against the current branch for reusable ideas. Do not merge without reviewing current behavior and divergence.
- [x] Add characterization and real PostgreSQL/Redis integration coverage, including error and rollback paths, before each extraction.
- [x] Extract cohesive task operations incrementally. Preserve access checks, transactional boundaries, activity attribution, event publication, and service contracts.
- [x] Run relevant service, route, MCP, and integration tests after each extraction.

Progress: Added real PostgreSQL + Redis lifecycle and rollback integration suite (`taskService.lifecycle.integration.test.ts`). Split `api/src/services/taskService.ts` from 2,013 lines down to 482 lines alongside `task/move.ts` (467), `task/ordering.ts` (376), `task/completion.ts` (207), `task/validation.ts` (131), `task/format.ts` (42), `task/access.ts` (39), `task/events.ts` (21), and `types/task.ts` (173).

### 6. Other candidates

- [x] Inspect `app/src/components/habits/HabitTimeline.tsx` and extract cohesive rendering or interaction logic until the file is under 1,000 lines; cover affected behavior.
- [x] Coordinate `app/src/pages/SettingsPage.tsx` with `.specs/2026-11-07-settings-redesign/`; avoid duplicate or conflicting changes.
- [x] Review `api/src/services/habitService.ts` and `app/src/components/CollectionTreeNav.tsx`; split only where responsibilities and tests support it. Record any decision not to split.

Progress:
- `HabitTimeline.tsx` is 138 lines after extracting `HabitTimelineDayHeader.tsx`, `HabitTimelineLabels.tsx`, `HabitTimelineDayGrid.tsx`, `HabitTimelineMenu.tsx`, `useHabitTimelineDrag.tsx`, and `utils/habitTimeline.ts`.
- `CollectionTreeNav.tsx` reduced from 681 to 354 lines by extracting pure hierarchy/projection utilities into `utils/collectionTree.ts` (169) and `SortableCollectionRow.tsx` (164).
- `habitService.ts` reduced from 728 to 675 lines by extracting dedicated types into `api/src/types/habit.ts` (80) while keeping shared habit/group database logic cohesive.
- `SettingsPage.tsx` (873 lines) left untouched to avoid conflicts with `.specs/2026-11-07-settings-redesign/`.

### 7. Verification

- [x] Follow test-first development for behavioral changes and add regression tests for uncovered behavior.
- [x] Run relevant unit tests, real PostgreSQL/Redis integration tests, Playwright tests, type checks, lint, and builds; report failures or unavailable checks.
- [x] For affected rendered views, exercise changed controls in Chrome at desktop and 390px, inspect console errors, and save screenshots under `app/dist/screenshots/`.
- [x] Check line counts of touched handwritten files and compare the updated graph with the baseline. Judge success by clearer responsibilities and preserved behavior, not graph metrics alone.
- [x] Update this checklist as work progresses and keep phases independently reviewable.
