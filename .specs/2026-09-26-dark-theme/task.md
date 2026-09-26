# Tasks: Dark Theme

## 1. API

- [x] 1.1 `VALID_BACKGROUNDS = ["beige", "white", "dark", "system"]` in `api/src/services/preferencesService.ts`; error message built from the list. No migration: `preferences.background` is `VARCHAR(20)` (migration 019).
- [x] 1.2 Tests: `dark`/`system` accepted, unknown value rejected with `VALIDATION_ERROR` (`preferencesService.test.ts`).
- Note: the unused `preferences.theme` column (`light|dark|system`, default `system`) was deliberately not reused - it would flip every existing user on a dark OS to dark.

## 2. Types and resolution

- [x] 2.1 `app/src/types/theme.ts`: `BackgroundPreference`, `ResolvedTheme`; `Preferences.background` uses it (`api/client.ts`).
- [x] 2.2 `utils/theme.ts`: `THEME_COLORS.dark = '#221a14'`, pure `resolveTheme(pref, prefersDark)`, `THEME_SWATCHES` (literal preview colors shared by Settings and the menu).
- [x] 2.3 `hooks/useResolvedTheme.ts`: `useSyncExternalStore` over `matchMedia('(prefers-color-scheme: dark)')`, subscribed only while the preference is `system`.

## 3. Tokens (`app/src/index.css`)

- [x] 3.1 Moved AppShell's inline `shellThemeStyle` object into `:root` (beige) and `:root[data-theme="white"]`, so portals rendered into `<body>` get the same tokens.
- [x] 3.2 `:root[data-theme="dark"]`: redefines `--color-*`, every `--planner-*`, `--shadow-*`, `color-scheme: dark`.
- [x] 3.3 New tokens: `--planner-backdrop`, `--planner-hover`, `--planner-scrollbar-thumb(-hover)`, `--planner-drag-shadow`, `--planner-menu-disabled-shadow`, `--color-on-aside`, `--color-syntax-{operator,string,error}`.
- [x] 3.4 `body` background reads `--planner-page-bg`.

## 4. AppShell

- [x] 4.1 Removed `isWhiteBackground` / `pageBackground` / `shellThemeStyle`.
- [x] 4.2 `useLayoutEffect` sets `document.documentElement.dataset.theme` and `theme-color`; cleanup removes both so logged-out screens return to beige.
- [x] 4.3 `localStorage['planner_background']` seeds the theme until preferences load (read only inside AppShell).

## 5. Settings

- [x] 5.1 Four options (Beige, White, Dark, Automatic) with literal swatches from `THEME_SWATCHES`; Automatic is a diagonal split.
- [x] 5.2 Settings aside uses `text-on-aside` instead of `text-cream`.
- [x] 5.3 i18n `settings.dark`, `settings.system`; help text updated (en, pt-BR).

## 6. Header menu Theme section

- [x] 6.1 `components/ui/ThemeSwitcher.tsx`: "Theme" label + radiogroup of Beige/White/Dark 24px swatches, optimistic preference update with rollback; `refetchOnMount: false` since AppShell owns the fetch.
- [x] 6.2 `Toolbar` renders `<ThemeSwitcher />` after the page's own items (after Show on Daily/Inbox/Collections).
- [x] 6.3 `ToolbarSectionLabel` moved to its own file to avoid a Toolbar <-> ThemeSwitcher import cycle.
- [x] 6.4 i18n `menu.theme`.

## 7. Hardcoded color sweep

- [x] 7.1 Modal backdrops and overlay shadows -> `--planner-backdrop` / `shadow-overlay` (ConfirmModal, QuickAdd, SearchOverlay, SectionDeleteModal, ColumnDeleteModal, AppShell help dialog, Toolbar, index.css).
- [x] 7.2 CustomSelect white text-shadow, MonthlyCalendarSpecimen `bg-white/[0.18]`, ContextMenu fallback, CollectionTreeNav drop target, PlannerDragContext shadow, FilterBar syntax colors.

## 8. Docs

- [x] 8.1 `DESIGN.md` "Dark Theme (Night Journal)" palette table.
- [x] 8.2 Styleguide swatches render `var(--token)` and list light + dark hex.

## 9. Verification

- [x] 9.1 Unit: `theme.test.ts`, `useResolvedTheme.test.ts`, `AppShell.test.tsx` (data-theme set/cleared, cache), `SettingsPage.test.tsx`, `ThemeSwitcher.test.tsx`, `Toolbar.test.tsx`.
- [x] 9.2 E2E `app/e2e/darkTheme.spec.ts`: dark on page + portalled QuickAdd + reload, Automatic follows `emulateMedia`, logout returns to beige, header menu Theme section after Show.
- [x] 9.3 Screenshots (desktop + mobile) in `app/dist/screenshots/`.
