# Event Support & Hotkey Fixes - Tasks

## Backend

- [x] Create migration `040_task_type_event.sql` - add `'event'` to CHECK constraint (renumbered from the spec's `036`; that number was already taken by `036_preferences_collapsed_collections.sql` by the time this was implemented - main was at `039`)
- [x] Update `taskValidation.ts` - accept `'event'` as valid type
- [x] Update `taskService.ts` - verify `'event'` passes validation in create/update (also updated its own duplicate inline validation, separate from `taskValidation.ts`)
- [x] Write unit tests for event type validation
- [x] Write unit tests for event type creation and update
- [x] Write property test: all three types round-trip through create → fetch

## Frontend - Event Type

- [x] Add `'(': 'event'` to `CONVERSION_MARKERS` in `TaskItem.tsx`
- [x] Add event indicator rendering (`○`) in `TaskItem.tsx` (also mirrored in `TaskBlockPreview.tsx`'s drag overlay, which explicitly repeats TaskItem's type styles)
- [x] Style event indicator (CSS) - same dimensions as note indicator (styled inline via Tailwind utility classes, matching the existing note indicator's actual implementation rather than a separate CSS file, which this codebase does not use for this component)

## Frontend - QuickAdd Prefix Detection

- [x] Add prefix detection in `QuickAdd.tsx` for `*`, `-`, `(`
- [x] Pass `type` parameter through `onSubmit` and `apiCreateTask`
- [x] Write unit tests for QuickAdd prefix stripping (all three types)

## Frontend - Mobile Conversion Fix

- [x] Add `onChange`/`onInput` fallback for conversion markers in `TaskItem.tsx`
- [x] Keep existing `keydown` handler for desktop
- [x] Write unit tests for mobile conversion fallback

## Manual Verification

- [x] Desktop: inline `(` conversion in TaskItem
- [x] Desktop: QuickAdd with `( ` prefix creates event
- [x] Desktop: QuickAdd with `- ` prefix creates note
- [x] Desktop: QuickAdd with `* ` prefix creates task
- [x] Mobile: inline `(` conversion in TaskItem - verified in a touch-emulated browser by filling the input without keydown; the prefix was stripped and the row rendered `○`
- [x] Mobile: QuickAdd with `( ` prefix creates event - prefix parsing is device-agnostic and the live Quick Add request created `type: event`
- [x] Verify events render correctly in Daily, Inbox, Collection views - verified in all three live routes through the shared `TaskItem` component
- [x] Verify recurring event completion preserves event type (verified via `taskService.property.test.ts`'s recurring-event completion test, not a live recurring event in the browser)

## Navigation Regression

- [x] Hydrate Inbox local task and section state from fresh React Query cache data on remount
- [x] Add a regression test for returning to Inbox while its query data remains fresh
- [x] Verify Inbox -> collection -> Inbox restores tasks, heading, and subtitle in the live browser

**Known spec inconsistency**: the plan's "Add event indicator rendering" step explicitly requires the `○` indicator to be non-clickable ("like notes - events are informational markers, not toggleable checkboxes"), but the plan's manual verification section assumes events have a toggleable checkbox. Implemented per the explicit design decision: events cannot be completed via the indicator, consistent with notes.
