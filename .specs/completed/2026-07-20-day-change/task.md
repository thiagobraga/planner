# Phase 7 - Midnight Rollover & Timezone Settings

## Backend Service Changes
- [x] Update `api/src/services/preferencesService.ts`
  - [x] Ensure `timeZone` can be safely updated and validates against standard IANA timezone strings.
- [x] Verify `viewService.ts` correctly applies the user's explicit timezone to all date boundaries.

## Frontend UI Changes
- [x] Timezone Detection & Settings
  - [x] Create a utility to detect browser timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
  - [x] Add a `TimeZone` selector in the `SettingsPage` to allow users to override auto-detection.
  - [x] Sync detected timezone to backend preferences on first load if not set.
- [x] Midnight Rollover Hook
  - [x] Create `useMidnightTimer.ts` hook.
  - [x] Implement robust date math to calculate ms until midnight in the configured timezone.
  - [x] Set a `setTimeout` to fire exactly at midnight.
- [x] Rollover Integration (`DailyPage.tsx`)
  - [x] Hook into `useMidnightTimer`.
  - [x] On trigger, invalidate React Query cache for the timeline to pull the newly grouped days.
  - [x] Trigger the scroll controller to smoothly scroll to the new "Today" element.

## Verification
- [x] Tests
  - [x] Add unit tests for timezone offset math and midnight calculation in `date.test.ts`.
  - [x] Add component tests simulating a timer fire and verifying the scroll function is called.
- [x] Manual verification
  - [x] Change system clock to 11:59 PM, wait a minute, and watch the app auto-refresh and scroll.

