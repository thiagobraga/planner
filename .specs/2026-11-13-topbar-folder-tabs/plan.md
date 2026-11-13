# Centered container and folder-tab topbar

## What the user sees

### One centered column

- Every page sits in a single column, up to 680px wide, centered on the screen. Today the column is 648px and glued to the left edge.
- Below 680px the column shrinks with the screen. No horizontal page scroll.
- The rule applies everywhere: Daily (list, kanban, cards, monthly), Inbox, Habits, Collections, Help, Settings, Admin, Styleguide. Wide boards scroll sideways inside the column.

### Top bar (desktop and tablet)

- The bar background and its bottom border still span the full window.
- Its contents (wordmark, tabs, actions) align to the same 680px centered column as the page.
- Left: the `BulletPlanner` wordmark only. The book icon no longer sits beside it.
- Center: the four tabs, Daily, Inbox, Habits, Collections.
- Right: app version (only when there is room), search, and the Planner book icon.
- The selected tab looks like a folder tab: square sides, rounded top corners, a thin border on the left, top and right, filled with the page color. It has no bottom edge, so it flows into the page below. Other tabs are plain text with a hover tint.

### Planner menu

- The "More" button and the round user initials are gone. The Planner icon opens one menu with everything:
  - app name and version
  - account name and email
  - search (phones), settings, help, keyboard shortcuts (desktop), admin links (admins)
  - update notice when a new version is ready
  - log out
- The Planner icon looks pressed while on Settings, Help, Admin or Styleguide.

### Icons

- Daily: a plain calendar square with a thicker top band and the day number in bold, without the binder rings.
- Inbox: the common inbox tray icon instead of the chevron.

### Phones (640px and narrower)

- The bottom bar stays as today: four tabs and the Planner icon. The menu now shows the app name and version at the top.

## Relevant Files

- `app/src/index.css`
- `app/src/components/AppShell.tsx`
- `app/src/components/PageHeader.tsx`
- `app/src/components/nav/TopBar.tsx`
- `app/src/components/nav/TopBar.css`
- `app/src/components/nav/TopBarMenus.tsx`
- `app/src/components/nav/navIcons.tsx`
- `app/src/components/nav/navItems.ts`
- `app/src/types/navigation.ts`
- `app/src/i18n/locales/en.ts`, `app/src/i18n/locales/pt-BR.ts`
- Pages using the old 648px cap: `DailyPage.tsx`, `DailyList.tsx`, `DailyWeekBoard.tsx`, `HabitTimeline.tsx`, `InboxPage.tsx`, `CollectionsPage.tsx`, `CollectionsIndexPage.tsx`, `HelpPage.tsx`, `SettingsPage.tsx`, `StyleguidePage.tsx`, `admin/*`
- Tests: `components/__tests__/TopBar.test.tsx`, `AppShell.test.tsx`, `PageHeader.test.tsx`, `app/e2e/topBarNav.spec.ts`, `app/e2e/sidebar*.spec.ts`
- `DESIGN.md`

## Tasks

Branch `feat/topbar-folder-tabs`, worktree `.worktrees/topbar-folder-tabs`, stack `COMPOSE_PROJECT_NAME=planner-claude`, `APP_SUBDOMAIN=claude.planner` (`https://claude.planner.local`).

Run tools capped: `docker compose exec -e NODE_OPTIONS=--max-old-space-size=2048 app nice -n 10 npm test -- --maxWorkers=2`, Playwright `--workers=2`, one suite at a time.

### 1. Container

- [x] 1.1 `index.css` `@theme`: `--container-page: 680px` (utility `max-w-page`)
- [x] 1.2 `AppShell.tsx`: wrap `<Outlet />` in `div.page-container.mx-auto.w-full.max-w-page`
- [x] 1.3 Remove `max-w-162` from all pages/components (13 uses); drop `max-w-5xl` (Settings), `max-w-[832px]` (Daily monthly), `max-w-2xl` (CollectionsIndex)
- [x] 1.4 Verify boards scroll inside the column and sticky headers still stick
- [x] 1.5 Tests: AppShell wrapper, PageHeader class

### 2. Topbar layout

- [ ] 2.1 `TopBar.tsx`: inner `.topbar-row` grid `auto 1fr auto`, max 680 centered; header padding matches `<main>`
- [ ] 2.2 Wordmark without icon; tabs centered; right cluster version, search, planner icon
- [ ] 2.3 Hide version via `@container` when row is narrow
- [ ] 2.4 Remove "More" button; planner icon active on settings/help/admin/styleguide
- [ ] 2.5 Planner icon on all widths (drop initials); update dot on all widths

### 3. Folder tab

- [ ] 3.1 Tabs bottom-aligned, transparent border, `border-bottom: 0`, top radius
- [ ] 3.2 Active: `--color-dot` border, page bg, `margin-bottom: -1px` over bar border
- [ ] 3.3 `icon-top` nav style keeps folder look
- [ ] 3.4 <=640px: reset to current bottom-bar look

### 4. Unified menu

- [ ] 4.1 `TopBarMenuState.kind`: `'menu' | 'style'`
- [ ] 4.2 Items: name + version header, identity, utilities, update, logout
- [ ] 4.3 Remove unused `nav.more` key (en, pt-BR) after grepping callers

### 5. Icons

- [ ] 5.1 Inbox: lucide `Inbox`
- [ ] 5.2 `CalendarDayIcon`: square, filled top band, bold day, no rings

### 6. Verify and docs

- [ ] 6.1 Unit, lint, build, E2E (capped)
- [ ] 6.2 Chrome 1440px + 390px, light/dark, nav styles; screenshots in `app/dist/screenshots/`
- [ ] 6.3 `DESIGN.md` updated
