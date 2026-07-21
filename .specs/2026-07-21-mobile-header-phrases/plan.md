# Mobile Header Cleanup and Phrase Adjustment

## Summary
Adjust the Monthly and Habits mobile headers so the subtitle no longer collides with the `Today` button. The desktop layout stays as-is.

## Requirements
- On narrow screens, the header should stack title, action button, then subtitle.
- The subtitle should stay secondary and compact through truncation, fade, or both.
- The `Today` button should remain legible above the textured background.
- Desktop behavior must not change.

## Implementation
- Update `app/src/pages/MonthlyPage.tsx` to use a mobile-specific header layout.
- Update `app/src/pages/HabitsPage.tsx` to match the same mobile treatment.
- Reuse existing button styling where possible; only introduce new wrapper styles if needed.
- Keep the current desktop header markup and spacing intact.

## Risks
- Mobile-only CSS may accidentally affect desktop spacing if not scoped carefully.
- The button background treatment must not make the header feel heavier than the rest of the app.

## Verification
- Add or update page tests for Monthly and Habits.
- Check both pages in a narrow browser viewport.
- Confirm the subtitle never appears under the `Today` button.

