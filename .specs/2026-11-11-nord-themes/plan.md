# Nord theme support

**Status:** In progress. Presets, palettes, controls, tests and docs are done and CI is green. Open: 2.3 (semantic `--color-danger` token exists but components still use the accent token for error and overdue) and 4.4 (empty, loading and error states not checked in both themes).

## Behavior

Add **Nord Light** and **Nord Dark** alongside Beige, White, Dark and Automatic. Preserve the current default and all existing selections.

Both presets appear in Settings > Appearance and the header theme switcher, with distinct previews, translated labels and accessible selected states. Selection applies immediately, persists across reloads, syncs between sessions and rolls back on save failure.

Use [Nord's official palette](https://www.nordtheme.com/docs/colors-and-palettes/): Snow Storm surfaces for light, Polar Night surfaces for dark, Frost interaction accents and Aurora red for errors and overdue tasks. Preserve typography, spacing, dot-grid settings and user-assigned collection and label colors.

| Role | Nord Light | Nord Dark |
| --- | --- | --- |
| Page | `#eceff4` | `#2e3440` |
| Secondary surface | `#e5e9f0` | `#3b4252` |
| Primary text | `#2e3440` | `#eceff4` |
| Secondary text | `#4c566a` | `#d8dee9` |
| Interaction accent | Frost blue | Frost blue |
| Error / overdue | Aurora red | Aurora red |

Require 4.5:1 contrast for normal text and 3:1 for meaningful controls and focus indicators, adjusting Nord shades where necessary. Errors and overdue states remain distinguishable from blue interaction states.

Nord applies throughout the logged-in app: navigation, task views, boards, calendars, habits, settings, menus, dialogs and browser chrome. Automatic continues choosing Beige or the existing Dark theme; both Nord presets remain fixed regardless of OS appearance. Logged-out screens and the marketing site retain their current appearance.

## Relevant Files

- Theme types and API contract: `app/src/types/theme.ts`, `app/src/types/api.ts`
- Resolution, previews and browser chrome: `app/src/utils/theme.ts`, `app/src/hooks/useResolvedTheme.ts`
- Document theme and cached preference: `app/src/components/AppShell.tsx`
- Palette declarations: `app/src/styles/theme.css`; existing theme-specific shadow declarations in `app/src/index.css`
- Selection controls: `app/src/pages/SettingsPage.tsx`, `app/src/components/ui/ThemeSwitcher.tsx`
- Translations: `app/src/i18n/locales/en.ts`, `app/src/i18n/locales/pt-BR.ts`
- Preference validation: `api/src/services/preferencesService.ts`
- Semantic color consumers: `app/src/components/TaskItem.tsx`, `app/src/components/ui/Button.tsx`, plus error, overdue and priority consumers identified by the accent audit
- Unit tests: `app/src/utils/__tests__/theme.test.ts`, `app/src/utils/__tests__/themePalette.test.ts`, `app/src/utils/__tests__/__snapshots__/themePalette.test.ts.snap`, `app/src/hooks/__tests__/useResolvedTheme.test.ts`, `app/src/components/__tests__/AppShell.test.tsx`, `app/src/pages/__tests__/SettingsPage.test.tsx`, `app/src/components/ui/__tests__/ThemeSwitcher.test.tsx`
- API tests: `api/src/services/__tests__/preferencesService.test.ts`, `api/src/routes/__tests__/preferences.test.ts`, plus new real PostgreSQL/Redis integration coverage following the current test harness
- Browser tests: `app/e2e/darkTheme.spec.ts`
- Design documentation: `DESIGN.md`

## Tasks

### 1. Preference contract

- [x] 1.1 Write failing validation and resolution tests for `nord-light` and `nord-dark`.
- [x] 1.2 Add both values to `BackgroundPreference`, `ResolvedTheme` and backend `VALID_BACKGROUNDS`.
- [x] 1.3 Reuse `PATCH /api/v1/preferences` with `{ background }` and the existing preference sync event. Leave the separate legacy `theme` field unchanged. No migration is needed because `background VARCHAR(20)` accommodates both identifiers.
- [x] 1.4 Extend AppShell's cached-background allowlist so reloads recognize both presets. Retain the existing fallback when storage is unavailable or invalid.
- [x] 1.5 Extend `THEME_SWATCHES` and `THEME_COLORS`, with browser colors matching each Nord page background.
- [x] 1.6 Keep Automatic resolving to Beige or the existing Dark theme, and keep explicit Nord selections independent of OS appearance.

### 2. Palettes

- [x] 2.1 Add complete `:root[data-theme="nord-light"]` and `:root[data-theme="nord-dark"]` overrides in `theme.css` for surfaces, text, dot grid, boards, calendars, selection, overlays, controls and scrollbars.
- [x] 2.2 Set `color-scheme: light` and `color-scheme: dark` for the corresponding presets.
- [~] 2.3 Audit uses of the shared accent token. Separate interaction accents from error, destructive, overdue and priority colors wherever one token currently serves both purposes. Default new semantic tokens to existing colors for the original themes.
- [x] 2.4 Apply Nord colors to overlays rendered through portals and native controls. Preserve user-assigned collection and label colors.
- [x] 2.5 Keep additions out of oversized `index.css`; move its existing theme-specific shadow declarations into `theme.css` if required. Do not add card shadows or change layout.
- [x] 2.6 Extend palette snapshots to recognize Nord selectors while preserving original palette declarations. Check text and control contrast against the actual rendered surfaces.

### 3. Selection controls

- [x] 3.1 Add both options to Settings and the header theme switcher using existing optimistic saving and rollback.
- [x] 3.2 Add English labels `Nord Light` and `Nord Dark`, and Brazilian Portuguese labels `Nord claro` and `Nord escuro`, including accessible names and preview titles.
- [x] 3.3 Fit six Settings options and five header options at 390px without horizontal overflow. Keep Automatic in Settings only.
- [x] 3.4 Verify keyboard operation, visible focus and selected-state indicators that do not rely only on color.
- [x] 3.5 Accommodate the settings redesign if it lands first without making it a prerequisite. Keep this change scoped to adding the presets and their presentation.

### 4. Verification and documentation

- [x] 4.1 Follow red-green-refactor for behavioral changes. Cover fixed-theme resolution, Automatic behavior, cache recognition, picker selection, loading and failed-save rollback.
- [x] 4.2 Add real PostgreSQL/Redis integration coverage for saving and fetching each new background and publishing the existing preference update event. Do not use mock-DB tests as the persistence proof.
- [x] 4.3 Extend Playwright coverage for both pickers, reload persistence, second-tab sync, OS appearance changes, switching back to existing themes and resetting the document theme on logout.
- [~] 4.4 Verify Daily, Inbox, Collections, Habits, Settings and portal overlays at desktop and 390px in both Nord themes. Check empty, loading, selected, disabled and error states, plus console errors.
- [x] 4.5 Save desktop and narrow screenshots to `app/dist/screenshots/` and link them in the implementation report.
- [x] 4.6 Run relevant API and frontend tests, integration tests, Playwright tests, lint, typechecks and builds. Report any remaining validation gaps explicitly.
- [x] 4.7 Document Nord's scoped exception to warm neutrals and brick-red interaction accents in `DESIGN.md`, including semantic danger colors. Correct the existing theme stylesheet reference.

## Acceptance

Both Nord presets are selectable, readable, persistent and synchronized. Existing themes and defaults retain their behavior. Interaction colors remain distinct from danger and overdue indicators. Desktop and mobile verification includes screenshots and passing relevant checks, or explicitly recorded validation gaps.

No new dependencies, database columns, routes or MCP tools are required. Keep all implementation progress in this file; do not create a separate `task.md`.
