# Collections Context Menu Max-Height, Scrollbar & Add Collection Button Grid Alignment

## What

1. **Collections Context Menu Max-Height and Scrollbar**:
   When users have a growing list of collections, opening the "Collection" submenu from a task context menu (in Daily, Inbox, or Collections views) or opening any long context menu causes the menu to stretch beyond the viewport, making bottom collections unreachable.
   This change introduces a maximum height to context menu panels and submenus (specifically the collections context menu) with an internal scroll container. To maintain Planner's quiet, paper-journal aesthetic, the scrollbar remains invisible by default, becomes visible only when the mouse hovers inside the menu, and disappears when the menu loses focus (blur) or the mouse leaves.

2. **Add Collection Button Sizing on Dot Grid**:
   In `CollectionsIndexPage`, the "Add collection" (`+`) button in the header is currently sized at 32px (`size={20}` icon + `p-1.5` padding = 32px), causing the header container row (`div.flex.items-center.justify-between`) to stretch to 32px in height instead of aligning with the 24px dot grid baseline cell (`h-6`).
   The button will be resized to 24px (`w-6 h-6`, `<Plus size={16} />`), and the header row constrained to `h-6` (24px), preserving strict baseline alignment with the dot grid.

## User flows

### 1. Opening the Collections Submenu on a Task
- Right-clicking (or long-pressing on touch) any task in Daily, Inbox, or Collections views opens the task context menu.
- Hovering or navigating to "Collection" opens the collections submenu.
- When there are many collections (exceeding the maximum height of ~288px / 12 items or viewport height):
  - The submenu fits comfortably on the screen, capping at max-height.
  - The menu content is scrollable via mouse wheel, trackpad, touch drag, and arrow keys.
  - Arrow key navigation (`ArrowUp`, `ArrowDown`) automatically scrolls highlighted items into view.

### 2. Quiet, Hover-Aware Scrollbar Behavior
- **Default / Mouse Outside**: When the menu appears, the scrollbar is invisible (transparent thumb and track), keeping the interface clean and free of visual clutter.
- **Mouse Inside**: Moving the mouse over the context menu reveals a quiet, thin scrollbar using Planner's design tokens (`--planner-scrollbar-thumb`).
- **Mouse Leaves**: Moving the mouse outside the menu hides the scrollbar thumb.
- **Blur**: Clicking outside, tabbing out, or switching windows/focus away immediately hides the scrollbar.

### 3. Collections Index Header Grid Alignment
- Navigating to `/collections` displays the page header.
- The header title "Coleções" / "Collections" and the `+` action button sit cleanly within a 24px row (`h-6`).
- The `+` button is compact (24px × 24px) with subtle rounded hover, matching the dot grid spacing without expanding the vertical rhythm to 32px.

## Design rules
- Adheres to Planner's 24px vertical rhythm (`var(--dot-grid): 24px`): default max-height of 288px (12 items × 24px) or viewport-bounded `min(288px, calc(100vh - 32px))`.
- Header row and buttons must strictly respect 24px grid cells (`h-6`, `w-6 h-6`).
- Inherits theme and overlay tokens (`--planner-overlay-bg`, `--planner-scrollbar-thumb`, `--planner-scrollbar-thumb-hover`).
- Caret and border styling remain intact without being clipped by container overflow.
- No em dashes in documentation or code; simple dashes `-` only.

## Relevant Files

- `app/src/components/ui/ContextMenu.tsx` - Context menu panel, scroll wrapper, hover/blur state, scroll-into-view
- `app/src/index.css` - Context menu scrollbar styling and transitions
- `app/src/pages/CollectionsIndexPage.tsx` - Header row and add collection button 24px sizing
- `app/src/pages/InboxPage.tsx` - Inbox task collection submenu wiring
- `app/src/pages/DailyPage.tsx` - Daily task collection submenu wiring
- `app/src/pages/CollectionsPage.tsx` - Collections task collection submenu wiring
- `app/src/components/__tests__/ContextMenu.scroll.test.tsx` (new) - Automated tests for max-height, scrolling, keyboard scroll-into-view, and scrollbar visibility on hover/blur
- `app/src/pages/__tests__/CollectionsIndexPage.test.tsx` - Header row and button 24px grid tests
