# Page toolbar: tasks (phase 1)

## 1. View model
- [ ] 1.1 `app/src/types/view.ts`: `ViewLayout = 'list'|'columns'|'table'|'calendar'`, `ViewStyle = 'notebook'|'cards'`, `ViewRange` (`{kind:'preset', preset}` | `{kind:'span', unit:'day'|'week'|'month', count}`), `PageViewState`, `GroupByOption`
- [ ] 1.2 `app/src/utils/viewRange.ts`: `resolveRange`, `shiftAnchor`, `coerceRange`, `rangesFor(layout)`, `rangeShortcut`; unit tests
- [ ] 1.3 `utils/dailyRange.ts`: slugs `list|columns` + legacy redirect map (`kanban`, `cards`, `monthly`)

## 2. API preferences
- [ ] 2.1 Migration `052_preferences_view_settings.sql`: `daily_view JSONB`, `full_width BOOLEAN NOT NULL DEFAULT false`
- [ ] 2.2 `preferencesService.ts`: format + validate `dailyView`, `fullWidth`; `boardViewModes` entries accept `layout`, `style`, `groupBy`; merge per entry instead of replace
- [ ] 2.3 Integration tests (real Postgres)

## 3. Toolbar components (`app/src/components/toolbar/`)
- [ ] 3.1 `MenuTrigger` + `ViewMenu` (layout items with shortcut hints, style segmented with icons, range list or pills, actions)
- [ ] 3.2 `WindowMenu` (Full width)
- [ ] 3.3 `DateNav` (Today, prev, range label, next) using the existing `WeekSelector` picker
- [ ] 3.4 `GroupByMenu`
- [ ] 3.5 `PageToolbar`: title row slot, overflow cascade via `ResizeObserver`, mobile bottom bar via portal at <=640px
- [ ] 3.6 `MobileViewSheet`
- [ ] 3.7 Tests

## 4. Daily
- [ ] 4.1 `useDailyView` hook: state from prefs, URL layout, anchor, range, setters
- [ ] 4.2 `DailyWeekBoard` takes `days: string[]` (1-21) instead of a week anchor
- [ ] 4.3 List presets (today, tomorrow, week, next7, upcoming with empty days hidden, month = MonthlyView)
- [ ] 4.4 Remove `Toolbar`/`ViewSwitcher` usage, page context menu uses new model
- [ ] 4.5 Keep `DailyPage.tsx` under 1000 lines

## 5. Collections, Inbox, shell
- [ ] 5.1 `useBoardPreferences` stores `{layout, style, groupBy}` on the server
- [ ] 5.2 `GroupByMenu` in the nav slot; Inbox options None / Priority / Collection
- [ ] 5.3 Completion status column ignores "hide completed" when grouped by status
- [ ] 5.4 `TopBarMenus`: Show (completed, notes) + Theme swatches
- [ ] 5.5 Full width class on `AppShell`
- [ ] 5.6 `usePageShortcuts` + `v` bindings + help dialog from bindings
- [ ] 5.7 Delete `ui/Toolbar.tsx`, `ui/ViewSwitcher.tsx`, `ui/ViewToolbar.tsx`, `board/BoardToolbar.tsx`; update Styleguide

## 6. Verification
- [ ] 6.1 `npm run lint`, `npm run build`, `npm test` in `app/` and `api/`
- [ ] 6.2 Playwright E2E for view switching, group by, full width, mobile bar
- [ ] 6.3 Screenshots desktop + 390px in `app/dist/screenshots/`
- [ ] 6.4 Update `CLAUDE.md`, `DESIGN.md`
