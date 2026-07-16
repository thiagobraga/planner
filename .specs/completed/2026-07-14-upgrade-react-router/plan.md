# Upgrade react-router-dom v6 → react-router v7 (declarative mode)

## Goal
Upgrade from `react-router-dom@6` to `react-router@7` using declarative mode (drop-in replacement — no `@react-router/dev` or framework mode). Removes the `v7_startTransition` future flag warning and brings the app to the current stable baseline before any future v8 migration.

## Why v7 only
v8 requires `react@19`, `vite@7`, `node@22.22+` — a significantly larger upgrade. v7 declarative mode is nearly identical API to what we use now (`BrowserRouter`, `Routes`, `Route`, `NavLink`, `useNavigate`, etc.), just imported from `react-router` instead of `react-router-dom`.

## Steps

1. **Add `v7_relativeSplatPath` future flag** to `BrowserRouter` in `App.tsx`
   - No splat routes exist → zero code changes needed
   - Already enabled `v7_startTransition` in previous commit

2. **Add tests** to confirm nothing broke:
   - `docker compose up -d` — full stack running
   - `npx tsc --noEmit` — type check
   - `pnpm -F app test` — unit tests pass
   - `pnpm -F api test` — API tests pass
   - Open https://planner.local/ in browser — verify login, navigation, daily/inbox/monthly pages load

3. **Update deps**: `npm uninstall react-router-dom && npm install react-router@7`
   - No `@react-router/dev` needed (framework mode only)

4. **Rename all imports**: `from 'react-router-dom'` → `from 'react-router'` across all `app/src/`

5. **Re-run full test suite**: `tsc`, `pnpm -F app test`, `pnpm -F api test`, browser check at https://planner.local/

6. **Commit, push, merge**
