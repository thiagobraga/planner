# Phase 7 - Midnight Rollover & Timezone Settings

## Backend Service Changes
- [ ] Update `api/src/services/preferencesService.ts`
  - [ ] Ensure `timeZone` can be safely updated and validates against standard IANA timezone strings.
- [ ] Verify `viewService.ts` correctly applies the user's explicit timezone to all date boundaries.

## Frontend UI Changes
- [ ] Timezone Detection & Settings
  - [ ] Create a utility to detect browser timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
  - [ ] Add a `TimeZone` selector in the `SettingsPage` to allow users to override auto-detection.
  - [ ] Sync detected timezone to backend preferences on first load if not set.
- [ ] Midnight Rollover Hook
  - [ ] Create `useMidnightTimer.ts` hook.
  - [ ] Implement robust date math to calculate ms until midnight in the configured timezone.
  - [ ] Set a `setTimeout` to fire exactly at midnight.
- [ ] Rollover Integration (`DailyPage.tsx`)
  - [ ] Hook into `useMidnightTimer`.
  - [ ] On trigger, invalidate React Query cache for the timeline to pull the newly grouped days.
  - [ ] Trigger the scroll controller to smoothly scroll to the new "Today" element.

## Verification
- [ ] Tests
  - [ ] Add unit tests for timezone offset math and midnight calculation in `date.test.ts`.
  - [ ] Add component tests simulating a timer fire and verifying the scroll function is called.
- [ ] Manual verification
  - [ ] Change system clock to 11:59 PM, wait a minute, and watch the app auto-refresh and scroll.
