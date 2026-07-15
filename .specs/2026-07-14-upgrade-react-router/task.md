# Task: Upgrade react-router-dom v6 → react-router v7 (declarative mode)

## Subtasks

- [x] Create branch `feat/upgrade-react-router-v7`
- [x] Save plan + task to `.specs/2026-07-14-upgrade-react-router/`
- [x] Add `v7_relativeSplatPath` future flag to `BrowserRouter`
- [x] Verify baseline: docker compose up, tsc, unit tests, browser at https://planner.local/
- [x] Update deps: `react-router-dom` → `react-router@7`
- [x] Rename all imports `react-router-dom` → `react-router` across `app/src/`
- [x] Re-run full test suite (tsc + unit tests + browser check)
- [x] Final commit & push
