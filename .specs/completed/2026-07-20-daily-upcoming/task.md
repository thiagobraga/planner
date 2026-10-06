# Phase 6 - Continuous Daily View & Calendar Navigator

## Backend Service Changes
- [n] Update `api/src/services/viewService.ts`
  - [n] Create `getDailyTimelineView(userId, startDate, endDate)` logic.
  - [n] Ensure it accurately groups tasks by `YYYY-MM-DD`.
  - [n] Ensure Overdue tasks are only injected into the `Today` group (or handled separately).
- [n] Update `api/src/routes/views.ts`
  - [n] Add `GET /views/timeline` route accepting `start` and `end` date parameters.

## Frontend UI Changes
- [n] Layout & Scaffolding
  - [n] Update `DailyPage.tsx` container to a two-column grid layout (main + sidebar).
- [n] Sidebar & Calendar
  - [n] Create `app/src/components/CalendarWidget.tsx`.
  - [n] Implement calendar UI with standard month view and clickable dates.
  - [n] Pass `onDateClick` to scroll the main container.
- [n] Main Feed & Infinite Scroll
  - [n] Use React Query's `useInfiniteQuery` (or equivalent block loading) to fetch timeline chunks.
  - [n] Load Today + past on mount, async fetch future chunks and prepend them.
  - [n] Reverse-chronological render order (Future at top, past at bottom).
- [n] Performance & Virtualization
  - [n] Create a `VirtualDay` component that acts as a wrapper for each day's task list.
  - [n] Use `IntersectionObserver` to measure and lock the height of `VirtualDay`, then unmount its children when far off-screen.
- [n] Scroll Anchoring & Sync
  - [n] Ensure CSS `overflow-anchor: auto` (or a React layout effect) prevents scroll jumps when future days are prepended.
  - [n] Use an `IntersectionObserver` on the day headers to detect which day is currently in view.
  - [n] Feed the "currently in view" day back to the `CalendarWidget` to highlight it.

## Future Enhancements (Optional)
- [n] (Optional) Add a user preference setting to toggle timeline direction (Reverse-chronological vs. Chronological).

## Verification
- [n] Tests
  - [n] `viewService.test.ts`: Verify `getDailyTimelineView` grouping and overdue behavior.
  - [n] `DailyPage.behavior.test.tsx`: Verify DOM virtualization unmounts invisible tasks.
- [n] Manual check of scrolling up to future days without layout jumping.
- [n] Manual check of clicking a date in the calendar and verifying smooth scroll.