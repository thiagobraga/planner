# Remove the redundant Daily Upcoming control

1. [x] Make List always show the remaining selected week, retaining overdue tasks and Reorganize previews. Remove the Upcoming toggle, storage, and event listener.
2. [x] Remove the unused G U shortcut, its dispatcher, and obsolete copy. The frontend fetch helper was already removed on main. Keep the API/MCP upcoming query for agent clients.
3. [x] Verify range and shortcut unit tests, full app tests/lint/build, and real API-backed Playwright coverage across all Daily views, week navigation, and Reorganize. All 1,303 app tests and 3 targeted E2E tests pass; lint has 0 errors and 37 existing warnings; build passes.
4. [x] Capture and inspect desktop and narrow screenshots, commit focused changes, push, and mark PR #267 ready. Screenshots are in app/dist/screenshots/; isolated stack runs at https://antigravity.planner.local.

Relevant files: app/src/pages/DailyPage.tsx, app/src/utils/dailyRange.ts, app/src/hooks/shortcuts.ts, app/src/components/AppShell.tsx, app/src/i18n/helpContent.ts, app/src/i18n/locales/en.ts, app/src/i18n/locales/pt-BR.ts, app/e2e/dailyRange.spec.ts, and their unit tests.

Acceptance: Future tasks in the selected week remain visible without an opt-in control; week navigation, all four views, task creation, and redistribution remain usable. No frontend Upcoming toggle or G U binding remains.
