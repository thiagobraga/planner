# UI/UX Mobile Improvements

## Summary
Improve the Habits mobile experience so more of the timeline is visible at once and the control row never renders blank.

## Requirements
- On mobile, the habits view should show at least 5 days in the visible window, and 7 days is preferred if the layout can support it.
- The view should stay responsive and expand naturally on larger screens.
- Habit titles should be slightly smaller on mobile to free horizontal space.
- The habit option button should always render a visible affordance, even when the row is tight or content is sparse.

## Implementation
- Update `app/src/pages/HabitsPage.tsx` for the mobile layout behavior.
- Update `app/src/components/habits/HabitTimeline.tsx` to widen the visible mobile timeline or reduce per-cell density.
- Update `app/src/components/habits/HabitCalendar.tsx` if the calendar view also needs mobile refinement.
- Fix the row options control so it always has a visible icon, fallback, or sizing treatment.

## Risks
- Showing more days may compress labels too far if the row height and column width are not balanced.
- A fallback button treatment must remain consistent with the existing paper-like design.

## Verification
- Add a mobile viewport test that confirms more than one day column is visible.
- Add a regression test for the habit options button visibility.
- Confirm habit titles still read cleanly after the spacing changes.

