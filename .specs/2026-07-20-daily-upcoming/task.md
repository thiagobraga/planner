# Phase 6 - Continuous Daily View & Calendar Navigator

## Backend Service Changes
- [x] Update `api/src/services/viewService.ts`
  - [x] Create `getDailyTimelineView(userId, startDate, endDate)` logic.
  - [x] Ensure it accurately groups tasks by `YYYY-MM-DD`.
  - [x] Ensure Overdue tasks are only injected into the `Today` group (or handled separately).
- [x] Update `api/src/routes/views.ts`
  - [x] Add `GET /views/timeline` route accepting `start` and `end` date parameters.

## Frontend UI Changes
- [x] Layout & Scaffolding
  - [x] Update `DailyPage.tsx` container to a two-column grid layout (main + sidebar).
- [x] Sidebar & Calendar
  - [x] Create `app/src/components/CalendarWidget.tsx`.
  - [x] Implement calendar UI with standard month view and clickable dates.
  - [x] Pass `onDateClick` to scroll the main container.
- [x] Main Feed & Infinite Scroll
  - [x] Use React Query's `useInfiniteQuery` (or equivalent block loading) to fetch timeline chunks.
  - [x] Load Today + past on mount, async fetch future chunks and prepend them.
  - [x] Reverse-chronological render order (Future at top, past at bottom).
- [x] Performance & Virtualization
  - [x] Create a `VirtualDay` component that acts as a wrapper for each day's task list.
  - [x] Use `IntersectionObserver` to measure and lock the height of `VirtualDay`, then unmount its children when far off-screen.
- [x] Scroll Anchoring & Sync
  - [x] Ensure CSS `overflow-anchor: auto` (or a React layout effect) prevents scroll jumps when future days are prepended.
  - [x] Use an `IntersectionObserver` on the day headers to detect which day is currently in view.
  - [x] Feed the "currently in view" day back to the `CalendarWidget` to highlight it.

## Future Enhancements (Optional)
- [ ] (Optional) Add a user preference setting to toggle timeline direction (Reverse-chronological vs. Chronological).

## Verification
- [x] Tests
  - [x] `viewService.test.ts`: Verify `getDailyTimelineView` grouping and overdue behavior.
  - [x] `DailyPage.behavior.test.tsx` and `VirtualDay.test.tsx`: Verify DOM virtualization unmounts invisible tasks.
- [x] Manual check of scrolling up to future days without layout jumping.
- [x] Manual check of clicking a date in the calendar and verifying smooth scroll.

## Verification Evidence
- API suite: 647 tests passed in the isolated Compose API container.
- Daily frontend suite: 14 tests passed across page, behavior, calendar, and virtualization coverage.
- API and app lint completed with no changed-file errors; API and app production builds passed.
- Headless Chromium verified desktop and mobile layouts, zero horizontal overflow, active-date sync, calendar navigation, and anchored date scrolling at `https://codex.planner.local`.
- The repository does not currently include a Playwright configuration or dependency; browser verification used the existing local Chromium installation without adding a new dependency.
