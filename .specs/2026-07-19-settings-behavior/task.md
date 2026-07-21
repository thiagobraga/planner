# Settings Behavior Preferences

> Release rules:
> - Keep the new preferences default-off and preserve existing list visibility until the user enables the toggles.
> - Every feature or bugfix must ship with the implementation, focused unit tests, and committed Playwright E2E coverage for its user-visible behavior.

## Phase 0 - Spec and schema

- [x] Create `.specs/2026-07-19-settings-behavior/plan.md`
- [x] Create `.specs/2026-07-19-settings-behavior/task.md`
- [x] Add `api/src/db/migrations/029_preferences_behavior.sql`
  - [x] Add `hide_completed_tasks BOOLEAN NOT NULL DEFAULT false`
  - [x] Add `hide_old_notes BOOLEAN NOT NULL DEFAULT false`
  - [x] Leave existing user preferences untouched

## Phase 1 - API contract and server filtering

- [x] Extend `api/src/services/preferencesService.ts`
  - [x] Add `hideCompletedTasks` and `hideOldNotes` to the preferences shape
  - [x] Validate both fields as booleans
  - [x] Persist partial updates and include both fields in sync payloads
- [x] Update preference route/tests for the expanded contract
- [x] Filter Daily, Inbox, and Collection queries by the new visibility rules
  - [x] Hide completed rows when enabled
  - [x] Hide `type = 'note'` rows with due dates before the user’s local date when enabled
  - [x] Keep Monthly and Upcoming behavior unchanged

## Phase 2 - Frontend navigation and optimistic updates

- [x] Move behavior toggles into General settings
  - [x] Support desktop and mobile tab navigation for the remaining settings sections
  - [x] Preserve direct URL support by redirecting `/settings/behavior` to General
- [x] Add behavior toggles with optimistic updates and rollback
  - [x] Hide completed tasks
  - [x] Hide old notes
- [x] Invalidate affected caches after preference changes and sync events
- [x] Remove visible tasks immediately on completion when hiding is enabled
- [x] Add Daily page toolbar controls matching the Habits page pattern
  - [x] Add a `Today` button that scrolls the Daily view to the current-date section
  - [x] Add a compact adjacent button that toggles `Hide completed tasks`
  - [x] Expose dynamic `Hide completed tasks` / `Show completed tasks` accessible labels
  - [x] Add focused unit and committed Playwright E2E coverage
  - [x] Align the controls with the subtitle row, matching the Habits page header
- [x] Keep session-bound CSRF tokens stable across safe requests so cross-tab preference updates do not intermittently fail with 403
  - [x] Reuse valid CSRF cookies instead of rotating them on every GET
  - [x] Rotate cookies that are invalid or belong to a different session
  - [x] Add focused CSRF middleware regression tests

## Phase 3 - Verification

- [x] Update focused API and app tests for the new contract
- [x] Add committed Playwright infrastructure under `app/`
  - [x] Add typed E2E configuration and API fixture helpers
  - [x] Add `npm run test:e2e`, `test:e2e:settings`, and E2E typechecking commands
  - [x] Ignore Playwright reports and failure artifacts
- [x] Add Settings behavior E2E coverage
  - [x] Verify optimistic toggle state before the server responds
  - [x] Verify persistence after reload and cross-tab sync
  - [x] Verify `/settings/behavior` redirects to `/settings/general`
  - [x] Verify mobile settings navigation
  - [x] Verify Daily, Inbox, and Collection filtering
  - [x] Verify undated notes remain visible
  - [x] Verify completion removes a row before the request resolves
  - [x] Verify Monthly and Upcoming remain unchanged
  - [x] Verify E2E fixtures are deleted and preferences are restored
- [x] Run focused API and app unit suites
- [x] Run the full API unit suite (63 files, 565 tests)
- [x] Run the full app unit suite after isolating Playwright discovery from Vitest (69 files, 581 tests)
- [x] Run the Settings E2E suite successfully, including the Daily toolbar scenario and a prior 3-repeat stability pass
- [x] Attempt Chrome DevTools MCP verification; the local headful browser is blocked by the missing X server, so use the committed Chromium Playwright suite against `https://planner.local/`
- [x] Verify the app production build
- [~] Finish repository-wide verification
  - [x] Lint and typecheck the new Playwright files
  - [ ] App lint has pre-existing errors in unrelated source files
  - [ ] API lint cannot run because `api/` has no ESLint flat config
  - [ ] API build has pre-existing TypeScript errors in `provisionUser.test.ts`, `seed.test.ts`, and `auth.test.ts`
