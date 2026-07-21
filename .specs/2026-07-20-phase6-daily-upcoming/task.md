# Phase 6 - Continuous Daily View & Calendar Navigator

## Backend Service Changes
- [ ] Update `api/src/services/viewService.ts`
  - [ ] Create `getDailyTimelineView(userId, startDate, endDate)` logic.
  - [ ] Ensure it accurately groups tasks by `YYYY-MM-DD`.
  - [ ] Ensure Overdue tasks are only injected into the `Today` group (or handled separately).
- [ ] Update `api/src/routes/views.ts`
  - [ ] Add `GET /views/timeline` route accepting `start` and `end` date parameters.

## Frontend UI Changes
- [ ] Layout & Scaffolding
  - [ ] Update `DailyPage.tsx` container to a two-column grid layout (main + sidebar).
- [ ] Sidebar & Calendar
  - [ ] Create `app/src/components/CalendarWidget.tsx`.
  - [ ] Implement calendar UI with standard month view and clickable dates.
  - [ ] Pass `onDateClick` to scroll the main container.
- [ ] Main Feed & Infinite Scroll
  - [ ] Use React Query's `useInfiniteQuery` (or equivalent block loading) to fetch timeline chunks.
  - [ ] Load Today + past on mount, async fetch future chunks and prepend them.
  - [ ] Reverse-chronological render order (Future at top, past at bottom).
- [ ] Performance & Virtualization
  - [ ] Create a `VirtualDay` component that acts as a wrapper for each day's task list.
  - [ ] Use `IntersectionObserver` to measure and lock the height of `VirtualDay`, then unmount its children when far off-screen.
- [ ] Scroll Anchoring & Sync
  - [ ] Ensure CSS `overflow-anchor: auto` (or a React layout effect) prevents scroll jumps when future days are prepended.
  - [ ] Use an `IntersectionObserver` on the day headers to detect which day is currently in view.
  - [ ] Feed the "currently in view" day back to the `CalendarWidget` to highlight it.

## Future Enhancements (Optional)
- [ ] (Optional) Add a user preference setting to toggle timeline direction (Reverse-chronological vs. Chronological).

## Verification
- [ ] Tests
  - [ ] `viewService.test.ts`: Verify `getDailyTimelineView` grouping and overdue behavior.
  - [ ] `DailyPage.behavior.test.tsx`: Verify DOM virtualization unmounts invisible tasks.
- [ ] Manual check of scrolling up to future days without layout jumping.
- [ ] Manual check of clicking a date in the calendar and verifying smooth scroll.
