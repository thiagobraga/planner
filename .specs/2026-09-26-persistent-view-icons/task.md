# Tasks: Persistent View Switcher Icons

## 1. Extract the shared `KanbanListIcon` so it isn't duplicated

- [ ] 1.1 In `app/src/components/ui/ViewToolbar.tsx`, add `export` to the local `KanbanListIcon` function component (`ViewToolbar.tsx:13-20`) so it can be imported elsewhere without copy-pasting the SVG.

## 2. Build `ViewSwitcher` (new component)

- [ ] 2.1 Create `app/src/components/ui/ViewSwitcher.tsx`:
  - Props: `{ view: BoardViewMode; onViewChange: (view: BoardViewMode) => void; className?: string }` (import `BoardViewMode` from `../../types/board`, same type `ViewToolbar.tsx` already uses).
  - Segments, in order: `list` (lucide `List`), `kanban-list` (`KanbanListIcon`, imported from `ViewToolbar.tsx`), `kanban` (lucide `Kanban`), `calendar` (lucide `Calendar`) - same 4 segments/order/icons as the current `ButtonGroup` in `ViewToolbar.tsx:96-124`, minus the conditional (`showCalendar`/`onCalendarClick`) logic - all 3 call sites always show all 4 and never need calendar-as-external-link behavior, so simplify: always render all 4, `onClick` always calls `onViewChange(segment)`.
  - Render as **plain, separate `<button>` elements** side-by-side (`role="group"`, `inline-flex items-center gap-1`) - explicitly NOT `ButtonGroup` (no joined/flattened corners).
  - Each button: `w-6 h-6 rounded-md` (24x24, matching the hamburger button's new size - see task 3.0 - and the app's 24px rhythm), icon `size={14} strokeWidth={1.5}` (scaled down from the hamburger's own icon, see task 3.0), `aria-pressed`, `aria-label`/`title` from i18n (reuse existing keys: `toolbar.list`, `toolbar.kanbanLists`, `toolbar.kanbanCards`, `toolbar.calendar`).
  - Active state: `bg-ink text-cream border border-ink` (dark, matching `Button`'s `primary` variant in `Button.tsx:28`).
  - Inactive state: `text-ink-light border border-transparent hover:bg-dot/30 transition-colors duration-(--motion-fast)` (matching the hamburger's own idle/hover style in `Toolbar.tsx:53`).
- [ ] 2.2 Add a unit test `app/src/components/ui/__tests__/ViewSwitcher.test.tsx` (colocate near `Toolbar.test.tsx`/`primitives.test.tsx` patterns): renders 4 buttons, clicking each calls `onViewChange` with the right value, the button matching `view` has `aria-pressed="true"` and the others `"false"`.

## 3. Let `Toolbar` place the switcher beside the hamburger button

- [ ] 3.0 Resize the existing hamburger button in `app/src/components/ui/Toolbar.tsx` (`Toolbar.tsx:48-56`) from `w-9 h-9` (36x36) with `<Menu size={18} strokeWidth={1.5} />` down to `w-6 h-6` (24x24) with `<Menu size={14} strokeWidth={1.5} />`, so it matches the new 24x24 view icon buttons and the app's 24px rhythm. Do the same for the matching overflow button in `app/src/components/ui/ViewToolbar.tsx:128-134` (`MoreHorizontal`, currently also `w-9 h-9`/`size={18}`) so every icon-only "more options" affordance in the app stays consistent.
- [ ] 3.1 In `app/src/components/ui/Toolbar.tsx`, add an optional prop `viewSwitcher?: ReactNode` to `ToolbarProps`.
- [ ] 3.2 Render `{viewSwitcher}` as a sibling **before** the hamburger `<button>` (still inside the same `page-header-toolbar` wrapper div, so the dropdown's `right-0 top-full` anchoring - `Toolbar.tsx:59-61` - stays correct since the hamburger stays the rightmost child).
- [ ] 3.3 Add a small horizontal gap between the switcher and the hamburger button on the wrapper div's className (e.g. `gap-1`), alongside the existing `page-header-toolbar relative ${className}` (`Toolbar.tsx:47`).
- [ ] 3.4 Update `app/src/components/ui/__tests__/Toolbar.test.tsx` to cover the new `viewSwitcher` prop rendering next to the hamburger button.

## 4. Remove the "VIEW" section from inside the dropdowns and wire up the new row

- [ ] 4.1 `app/src/pages/DailyPage.tsx`:
  - Remove the `<ToolbarSectionLabel>{t('menu.view')}</ToolbarSectionLabel>` + `<ViewToolbar view={...} onViewChange={...} showCalendar viewOnly compact />` block (`DailyPage.tsx:932-939`) from inside `<Toolbar>`'s children.
  - Pass `viewSwitcher={<ViewSwitcher view={boardPreferences.view} onViewChange={boardPreferences.setView} />}` to `<Toolbar className="daily-page-header-controls" ...>` (`DailyPage.tsx:904`).
  - Add the `ViewSwitcher` import; drop the now-unused `ViewToolbar` import if nothing else in the file uses it (check the file - `ViewToolbar` isn't used elsewhere in `DailyPage.tsx`).
  - Leave the right-click `ContextMenu` (`DailyPage.tsx:959-986`) as-is - it's a separate power-user shortcut, out of scope.
- [ ] 4.2 `app/src/components/board/BoardToolbar.tsx`:
  - Remove the `<ToolbarSectionLabel>{t('menu.view')}</ToolbarSectionLabel>` + `<ViewToolbar ... viewOnly compact showCalendar={props.showCalendar} />` block (`BoardToolbar.tsx:29-37`).
  - Remove `ViewToolbar` import and the now-unused `view`/`onViewChange`/`onCalendarClick`/`showCalendar` props from `BoardToolbarProps` **only if** nothing else in the component still needs `props.view` - it does (the `kanban-list`/`kanban` group-by check at `BoardToolbar.tsx:38`), so keep `view` in props, just drop `onViewChange`/`onCalendarClick`/`showCalendar` (no longer consumed by this component).
  - `InboxPage.tsx` and `CollectionsPage.tsx` (the two callers of `BoardToolbar`) drop the now-unused `onViewChange`/`showCalendar` props from their `<BoardToolbar>` call, since view switching moves to the new `viewSwitcher` prop on `<Toolbar>` (next task).
- [ ] 4.3 `app/src/pages/InboxPage.tsx`:
  - Pass `viewSwitcher={<ViewSwitcher view={boardPreferences.view} onViewChange={boardPreferences.setView} />}` to `<Toolbar className="inbox-page-header-controls" ...>` (`InboxPage.tsx:540`).
  - Update the `<BoardToolbar>` call (`InboxPage.tsx:541-552`) per 4.2.
- [ ] 4.4 `app/src/pages/CollectionsPage.tsx`:
  - Pass `viewSwitcher={<ViewSwitcher view={boardPreferences.view} onViewChange={boardPreferences.setView} />}` to `<Toolbar className="collection-page-header-controls" ...>` (`CollectionsPage.tsx:693`).
  - Update the `<BoardToolbar>` call (`CollectionsPage.tsx:694-705`) per 4.2.
- [ ] 4.5 Do NOT touch `app/src/pages/StyleguidePage.tsx`'s `<ViewToolbar />` demo (`StyleguidePage.tsx:502`) or `app/src/components/__tests__/primitives.test.tsx`'s `ViewToolbar` tests (lines 245-286) - `ViewToolbar` itself is unchanged, only its call sites in the 3 pages/`BoardToolbar` change.

## 5. CSS: widen the reserved header space for the wider control row

- [ ] 5.1 In `app/src/index.css`, the mobile block (`@media (max-width: 639px)`, ~lines 1301-1313) currently reserves `--page-header-toolbar-space` per page (`.daily-page` 128px, `.monthly-page` 64px, `.habits-page` 120px, `.inbox-page`/`.collection-detail-page` 64px) to keep `.page-header-subtitle` text from running under the floating hamburger button - sized for a single 36px button. With both the hamburger and the 4 view buttons now 24x24px, recompute each affected page's value (all except `.habits-page`, which is unaffected by this change) for the new row width: roughly hamburger (24px) + 4x(24px + 4px gap) = ~136px total, vs. today's single 36px button - smaller per-icon but a longer row overall. Verify the exact numbers live in the browser (see Verification) rather than guessing.
- [ ] 5.2 Also check `.collections-index-page { --page-header-toolbar-space: 48px; }` (`index.css:1222-1224`, unconditional, not just mobile) - the Collections index page uses a plain `Toolbar` too; confirm whether it also gains the view switcher (it lists collections, not tasks, so it likely does NOT get a `viewSwitcher` prop - verify while implementing) and only adjust this value if it does.

## 6. Testing (per CLAUDE.md: TDD, real coverage, no shortcuts)

- [ ] 6.1 Unit tests: `ViewSwitcher` (task 2.2), updated `Toolbar` test for the `viewSwitcher` slot (task 3.4).
- [ ] 6.2 Update/extend any existing `DailyPage`/`InboxPage`/`CollectionsPage` tests that assert on the old in-dropdown "VIEW" section or click through `ViewToolbar` icons inside the hamburger - they now need to click the new always-visible `ViewSwitcher` buttons instead (search each page's test file for `toolbar.list`/`toolbar.kanbanLists`/`toolbar.kanbanCards`/`toolbar.calendar` text or the old dropdown-open-then-click flow).
- [ ] 6.3 Playwright E2E: update any flow that opens the hamburger menu to switch views; it should now click the persistent icon directly without opening the menu first. Confirm the view choice still survives a reload (existing `localStorage` persistence, `useBoardPreferences`) for at least one page.
- [ ] 6.4 Manual/live verification (per CLAUDE.md worktree workflow): open Today, Inbox, and a Collection page in the Playwright browser; confirm all 4 icons render beside the hamburger at full width and at a narrow/mobile width, confirm the active icon shows the dark state, confirm the hamburger dropdown no longer shows a "View" section, and capture desktop + narrow-screen screenshots to `app/dist/screenshots/`.
