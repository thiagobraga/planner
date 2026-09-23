# Tasks

## 1. Dynamic calendar-day icon in Sidebar

- [x] 1.1 In `app/src/components/Sidebar.tsx`, add `CalendarDayIcon` component (pattern per existing `BjTask`/`MonthlyIcon`, ~lines 22-36): SVG calendar-page glyph (top tab/rings + body) with day number as `<text>`/`<tspan>` inside, sized for 15-16px icon box.
- [x] 1.2 `CalendarDayIcon` reads today's day number internally via `useState(() => new Date())` + `useMidnightTimer` (reuse `app/src/hooks/useMidnightTimer.ts`) + `fmtISOInTimeZone`/`prefs?.timeZone`, so it self-updates at local midnight without touching `NAV_ITEMS` render call sites.
- [x] 1.3 Replace `BjTask` with `CalendarDayIcon` in `NAV_ITEMS` (~line 68-73) for the Daily entry. Keep existing `size`/`strokeWidth` props at both render sites (collapsed ~141-150, expanded ~227-238).
- [x] 1.4 Test: new `app/src/components/__tests__/Sidebar.test.tsx` (or extend existing) - assert Daily icon renders correct day number; advance fake timers past midnight and assert it updates.

## 2. Fix stale `todayKey` breaking Add-task placeholder after rollover

- [x] 2.1 In `app/src/pages/DailyPage.tsx`, convert `todayKey` (line ~176) from `useMemo(() => fmtISOInTimeZone(new Date(), prefs?.timeZone), [prefs?.timeZone])` to `useState` initialized the same way.
- [x] 2.2 In the existing `useMidnightTimer` callback (~lines 302-309), alongside `replaceTodayFromApi()`, update `todayKey` state via `setTodayKey(fmtISOInTimeZone(new Date(), prefs?.timeZone))`.
- [x] 2.3 Verify all downstream consumers of `todayKey` now behave correctly after rollover: `isToday` check gating Add-task form (~line 1023, form ~1057-1076), `handleAddToday` section lookup (~line 670), `useTaskDrag` scope (~line 432), `dimNotes` (~line 1024), upcoming-section filtering (~lines 242, 868, 878).
- [x] 2.4 Test: extend midnight-rollover test in `app/src/pages/__tests__/DailyPage.test.tsx` (currently ~lines 235-249, only checks refetch count + scroll) to also assert the "Add task" input is present for the new day's section after the midnight timer fires.

## 3. Verification

- [x] `docker compose exec app npm test` - Sidebar + DailyPage suites pass.
- [ ] Manual: `https://planner.local`, confirm Daily icon shows current day number; simulate midnight rollover (fake timers / mocked date) and confirm icon updates and Add-task placeholder still renders on Daily page.
