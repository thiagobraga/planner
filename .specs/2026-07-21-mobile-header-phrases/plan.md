# Mobile Header Cleanup and Phrase Adjustment

## Summary
Keep page headers structurally and visually consistent. The header contains only the title and phrase, while a sticky toolbar sibling stays right-aligned on the relevant header row.

## Requirements
- Daily, Monthly, and Habits use the same two-line title and phrase treatment.
- Toolbar buttons remain outside the semantic `<header>` element.
- Toolbars stay sticky at the main page's right edge rather than a narrower content column.
- Mobile phrases ellipsize before the toolbar, with a page-colored fade behind transparent controls.
- Daily, Inbox, and collection detail expose persisted controls for completed tasks and old notes.
- Existing toolbar actions and desktop content widths remain unchanged.

## Implementation
- Keep consistent title and phrase markup in `DailyPage.tsx`, `MonthlyPage.tsx`, and `HabitsPage.tsx`.
- Keep Daily's task list and Monthly's calendar constrained while allowing their header toolbar layer to span the full page width.
- Add sticky visibility toolbars to Inbox and collection detail.
- Reuse one visibility-preferences hook and one accessible icon-control component across task-list pages.
- Reserve mobile phrase space per toolbar width and use the shared toolbar fade from `app/src/index.css`.

## Risks
- Sticky controls must retain their initial row alignment without adding layout height.
- Preference changes must update the current page immediately and roll back on failure.
- Header changes must not regress Daily task visibility or Habits view switching.

## Verification
- Add structural tests that keep toolbar controls outside `<header>`.
- Add preference regression tests for Daily, Inbox, and collection detail.
- Run targeted page tests and the app production build.
- Verify right alignment, sticky position, mobile truncation, and preference toggling in the live app.
