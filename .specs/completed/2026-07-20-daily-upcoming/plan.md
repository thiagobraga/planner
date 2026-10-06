# Phase 6 - Continuous Daily View & Calendar Navigator

## Goal Description
Redesign the `DailyPage` into a continuous, two-column timeline. The main feed will display a continuous scroll of days (past, present, and future) in reverse-chronological order by default. The right sidebar will feature a sticky mini-calendar for quick navigation. To ensure performance, the DOM will be virtualized/garbage-collected for heavy scrolling.

## Architecture Decisions
- **Layout:** CSS Grid/Flex layout with a main content area (left) and a sticky right sidebar containing the Calendar. (The "Up Next" preview is skipped for now).
- **Feed Chronology:** Reverse-chronological (Future days at the top, Past days at the bottom). 
  - *Note: A user preference setting to toggle this direction is considered an optional future enhancement.*
- **Scroll Anchoring & Loading:** 
  - On mount, the page fetches and renders "Today" and a batch of past days. 
  - It then asynchronously fetches future days and prepends them to the DOM above "Today". 
  - CSS `overflow-anchor` (or React layout effects) will be used to ensure prepending content doesn't disrupt the user's scroll position.
- **Virtualization (Garbage Collection):** To prevent DOM memory bloat during infinite scrolling, off-screen days will be replaced with placeholder `div`s of the exact same height using an Intersection Observer approach (or a library like `@tanstack/react-virtual`).
- **Data Fetching:** Switch from single-day queries to a block-based fetching strategy (e.g., fetching 15-day chunks).

## Proposed Changes

### Backend
- **`viewService.ts`**: Create `getDailyTimelineView(userId, startDate, endDate)` returning an array of grouped days: `[{ date: '2026-07-20', tasks: [...] }]`.
- **`views.ts`**: Add `GET /views/timeline?start=YYYY-MM-DD&end=YYYY-MM-DD`.

### Frontend
- **`CalendarWidget.tsx`**: Build a mini-calendar for the sidebar that highlights the "currently in-view" day and allows clicking to scroll.
- **`DailyPage.tsx`**:
  - Implement bidirectional infinite loading (fetch past chunks on scroll down, fetch future chunks on scroll up).
  - Implement a `VirtualDay` component that measures its height when visible and unmounts its children when far off-screen to save DOM memory.
  - Implement Intersection Observers to track which day is currently at the top of the viewport and sync it with the CalendarWidget.
