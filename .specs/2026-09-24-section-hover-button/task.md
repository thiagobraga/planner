# Tasks: Show "+ Nova seção" Only on Hover

## 1. Update Buttons to Hide by Default and Show on Hover

- [ ] 1.1 In `app/src/pages/InboxPage.tsx`, update the "+ New section" button className from `opacity-35 transition-opacity hover:opacity-100` to `opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100`.
- [ ] 1.2 In `app/src/pages/CollectionsPage.tsx`, update the "+ New section" button className from `opacity-35 transition-opacity hover:opacity-100` to `opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100`.
- [ ] 1.3 In `app/src/components/habits/HabitTimeline.tsx`, update the `add-group` button className from `opacity-35 transition-opacity hover:opacity-100` to `opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100`.

## 2. Unit and Integration Tests

- [ ] 2.1 Update/add assertions in `app/src/pages/__tests__/InboxPage.sections.test.tsx` to verify the button has `opacity-0` and `hover:opacity-100` classes.
- [ ] 2.2 Update/add assertions in `app/src/components/habits/__tests__/HabitTimeline.test.tsx` to verify the button has `opacity-0` and `hover:opacity-100` classes.
- [ ] 2.3 Run full test suites via `docker compose exec app npm test`.

## 3. Visual Verification

- [ ] 3.1 Open `https://antigravity.planner.local` via Playwright, verify button invisibility without hover and visibility on hover across Inbox, Collections, and Habits.
- [ ] 3.2 Capture desktop and narrow-screen screenshots in `app/dist/screenshots/`.
