# Event Support & Hotkey Fixes — Tasks

## Backend

- [ ] Create migration `036_task_type_event.sql` — add `'event'` to CHECK constraint
- [ ] Update `taskValidation.ts` — accept `'event'` as valid type
- [ ] Update `taskService.ts` — verify `'event'` passes validation in create/update
- [ ] Write unit tests for event type validation
- [ ] Write unit tests for event type creation and update
- [ ] Write property test: all three types round-trip through create → fetch

## Frontend — Event Type

- [ ] Add `'(': 'event'` to `CONVERSION_MARKERS` in `TaskItem.tsx`
- [ ] Add event indicator rendering (`○`) in `TaskItem.tsx`
- [ ] Style event indicator (CSS) — same dimensions as note indicator

## Frontend — QuickAdd Prefix Detection

- [ ] Add prefix detection in `QuickAdd.tsx` for `*`, `-`, `(`
- [ ] Pass `type` parameter through `onSubmit` and `apiCreateTask`
- [ ] Write unit tests for QuickAdd prefix stripping (all three types)

## Frontend — Mobile Conversion Fix

- [ ] Add `onChange`/`onInput` fallback for conversion markers in `TaskItem.tsx`
- [ ] Keep existing `keydown` handler for desktop
- [ ] Write unit tests for mobile conversion fallback

## Manual Verification

- [ ] Desktop: inline `(` conversion in TaskItem
- [ ] Desktop: QuickAdd with `( ` prefix creates event
- [ ] Desktop: QuickAdd with `- ` prefix creates note
- [ ] Desktop: QuickAdd with `* ` prefix creates task
- [ ] Mobile: inline `(` conversion in TaskItem
- [ ] Mobile: QuickAdd with `( ` prefix creates event
- [ ] Verify events render correctly in Daily, Inbox, Collection views
- [ ] Verify recurring event completion preserves event type
