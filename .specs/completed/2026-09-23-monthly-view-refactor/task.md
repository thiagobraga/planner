# Task Breakdown: Monthly View Refactor

Detailed implementation breakdown with technical architecture and actionable subtasks.

## Key existing infrastructure this reuses

- `MonthlyRows.tsx` - existing BuJo ledger rendering with day rows, weekend tinting, today highlighting, future dimming. Needs adaptation to accept external tasks + render interactive items instead of plain note text.
- `MonthSelector.tsx` - animated month strip navigation (unchanged).
- `ViewToolbar.tsx` - segmented List/Kanban toggle. Currently `ViewMode = 'list' | 'kanban'` with Calendar as an optional nav-link callback (`onCalendarClick`). Needs Calendar promoted to a real `ViewMode`.
- `TaskItem.tsx` - existing task rendering with checkbox, note dash, event circle indicators.

---

## 1. Expand `ViewMode` and update `ViewToolbar`

- [x] **1.1** Change `ViewMode` from `'list' | 'kanban'` to `'list' | 'kanban' | 'calendar'` in `ViewToolbar.tsx`.
- [x] **1.2** Remove `onCalendarClick` prop - Calendar becomes a regular segment in the `ButtonGroup` that fires `onViewChange('calendar')`.
- [x] **1.3** Add a prop (e.g. `showCalendar?: boolean`, default `true`) so pages that don't want the calendar segment can opt out (future-proofing; all current pages will use it).
- [x] **1.4** Update `BoardToolbar.tsx` if it wraps `ViewToolbar` and needs the new type.

## 2. Create `MonthlyView` reusable component

- [x] **2.1** `app/src/components/monthly/MonthlyView.tsx` - new component.
  - Props: `tasks: Task[]`, `onToggle: (id: string) => void`, `onTaskClick?: (task: Task) => void`.
  - Manages its own `selectedYear`/`selectedMonth` state (defaults to current month).
  - Slots tasks into date rows using `task.dueDate` (ISO date key match).
  - Renders `MonthSelector` for navigation + adapted ledger rows.

- [x] **2.2** Adapt `MonthlyRows.tsx` or create new `MonthlyLedger.tsx`:
  - Accept `tasks` prop instead of fetching via `fetchMonthNotes`.
  - Remove internal `useSync` and `fetchMonthNotes` calls.
  - Each day row renders task/note/event items with proper BuJo markers:
    - Task: `[ ] title` (checkbox + title)
    - Note: `- title` (dash + title text)
    - Event: `○ title` (circle + title)
  - Row height grows to accommodate multiple items per day.
  - Tasks with no `dueDate` collected into a "No date" section below the ledger.
  - Preserve: today highlighting, weekend tinting, future-day dimming.

- [x] **2.3** Unit tests for task slotting logic.

## 3. Wire Monthly view into DailyPage

- [x] **3.1** Replace `onCalendarClick={() => navigate('/monthly')}` with view mode state that includes `'calendar'`.
- [x] **3.2** When `view === 'calendar'`, render `<MonthlyView tasks={allTasks} onToggle={handleToggle} />` instead of the list or kanban.
- [x] **3.3** Ensure `allTasks` includes both overdue and today tasks (the full dataset DailyPage already loads).

## 4. Wire Monthly view into InboxPage

- [x] **4.1** Add `'calendar'` to InboxPage's view mode state.
- [x] **4.2** When calendar active, render `<MonthlyView tasks={tasks} onToggle={handleToggle} />`.

## 5. Wire Monthly view into CollectionsPage

- [x] **5.1** Add `'calendar'` to CollectionsPage's view mode state.
- [x] **5.2** When calendar active, render `<MonthlyView tasks={tasks} onToggle={handleToggle} />`.

## 6. Remove standalone Monthly page and sidebar

- [x] **6.1** Delete `app/src/pages/MonthlyPage.tsx` and `app/src/pages/MonthlyPage.css` (if exists).
- [x] **6.2** Remove `/monthly` route from `app/src/App.tsx`.
- [x] **6.3** Remove `{ to: '/monthly', ... }` from `NAV_ITEMS` in `app/src/components/Sidebar.tsx`.
- [x] **6.4** Remove `case 'navigate:monthly'` from `AppShell.tsx` keyboard shortcuts.
- [x] **6.5** Remove `g m` shortcut binding from keyboard shortcuts help modal in `AppShell.tsx`.
- [x] **6.6** Clean up any `navigate('/monthly')` references.
- [x] **6.7** Remove or update i18n keys for `nav.monthly`, `page.monthly`, `shell.goMonthly` (mark unused or remove).

## 7. Tests

- [x] **7.1** Unit tests: `MonthlyView` renders tasks in correct date rows, handles no-date tasks, respects task types.
- [x] **7.2** Integration tests: DailyPage switches to calendar view, shows tasks in ledger.
- [x] **7.3** Verify `/monthly` route no longer exists (404 or redirect).
- [x] **7.4** Verify sidebar no longer shows Monthly link.

## 8. Manual verification

- [x] Visual check: Daily page calendar view with tasks and notes in BuJo ledger.
- [x] Visual check: Collections page calendar view.
- [x] Visual check: Sidebar without Monthly link.
- [x] Screenshots saved to `app/dist/screenshots/`.
