# Top navbar replaces the sidebar

**Prototype:** [Penpot file](https://design.penpot.app/?screen=workspace&team-id=86bdcaa1-299a-806a-8008-252a88b586d6&project-id=64054412-1123-81ed-8008-5cd927408262&file-id=124ca123-b2be-80ce-8008-e80b1eda9003&page-id=124ca123-b2be-80ce-8008-e80b1eda9004)

## What this feature does

Planner's desktop nav is a 220px left sidebar, and phones get a separate bottom bar. Both are replaced by one top navbar on every screen size. Pages gain the sidebar's width.

Users choose how nav items look:

```
Text only        Daily    Inbox    Habits    Collections    More

Icon left        [x] Daily    [x] Inbox    [x] Habits    [x] Collections    [x] More

Icon above        [x]      [x]      [x]        [x]         [x]
                 Daily    Inbox    Habits   Collections    More
```

### User flows

- **Navigate:** click Daily, Inbox, Habits, or Collections. The current page has a tinted background and medium weight text.
- **Reach everything else:** More opens a dropdown with Settings, Help, and Shortcuts, plus admin links for admins. Shortcuts show on the right of each row.
- **Search:** the magnifier opens the existing search overlay.
- **Account:** the avatar opens a menu with name, email, and Logout.
- **Change nav style:** in Settings > General, or by right-clicking the bar. The choice is saved on the account and follows the user across devices.
- **File a task:** dragging a task onto Inbox in the bar still files it there.
- **Phones:** one row with logo, 4 items, and avatar. The avatar opens Search, Settings, Help, admin links, and Logout.

### Layout by screen size

```
>= 900px    [logo] Planner dev | Daily Inbox Habits Collections More     v1.0 [search] [avatar]
641-899px   [logo] | Daily Inbox Habits Collections More                      [search] [avatar]
<= 640px    [logo]  Daily Inbox Habits Collections                                     [avatar]
```

## Decisions

Made together:

| Topic          | Decision                                                           |
| -------------- | ------------------------------------------------------------------ |
| Sidebar        | Deleted, along with its collapse control                           |
| Bottom bar     | Deleted, phones use the top bar only                               |
| Items          | Daily, Inbox, Habits, Collections, More                            |
| Default style  | Icon left of label                                                 |
| Changing style | Settings > General and right-click on the bar                      |
| Active item    | Tint and medium weight, no red, so the DESIGN.md color rule stands |
| Phones         | One row: logo, 4 items with icon above label, avatar               |

Approved during implementation review:

- **Storage:** style is a new account preference, not localStorage.
- **Visual system:** Keep Lora, neutral active tint, and no hover transforms. Use the 4px sub-grid. Reduce narrow-screen gaps; hide the logo at 320px only when labels need room.
- **Bar height:** 48px for text only and icon left, 64px for icon above, 60px on phones.
- **Phones ignore the style setting.** They always show icon above label, matching today's bottom bar.
- **Desktop More:** Settings (`g s`), Help, Shortcuts (`?`), then admin-only Dashboard, Users, Compare, Styleguide.
- **Desktop avatar menu:** name and email, then Logout.
- **Phone avatar menu:** Search, Settings, Help, admin links, Logout. Shortcuts is left out because phones have no keyboard.
- **Version** is plain text as in the second mockup, not the dark chip.

## Relevant Files

**API**

- `api/src/db/migrations/050_preferences_nav_style.sql` (new)
- `api/src/services/preferencesService.ts`
- `api/src/services/accountService.ts`
- `api/src/types/account.ts`

**App, new**

- `app/src/components/nav/TopBar.tsx`, `TopBarItem.tsx`, `TopBarMenus.tsx`, `TopBar.css`
- `app/src/components/nav/navIcons.tsx`, `navItems.ts`
- `app/src/components/settings/NavStyleField.tsx`, `app/src/hooks/useUpdatePreferences.ts`
- `app/src/styles/boards.css`, `app/src/types/contextMenu.ts`, `navigation.ts`, `navigationUpdate.ts`, `settingsNav.ts`
- `app/src/components/__tests__/TopBar.test.tsx`, `ContextMenu.navigation.test.tsx`
- `app/e2e/topBarNav.spec.ts`

**App, changed**

- `app/src/components/AppShell.tsx`
- `app/src/components/ui/ContextMenu.tsx`
- `app/src/pages/SettingsPage.tsx`, `app/src/pages/StyleguidePage.tsx`
- `app/src/components/AgentNotice.tsx`, `UpdateToast.tsx`
- `app/src/index.css`
- `app/src/i18n/locales/en.ts`, `app/src/i18n/locales/pt-BR.ts`, `app/src/i18n/helpContent.ts`
- `app/src/types/api.ts` (`Preferences`)
- `app/src/components/__tests__/AppShell.test.tsx`, `ContextMenu.panel.test.tsx`
- `app/src/components/settings/__tests__/AccountDataSection.test.tsx`
- `app/src/pages/__tests__/SettingsPage.test.tsx`, `StyleguidePage.test.tsx`
- `app/e2e/sidebarDev.spec.ts`, `sidebarAlignment.spec.ts`, `sidebarVersion.spec.ts`, `dailyAccessibility.spec.ts`, `darkTheme.spec.ts`, `mcpOAuth.spec.ts`

**App, deleted**

- `app/src/components/Sidebar.tsx`, `Sidebar.css`, `SidebarNavItem.tsx`
- `app/src/components/BottomBar.tsx`, `BottomBar.css`
- `app/src/components/__tests__/Sidebar.test.tsx`, `BottomBar.test.tsx`

**Docs**

- `DESIGN.md`, `CLAUDE.md`

## Tasks

`[ ]` not started, `[~]` in progress, `[x]` completed.

### 0. Prototype

- [x] Build prototype in Penpot covering all 3 styles, menus, Settings field, and responsive tiers
- [x] Apply review changes to this spec

### 1. Environment

- [x] `git worktree add .worktrees/topbar-navigation -b feat/topbar-navigation`
- [x] Copy `.env.example` to `.env`, set `COMPOSE_PROJECT_NAME=planner-topbar` and `APP_SUBDOMAIN=codex.planner`
  - Host entry and cert already exist
  - New project name gives fresh volumes, avoiding stale `planner-claude` data
- [x] Run `bash .hooks/setup-hooks.sh`, then `docker compose up -d`
- [x] Commit this spec, push, open draft PR against `main`: #392
- [x] Open Playwright browser on `https://codex.planner.local` and keep it open during development

Uncommitted changes on `main` (including `compose.yml`, `index.css`, `Checkbox.tsx`) stay untouched and are not in the worktree. It runs the committed `postgres:18-alpine` on its own new volume. An ignored local compose override sets `PGDATA` to a nested directory because the committed mount uses the pre-18 path. No existing database volumes are changed.

### 2. Preference (API)

- [x] Write failing integration tests with real DB: default value, each valid value persists, invalid returns 400, account export and preference restoration through PATCH (no import endpoint exists)
- [x] Add migration 050: `nav_style TEXT NOT NULL DEFAULT 'icon-left'` with a CHECK for `text`, `icon-left`, `icon-top`. Purely additive, so safe for production
- [x] Follow the `showCheckboxes` path through `preferencesService.ts` (row mapping, validation, update clause), `accountService.ts`, and `types/account.ts`
- [x] Confirm sync reaches other tabs through the `entityType: 'preferences'` handler in `AppShell.tsx`

### 3. Move shared nav code out of `Sidebar.tsx`

- [x] Move `CalendarDayIcon`, `MonthlyIcon`, `StyleguideIcon`, `PlannerIcon` to `nav/navIcons.tsx`
- [x] Move `NAV_ITEMS` to `nav/navItems.ts`
- [x] Put `NavItem` and `NavStyle` in `app/src/types/`
- [x] Grep all importers and update them, including `StyleguidePage.tsx` (`AuthShell.tsx` already owns its 64px logo asset)

### 4. `ContextMenu` additions

Reused for all menus. It already has a portal, keyboard handling, `role="menu"`, and outside-click dismissal.

- [x] Write failing tests for both new fields; existing tests must keep passing
- [x] Add optional `shortcut`: right-aligned text
- [x] Add optional `checked`: renders `menuitemradio`, for the style menu

### 5. Top bar

- [x] Write failing tests: each style renders, active item, More contents for admin and non-admin, phone avatar menu, right-click updates the preference, Inbox drop target
- [x] `TopBar.tsx`: layout, brand, right cluster, right-click style menu
- [x] `TopBarItem.tsx`: `NavLink` with `aria-current`, rendering by `data-nav-style`, visible `focus-visible` outline
- [x] `TopBarMenus.tsx`: More and avatar menus from one item list that varies on phones
  - Triggers set `aria-haspopup` and `aria-expanded` and open from the button's rect
  - Clicking an open trigger closes it instead of reopening; focus returns to the trigger
- [x] `TopBar.css`: existing tokens only. Tiers are CSS media queries; one `matchMedia('(max-width: 640px)')` check picks avatar menu contents
- [x] Move `InboxNavItem`, keeping drag behavior. Check `dnd/collision.ts` and `useTaskDrag.ts` with a horizontal target
- [x] Move `UpdateToast` next to the version on desktop and into the avatar menu on phones

### 6. `AppShell.tsx`

- [x] Change shell from row to column, with `TopBar` above `main` inside `PlannerDragProvider`
- [x] Pass `onOpenSearch` and `onOpenShortcuts` to the existing `searchOpen` and `helpOpen` state
- [x] Remove `sidebarOpen`, `sidebarCollapsed`, `useBottomBar`, both matchMedia effects, and the hamburger button

### 7. Settings

- [x] Add `NavStyleField` using `ui/Radio.tsx`, as its own component because `SettingsPage.tsx` is already at 901 lines
- [x] Right-click and Settings write through the same preferences mutation

### 8. Cleanup

- [x] Delete sidebar and bottom bar components, their tests, and their `index.css` rules (`.sidebar-*`, `.bottom-bar*`, `.mobile-menu-btn`, `.app-shell--bottom-bar`)
- [x] Keep `--planner-sidebar-*` tokens, because `SettingsPage` and `LegalLayout` use them
- [x] Grep for fixed elements offset to clear the old bottom bar (toasts, `AgentNotice`) and fix them
- [x] i18n: remove collapse and open keys, add style labels, fix the "sidebar" line in `helpContent.ts`
- [x] Update the nav specimen in `StyleguidePage.tsx`
- [x] Docs: `DESIGN.md` Navigation and Sidebar Link sections, `CLAUDE.md` AppShell description, `README.md` if it mentions the sidebar

### 9. Verify

- [x] Add `app/e2e/topBarNav.spec.ts`: navigation, switching style and reloading, keyboard use of menus, dragging a task onto Inbox at desktop width
- [x] Rewrite `sidebarDev`, `sidebarAlignment`, `sidebarVersion`; update `dailyAccessibility`
- [x] Run `docker compose exec` for api and app `npm test`, `lint`, `build`, and app `test:e2e`
- [x] Screenshots to `app/dist/screenshots/`: all 3 styles at desktop, plus 641px, 390px, and 320px
- [x] Check beige and dark themes, in en and pt-BR
- [x] Sweep every route: Daily views, Inbox, Habits, Collections, Settings, Help, admin. No horizontal overflow, no console errors, wider pages still look right
- [x] Apply Impeccable craft and manual audit checks against rendered desktop/mobile views. `DESIGN.md` wins any conflict with design skills
- [x] PR #392 merged; the review draft requirement no longer applies.

## Risks and verification

The UI audit checked banner and nav semantics, labelled controls, keyboard menus and focus return, a 44px phone account target, theme tokens, visible error feedback, and rendered layouts. The implementation adds no dependency or decorative motion.

- **320px fit - resolved:** hide the logo at 328px and below. Four icon-above labels and the 44px account target fit at 320px without clipping in en and pt-BR, beige and dark. Playwright geometry checks cover all three desktop style preferences and the phone layout.
- **Wider pages - resolved for tested routes:** Daily (list, kanban, cards, monthly), Inbox, Habits, Collections, Settings, Help, admin Dashboard, Users, Compare, and Styleguide render at 1440px and 390px without document or main-content horizontal overflow. The phone route sweep also covers 320px. Dense board content keeps its own internal scroll area.
