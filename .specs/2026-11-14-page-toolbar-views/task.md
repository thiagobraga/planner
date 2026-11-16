# Page toolbar: tasks (phase 1)

## 1. View model
- [x] 1.1 `app/src/types/view.ts`: `ViewLayout = 'list'|'columns'|'table'|'calendar'`, `ViewStyle = 'notebook'|'cards'`, `ViewRange` (`{kind:'preset', preset}` | `{kind:'span', unit:'day'|'week'|'month', count}`), `PageViewState`, `GroupByOption`
- [x] 1.2 `app/src/utils/viewRange.ts`: `resolveRange`, `shiftAnchor`, `coerceRange`, `rangesFor(layout)`, `rangeShortcut`; unit tests
- [x] 1.3 `utils/dailyRange.ts`: slugs `list|columns` + legacy redirect map (`kanban`, `cards`, `monthly`)

## 2. API preferences
- [x] 2.1 Migration `052_preferences_view_settings.sql`: `daily_view JSONB`, `full_width BOOLEAN NOT NULL DEFAULT false`
- [x] 2.2 `preferencesService.ts`: format + validate `dailyView`, `fullWidth`; `boardViewModes` entries accept `layout`, `style`, `groupBy`; merge per entry instead of replace
- [x] 2.3 Integration tests (real Postgres)

## 3. Toolbar components (`app/src/components/toolbar/`)
- [x] 3.1 `MenuTrigger` + `ViewMenu` (layout items with shortcut hints, style segmented with icons, range list or pills, actions)
- [x] 3.2 `WindowMenu` (Full width)
- [x] 3.3 `DateNav` (Today, prev, range label, next) using the existing `WeekSelector` picker
- [x] 3.4 `GroupByMenu`
- [x] 3.5 `PageToolbar`: title row slot, overflow cascade via `ResizeObserver`, mobile bottom bar via portal at <=640px
- [x] 3.6 `MobileViewSheet`
- [x] 3.7 Tests

## 4. Daily
- [x] 4.1 `useDailyView` hook: state from prefs, URL layout, anchor, range, setters
- [x] 4.2 `DailyWeekBoard` takes `from`/`to` (1-21 days) instead of a week anchor
- [x] 4.3 List presets (today, tomorrow, week, next7, upcoming with empty days hidden, month = MonthlyView)
- [x] 4.4 Remove `Toolbar`/`ViewSwitcher` usage, page context menu uses new model
- [x] 4.5 Keep `DailyPage.tsx` under 1000 lines

## 5. Collections, Inbox, shell
- [x] 5.1 `useBoardPreferences` stores `{layout, style, groupBy}` on the server
- [x] 5.2 `GroupByMenu` in the nav slot on Columns; Inbox uses Status / Section / Priority (see plan)
- [x] 5.3 Completion status column ignores "hide completed" when grouped by status (`include_completed=true` on `/views/inbox` and `/views/collection/:id`)
- [x] 5.4 `TopBarMenus`: Show (completed, notes) + Theme swatches
- [x] 5.5 Full width class on `AppShell`
- [x] 5.6 `usePageShortcuts` + `v` bindings + help dialog from bindings
- [x] 5.7 Delete `ui/Toolbar.tsx`, `ui/ViewSwitcher.tsx`, `ui/ViewToolbar.tsx`, `board/BoardToolbar.tsx`; update Styleguide

## 6. Verification
- [x] 6.1 `npm run lint`, `npm run build`, `npm test` in `app/` and `api/`
- [x] 6.2 Playwright E2E for view switching, group by, full width, mobile bar
- [x] 6.3 Screenshots desktop + 390px in `app/dist/screenshots/`
- [x] 6.4 Update `CLAUDE.md`, `DESIGN.md`

## 7. Follow-ups (phase 2)
- [ ] Table layout
- [ ] Calendar layout: hour grid (1-6 days, 1 week, all-day strip) and week grid (2-3 weeks, Month)
- [ ] List in Cards style
- [ ] Group on List (status, priority)
