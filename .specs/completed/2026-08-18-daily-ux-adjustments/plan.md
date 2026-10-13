# Specification: Daily View UX Adjustments and Today Navigation

## Feature Summary & User Goals

We want to refine the Daily (Diário) journal page and today navigation to feel natural, responsive, and seamless during daily planning.

### 1. Reliable "Today" Indicator & Input Placeholder
- When the user opens the Daily view or when the day changes at midnight, the current day must always clearly show the `HOJE` tag and the "Nova tarefa..." input placeholder.
- It should never lose its input field or today badge when switching days or navigating across views.

### 2. Independent "Próximos dias" (Upcoming) Toggle
- "Hoje" and "Próximos dias" should not be bundled together as a segmented button group.
- "Próximos dias" becomes a standalone toggle button in the header toolbar.
- **Default State**: Disabled by default on a fresh session / first run.
- **State Persistence**: Once toggled on or off, remember the user's preference in browser storage (`localStorage`) so it stays in that state across reloads.

### 3. Viewport-Aware "Hoje" (Scroll to Today) Button
- Place the "Hoje" button after the visibility controls (Show completed tasks / Hide old notes icons).
- **Visibility & Fade-in**:
  - While Today's section is visible on screen, the "Hoje" button is hidden.
  - When the user scrolls up or down such that Today's section leaves the viewport, the "Hoje" button smoothly fades in.
- **Action**: Clicking "Hoje" smoothly scrolls the viewport back to Today's section on the Daily page.

### 4. Global "t" Shortcut for Scrolling to Today
- When navigating without focusing any text input, pressing the single key `t` should scroll back to Today across the app:
  - **Daily View**: Scrolls directly to Today's section.
  - **Habits View**: Jumps/centers Today in timeline mode, or selects the current month in calendar mode.
  - **Monthly View**: Switches to current month and scrolls to Today's row.

### 5. Smart Cleanup of Empty Past Days
- When the user completes or deletes all tasks belonging to a past day, that past day header should automatically disappear from the list (when completed tasks are hidden).
- Only the current Today section remains visible when empty so the user can add new tasks for today.

### 6. Recurring Task Completion & Upcoming Synchronization
- When the user completes a recurring task (e.g., a weekly Saturday task):
  - The completed occurrence is cleared/hidden from the past list.
  - **If "Próximos dias" is enabled**: The newly created future occurrence (e.g. next Saturday) immediately appears under its upcoming date header without requiring a page refresh.
  - **If "Próximos dias" is disabled**: The view remains clean and does not force the upcoming list to open.

---

## Relevant Files

- `app/src/pages/DailyPage.tsx` - Daily journal view, header controls, date grouping, viewport observer, and sync listeners.
- `app/src/hooks/shortcuts.ts` - Global shortcut definitions and matcher.
- `app/src/components/AppShell.tsx` - Shell keyboard event handling and action dispatcher.
- `app/src/pages/HabitsPage.tsx` - Habits view integration for scrolling/jumping to today.
- `app/src/pages/MonthlyPage.tsx` - Monthly view integration for scrolling to today.
- `app/src/components/monthly/MonthlyRows.tsx` - Monthly day rows and today row scroll target.
- `app/src/pages/__tests__/DailyPage.behavior.test.tsx` - Daily page behavior and integration tests.
- `app/src/hooks/__tests__/shortcuts.test.ts` - Shortcut matcher unit tests.
