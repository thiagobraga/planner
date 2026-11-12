# Tasks

1. [ ] Failing tests first
   1. [ ] `TopBar.test.tsx`: on mobile the account button shows the Planner icon and no initials; on desktop it keeps initials
   2. [ ] `topBarNav.spec.ts`: at 390px the nav bottom edge matches the viewport bottom and the menu opens above the bar
2. [ ] `TopBar.tsx`: render `PlannerIcon` instead of initials when `mobile`; open menus from `rect.top` on mobile
3. [ ] `TopBar.css` (max-width 640px): `order: 1` to sink the bar below `main`, top border instead of bottom, safe-area bottom padding, hide the brand block, drop the account circle, pressed state on `aria-expanded`
4. [ ] Verify 390px and 320px, desktop unchanged, dark theme, no console errors; screenshots in `app/dist/screenshots/`
