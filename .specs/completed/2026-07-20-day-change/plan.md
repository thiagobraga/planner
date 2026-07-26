# Phase 7 - Midnight Rollover & Timezone Settings

## Goal Description
Implement an automatic "midnight rollover" feature backed by robust user timezone settings. When the clock strikes midnight in the user's configured timezone, the application should automatically shift the context of the Daily page. It will re-fetch data so that yesterday's uncompleted tasks become overdue, and seamlessly smooth-scroll the user to the newly minted "Today" section.

## Architecture Decisions
- **Timezone Source of Truth:** The backend already has a `time_zone` column in the `preferences` table. We will ensure this is properly hydrated in the frontend and accurately dictates date logic.
- **Midnight Timer:** The frontend will calculate the exact millisecond duration until the next midnight (accounting for the user's explicit timezone preference, not just the browser's implicit timezone).
- **Rollover Action:** When the timer triggers, it will invalidate the main `tasks` query to force a data refresh and dispatch a global event or store action to command the DailyPage to scroll to the new current day.

## Proposed Changes

### Backend
- Ensure `preferences` endpoint allows updating `timeZone`.
- Verify `viewService.ts` respects the `timeZone` strictly when deciding what "Today" is.

### Frontend
- **Timezone Auto-Detection:** On login or initial load, check if the browser's `Intl.DateTimeFormat().resolvedOptions().timeZone` matches the DB preference. If missing, update the backend.
- **`useMidnightTimer` Hook:** Create a custom hook that calculates the time until midnight and executes a callback.
- **DailyPage Rollover:** Hook into the timer to invalidate queries and trigger a scroll-to-today action.

## Verification Plan
- **Unit Tests (`date.test.ts`)**: Verify the midnight calculation correctly handles cross-timezone math and Daylight Saving Time edge cases.
- **Behavior Tests**: Mock the system clock, advance it past midnight, and verify the frontend triggers a re-fetch and scroll event.
