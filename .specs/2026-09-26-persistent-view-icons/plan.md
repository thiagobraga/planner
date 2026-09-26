# Persistent View Switcher Icons

## What changes

Today, switching between the four ways of viewing a task list - **List**, **Kanban Lists**, **Kanban Cards**, and **Monthly** - means opening the hamburger menu (top-right of the page header), finding the "VISUALIZAÇÃO" (View) section, and clicking an icon inside the dropdown.

This is changed so those four view icons sit **directly beside the hamburger button, always visible, on every screen** - no menu needs to be opened to switch views. The hamburger menu keeps everything else it already has (the "MOSTRAR" / Show section: completed tasks, notes, next days).

### Before / after

- **Before**: hamburger → dropdown opens → "VISUALIZAÇÃO" section with 4 icons → click one → dropdown stays open.
- **After**: 4 separate icon buttons sit next to the hamburger button at all times. Clicking one switches the view immediately, no menu interaction needed. The hamburger dropdown no longer shows a "VISUALIZAÇÃO" section at all (it moved out, so there's nothing left to duplicate).

### Where this shows up

Anywhere the view switcher currently lives inside the hamburger menu:

- **Today (Daily) page**
- **Inbox**
- **Any Collection page**

(The Habits page has its own, unrelated Timeline/Calendar toggle - not affected.)

### Appearance

- Four square icon buttons, the same size as the hamburger button (24x24px, matching the app's 24px design rhythm). The hamburger button itself shrinks from its current 36x36px to 24x24px to match.
- Buttons are **separate and side-by-side** (each with its own rounded corners and a small gap between them) - not one joined/segmented pill.
- The icon for the currently active view has a **dark ("active") background** (matching the app's dark/primary button style); the other three are plain, low-contrast icons (matching the hamburger button's own idle look) until hovered or clicked.
- Icons: a list icon for List, a stacked-lists icon for Kanban Lists, a kanban-board icon for Kanban Cards, and a calendar icon for Monthly - reusing the exact icons already used today inside the dropdown.

### Remembering the chosen view

Already true today and unchanged by this work: the app remembers which view you last used, per page/collection, in the browser's local storage - so it's still there next time you open that page, even after closing the browser.

### What does NOT change

- The hamburger menu itself, its "MOSTRAR" (Show completed tasks / Notes / Next days) section, and any other menu content stay exactly as they are today, just without the view icons.
- No new view modes are added - still List, Kanban Lists, Kanban Cards, Monthly.
- No behavior change to what each view mode looks like once selected.

## Relevant Files

- `app/src/components/ui/Toolbar.tsx` - the hamburger button + dropdown; gets a new slot for the icon row, placed beside the button.
- `app/src/components/ui/ViewToolbar.tsx` - currently renders the view icons *inside* the dropdown (as a joined `ButtonGroup`); the icon-only segment moves out of here into the new component described below. Its custom `KanbanListIcon` svg is reused (exported instead of duplicated).
- `app/src/components/ui/ViewSwitcher.tsx` (new) - the four separate, always-visible icon buttons.
- `app/src/components/ui/ButtonGroup.tsx` - NOT used for the new row (explicitly separate buttons instead of a joined pill); still used elsewhere unchanged.
- `app/src/components/board/BoardToolbar.tsx` - drops its "VIEW" section (used by Inbox/Collections dropdowns).
- `app/src/pages/DailyPage.tsx` - drops the "VIEW" section from its dropdown; passes the new icon row to `Toolbar`.
- `app/src/pages/InboxPage.tsx` - passes the new icon row to `Toolbar`.
- `app/src/pages/CollectionsPage.tsx` - passes the new icon row to `Toolbar`.
- `app/src/hooks/useBoardPreferences.ts` - unchanged; already the source of the current view and the local-storage persistence.
- `app/src/index.css` - widen the reserved space next to page titles (`--page-header-toolbar-space`) so the wider icon row doesn't overlap page titles/subtitles, especially on narrow screens.
