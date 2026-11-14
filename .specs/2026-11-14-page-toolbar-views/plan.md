# Page toolbar: layout, style and range

## Why

Daily views were fixed presets (list, kanban lists, kanban cards, monthly). The toolbar mixed view icons, a hamburger popover with visibility and theme, and a hidden "group by" that only showed on kanban. Users want to combine how tasks are laid out, how each task looks and how many days they see, from one tidy toolbar on the title row.

## What the user sees

### Three independent choices

- **Layout:** List, Columns, Table, Calendar. Table and Calendar ship in phase 2 and stay hidden until then.
- **Style:** Notebook (`Caderno`, default) or Cards. Notebook is text on paper; Cards wraps each task in a bordered box. The bullet or checkbox marker still follows the "show checkboxes" setting in both styles.
- **Range:** depends on the layout.
  - List and Table use named presets: Today, Tomorrow, This week, Next 7 days, Upcoming, Month.
  - Columns uses numbers: 1-6 days, 1-3 weeks. Month is shown disabled.
  - Calendar (phase 2) uses 1-6 days, 1-3 weeks and Month.
  - Switching layout moves the range to the closest valid one.

Old views map to the new model:

| Old view | New view |
|---|---|
| list | List · Notebook · This week |
| kanban lists | Columns · Notebook · 1 week |
| kanban cards | Columns · Cards · 1 week |
| monthly | List · Notebook · Month (the monthly log) |

"Upcoming" shows the next 42 days and hides days without tasks.

### Title row

The toolbar always sits on the same row as the page title, aligned right:

```
Daily   [Today][<][13/11 to 15/11/2026 v][>]  |  View v   Window v
Casa    [Group: Status v]                      |  View v   Window v
Inbox   [Group: None v]                        |  View v   Window v
```

- **View** is a text menu like a desktop app menu bar. Sections: Layout (with shortcuts), Style (segmented Notebook | Cards with icons), Range (presets as a list, or `DAYS 1 2 3 4 5 6`, `WEEKS 1 2 3`, `MONTH` as pills; the active pill is filled with ink), and Actions (Reorganize, Daily only).
- **Window** holds **Full width**, which expands the content column to the whole window. Phase 3 adds **Split**.
- **Group** replaces date navigation on Collections (Status, Section, Priority) and Inbox (None, Priority, Collection). It applies to every layout, not only columns.
- When the row gets tight it shrinks in order: the title truncates, the date gets compact (`13-15/11`), Today moves into the date picker, Window moves to the end of View.

### Planner menu

The hamburger popover is gone. "Completed tasks", "Notes" and the theme swatches move to the planner menu (book icon, top right) under "Show" and "Theme".

### Completed tasks

With Group by Status, the completion status column always shows its tasks. Everywhere else the "Completed tasks" toggle hides them.

### Mobile (up to 640px)

The toolbar moves to a thin bar above the bottom navbar: `[<] 13-15/11 [>]  View` on Daily, `Group: Status  View` on Collections. View opens a bottom sheet with the same sections. Window is hidden because mobile already uses the full width.

### Keyboard

| Keys | Action |
|---|---|
| `v l` / `v k` / `v t` / `v c` | List / Columns / Table / Calendar |
| `v s` | Toggle style |
| `v 1`..`v 6` | 1-6 days (`v 1` = Today on List) |
| `v w` | 1 week (This week on List) |
| `v m` | Month |
| `v f` | Full width |
| `t` | Today |
| `[` / `]` | Previous / next range |

Menus show each shortcut on the right.

### Persistence

Layout, style, range and full width are saved per user on the server, so they follow the user across devices. Daily keeps the layout in the URL (`/daily/list`, `/daily/columns`); old URLs (`/daily/kanban`, `/daily/cards`, `/daily/monthly`) redirect.

## Phases

1. This spec: toolbar, model with existing views, planner menu, group by, mobile bar, full width, shortcuts.
2. Table layout, Calendar (hour grid for 1-6 days and 1 week with an all-day strip; week grid for 2-3 weeks and Month), List in Cards.
3. Split view: panes with any page, horizontal and vertical, draggable divider, at most 2 panes on mobile.

## Relevant Files

- `app/src/types/view.ts`, `app/src/utils/dailyRange.ts`, `app/src/utils/viewRange.ts`
- `app/src/components/toolbar/*` (PageToolbar, ViewMenu, WindowMenu, DateNav, GroupByMenu, MobileViewSheet)
- `app/src/pages/DailyPage.tsx`, `app/src/pages/DailyRoutes.tsx`, `app/src/hooks/useDailyView.ts`
- `app/src/components/board/DailyWeekBoard.tsx`, `app/src/components/daily/DailyList.tsx`
- `app/src/pages/CollectionsPage.tsx`, `app/src/pages/InboxPage.tsx`, `app/src/hooks/useBoardPreferences.ts`
- `app/src/components/nav/TopBarMenus.tsx`, `app/src/components/AppShell.tsx`, `app/src/hooks/shortcuts.ts`, `app/src/hooks/usePageShortcuts.ts`
- Removed: `app/src/components/ui/Toolbar.tsx`, `ViewSwitcher.tsx`, `ViewToolbar.tsx`, `app/src/components/board/BoardToolbar.tsx`
- `api/src/db/migrations/052_preferences_view_settings.sql`, `api/src/services/preferencesService.ts`
- `CLAUDE.md`, `DESIGN.md`
