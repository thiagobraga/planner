# Task context workflows implementation

## 1. Isolation and contract

- [x] 1.1 Create `feat/task-context-workflows` worktree from `origin/main`; preserve main checkout edits.
- [x] 1.2 Define status fields: `nextStatusMode` (`default`, `custom`, `disabled`), `nextStatusId`, `acceptStatusId`, `rejectStatusId`.
- [x] 1.3 Set up worktree dependencies, database, Redis, and browser preview.

## 2. Status rules and API

- [~] 2.1 Write failing migration/service tests for defaults, same-collection validation, and deletion cleanup.
- [~] 2.2 Add backward-compatible migration and expose fields through `api/src/services/statusService.ts` and `api/src/routes/statuses.ts`.
- [~] 2.3 Publish status updates and ensure task completion follows destination status.

## 3. Shared task menus

- [~] 3.1 Write failing tests for stage resolution and task-menu actions.
- [~] 3.2 Add shared menu action builder and use it in Daily, Inbox, and Collections.
- [~] 3.3 Add list indentation actions with valid-order disabled states.
- [~] 3.4 Add Kanban card and calendar entry triggers with touch and keyboard access.
- [~] 3.5 Add status rule controls in collection column menus and refresh status data outside boards.

## 4. Date panel and caret

- [x] 4.1 Write failing caret behavior tests and give `ContextMenu` explicit caret control.
- [x] 4.2 Reduce date panel width/spacing, use compact calendar and theme surfaces, remove title icon.

## 5. Verification

- [ ] 5.1 Run focused API integration and frontend tests, then lint and builds.
- [ ] 5.2 Exercise list, Kanban, calendar, and stage branch flows in Playwright.
- [ ] 5.3 Capture desktop and narrow screenshots in `app/dist/screenshots/` for light and dark themes.
- [ ] 5.4 Review final diff, record evidence and remaining gaps.
