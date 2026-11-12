# Mobile bottom navigation

## What the user sees

On phones (640px and narrower) the navigation bar sits at the bottom of the screen, within thumb reach, instead of the top.

- The bar shows only the four main tabs: Daily, Inbox, Habits, Collections.
- At the right end of the bar, the Planner icon replaces the round user initials. Tapping it opens the menu (account identity, search, settings, help, admin links, update notice, log out).
- The Planner icon has no circle. It is a plain 44px tap target that looks pressed while the menu is open, like the active tab.
- The menu opens upward from the bar.
- The brand icon at the left of the old top bar is gone on phones, since the same icon now lives at the right.
- The initials stay on tablet and desktop, where the menu button sits in the top bar.

## Relevant Files

- `app/src/components/nav/TopBar.tsx`
- `app/src/components/nav/TopBar.css`
- `app/src/components/__tests__/TopBar.test.tsx`
- `app/e2e/topBarNav.spec.ts`
