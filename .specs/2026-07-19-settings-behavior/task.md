# Settings Behavior Preferences

> Release rule: keep the new preferences default-off and preserve existing list visibility until the user enables the toggles.

## Phase 0 - Spec and schema

- [x] Create `.specs/2026-07-19-settings-behavior/plan.md`
- [x] Create `.specs/2026-07-19-settings-behavior/task.md`
- [x] Add `api/src/db/migrations/029_preferences_behavior.sql`
  - [ ] Add `hide_completed_tasks BOOLEAN NOT NULL DEFAULT false`
  - [ ] Add `hide_old_notes BOOLEAN NOT NULL DEFAULT false`
  - [ ] Leave existing user preferences untouched

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

## Phase 3 - Verification

- [x] Update focused API and app tests for the new contract
- [ ] Verify lint and production builds
  - [ ] Note: repo-wide lint currently reports pre-existing errors in unrelated app files, and `api` has no local ESLint config, so full lint validation is not cleanly available from the current workspace state
