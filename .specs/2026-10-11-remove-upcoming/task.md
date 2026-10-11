# Remove the redundant Daily Upcoming control

1. [~] Make List always show the remaining selected week, retaining overdue tasks and Reorganize previews. Remove the Upcoming toggle, storage, and event listener.
2. [~] Remove the unused G U shortcut, its dispatcher, frontend fetch helper, and obsolete copy. Keep the API/MCP upcoming query for agent clients.
3. [ ] Verify range and shortcut unit tests, full app tests/lint/build, and real API-backed Playwright coverage across all Daily views, week navigation, and Reorganize.
4. [ ] Capture desktop and narrow screenshots, commit focused changes, push, and mark the PR ready.

Relevant files: app/src/pages/DailyPage.tsx, app/src/utils/dailyRange.ts, app/src/hooks/shortcuts.ts, app/src/components/AppShell.tsx, app/src/api/client.ts, app/src/i18n/translations.ts, app/e2e/dailyRange.spec.ts, and their unit tests.

Acceptance: Future tasks in the selected week remain visible without an opt-in control; week navigation, all four views, task creation, and redistribution remain usable. No frontend Upcoming toggle or G U binding remains.
