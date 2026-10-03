# Dynamic Daily calendar icon + fix date-rollover Add-task bug

## Problem

Sidebar "Daily" nav item shows static icon, not today's date. User wants live calendar-page icon showing current day number, updating automatically at midnight. Also: Daily page's "Add task" placeholder stops appearing after day changes.

## What the user wants

1. Sidebar "Daily" nav icon becomes a mini calendar page showing today's date number (e.g. "23" on Sep 23). Updates automatically when day rolls over - no page reload needed.
2. Daily page: after day change, the new day's "Add task" input row must appear again (currently it silently disappears).

## Relevant Files

- `app/src/components/Sidebar.tsx` - nav icons (`NAV_ITEMS`, `BjTask`/`MonthlyIcon` custom icon components)
- `app/src/pages/DailyPage.tsx` - Daily page, `todayKey`, "Add task" placeholder gating
- `app/src/hooks/useMidnightTimer.ts` - existing live day-rollover hook (reused, not rebuilt)
- `app/src/utils/date.ts` - `fmtISOInTimeZone`, `getMsUntilMidnight`
- Tests: `app/src/components/__tests__/` (new Sidebar test), `app/src/pages/__tests__/DailyPage.test.tsx`

No mobile bottom tab bar exists in this codebase - only the collapsible `Sidebar.tsx` (drawer on mobile). The icon change applies there only.
