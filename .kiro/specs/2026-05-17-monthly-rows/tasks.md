# Monthly Rows Feature Plan

## Objective
Implement a new row-based monthly view component (`MonthlyRows`) that renders days of the month sequentially with horizontal dividers denoting the start of a new week. The "start of the week" divider will respect the user's `weekStart` preference, which will be fetched from the backend API.

## Key Files & Context
- `app/src/api/client.ts`: Needs a new function to fetch preferences from the API (`GET /api/v1/preferences`).
- `app/src/hooks/usePreferences.ts` (New): A custom hook to fetch and manage user preferences using React Query.
- `app/src/components/MonthlyRows.tsx` (New): The new component implementing the specified layout.
- `app/src/pages/MonthlyPage.tsx`: Will be updated to use the new `MonthlyRows` component instead of its current static list.
- `app/src/pages/StyleguidePage.tsx`: Will be updated to include `MonthlyRows` as a demonstration specimen.

## Implementation Steps

1.  **API Integration**:
    - Update `app/src/api/client.ts` to include `export interface Preferences` and `export async function fetchPreferences(): Promise<Preferences>`.
    
2.  **State Management**:
    - Create `app/src/hooks/usePreferences.ts` using `@tanstack/react-query`'s `useQuery` to fetch `fetchPreferences`.

3.  **Component Creation (`MonthlyRows.tsx`)**:
    - Create the new component that accepts props for selected year and month (or manages them internally for now).
    - Render the Year selector (e.g., `2025 **2026**`).
    - Render the Month selector (e.g., `JAN FEB ... **MAY** ...`).
    - Generate the days for the selected month/year.
    - Map over the days and render rows (e.g., `01 FRI |`).
    - Apply bold styling to weekends (`SAT`, `SUN`).
    - Conditionally render a divider (`------------`) before the day that matches the user's `weekStart` preference (`monday` or `sunday`).

4.  **Component Integration**:
    - Replace the static `MONTH_ITEMS` rendering in `app/src/pages/MonthlyPage.tsx` with `<MonthlyRows />`.
    - Add `<MonthlyRows />` to `app/src/pages/StyleguidePage.tsx` to showcase the new layout alongside existing UI components.

## Verification & Testing
- Verify that the preferences are successfully fetched from `/api/v1/preferences`.
- Verify the layout matches the requested format (Year header, Month header, Day rows).
- Verify that weekends (`SAT`, `SUN`) are bolded.
- Verify that the week-start divider appears correctly based on the API preference (before Monday if `weekStart: 'monday'`, before Sunday if `weekStart: 'sunday'`).
- Check that the component renders correctly in both `MonthlyPage` and `StyleguidePage`.