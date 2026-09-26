# Specification: Monthly View Refactor - Page to View Mode

## Feature Summary & User Goals

Monthly stops being a standalone page (`/monthly`) and becomes a **view mode** - a third option alongside List and Kanban in the ViewToolbar's segmented toggle. Any page that shows tasks (Daily, Inbox, Collections) can switch into Monthly view, displaying that page's own tasks on a BuJo-style vertical date ledger.

The Monthly route and sidebar entry are removed. The calendar icon in ViewToolbar (currently a navigation link to `/monthly`) becomes a true view-mode toggle that switches the current page's content area to the monthly ledger layout.

### 1. Entering Monthly view

- The ViewToolbar's segmented `ButtonGroup` gains Calendar as a **selectable view mode** (not a nav link).
- `ViewMode` type expands from `'list' | 'kanban'` to `'list' | 'kanban' | 'calendar'`.
- Calendar selection is page-local, non-persisted UI state (resets to list on reload), matching how Daily's kanban toggle already works.
- When active, the page body swaps from its list/kanban layout to a `MonthlyView` component.

### 2. Data source

- Monthly view does **not** fetch its own data. It receives the same task array the host page already has loaded.
- Tasks are slotted into date rows by their `due_date`. Tasks without a due date appear in a dedicated "No date" section below the ledger.
- The month range defaults to the current month and can be navigated with the existing `MonthSelector` strip (prev/next month).
- When navigating months, tasks outside the page's loaded range simply show empty rows - no additional API calls are made. The view works with whatever data the page provides.

### 3. Ledger layout (BuJo style preserved)

- The existing `MonthlyRows` vertical ledger aesthetic is preserved: one row per calendar day, day number + weekday initial on the left, content on the right.
- **Key change**: Instead of only showing note text joined by interpuncts, each row now shows:
  - **Tasks** (`type = 'task'`): A small inline checkbox + title. Clicking the checkbox completes the task (same `onToggle` the page already provides).
  - **Notes** (`type = 'note'`): A dash `-` + title text (no checkbox), matching BuJo notation.
  - **Events** (`type = 'event'`): An open circle `○` + title text.
- Multiple items per day stack vertically within the row (row height grows to fit).
- Today row highlighting, weekend tinting, and future-day dimming are preserved.

### 4. Interactions within Monthly view

- Clicking a task checkbox toggles completion (delegates to the host page's toggle handler).
- Clicking a task/note title could open the task detail panel (same as clicking in list view).
- The `+` button on each day row creates a new note for that date (existing behavior preserved).
- Month navigation via `MonthSelector` (prev/next/today).

### 5. Removal of the standalone Monthly page

- `/monthly` route removed from `App.tsx`.
- `MonthlyPage.tsx` deleted.
- Sidebar `NAV_ITEMS` entry for `/monthly` removed.
- Keyboard shortcut `g m` removed (no dedicated page to navigate to).
- `navigate('/monthly')` calls in `AppShell.tsx` and `DailyPage.tsx` replaced with inline view-mode toggle.

## Relevant Files

### Modified
- `app/src/components/ui/ViewToolbar.tsx` - `ViewMode` expands to include `'calendar'`; Calendar becomes a selectable segment instead of a nav-link callback.
- `app/src/pages/DailyPage.tsx` - Replaces `onCalendarClick={() => navigate('/monthly')}` with `'calendar'` view mode toggle; renders `MonthlyView` when active.
- `app/src/pages/InboxPage.tsx` - Gains calendar view mode support.
- `app/src/pages/CollectionsPage.tsx` - Gains calendar view mode support.
- `app/src/components/Sidebar.tsx` - Remove `/monthly` from `NAV_ITEMS`.
- `app/src/components/BottomBar.tsx` - Remove monthly filter (already excluded, but clean up reference).
- `app/src/components/AppShell.tsx` - Remove `navigate:monthly` shortcut case.
- `app/src/App.tsx` - Remove `/monthly` route.

### New
- `app/src/components/monthly/MonthlyView.tsx` - Reusable monthly view component that accepts tasks from the host page and renders the BuJo ledger with interactive task/note items.

### Deleted
- `app/src/pages/MonthlyPage.tsx` - Standalone page replaced by the view component.
- `app/src/pages/MonthlyPage.css` - Associated styles.

### Preserved (reused as-is or with minor adaptation)
- `app/src/components/monthly/MonthlyRows.tsx` - Core ledger rendering (adapted to accept tasks instead of fetching its own).
- `app/src/components/monthly/MonthSelector.tsx` - Month navigation strip (unchanged).

## Explicitly Out of Scope

- Persisting calendar view preference across reloads.
- Additional API endpoints for month-range task fetching (the view works with the host page's existing data).
- Changing the ledger to a 7-column grid calendar layout.
- Drag-and-drop task rescheduling within the monthly view.
- Inline task creation from the monthly view (beyond the existing note creation).
