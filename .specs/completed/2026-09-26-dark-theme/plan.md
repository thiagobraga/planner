# Dark Theme (Night Journal)

## What changes

Planner gets a dark theme that keeps the paper-journal feel: warm coffee-brown paper, cream ink, a faint dot grid and a slightly lighter brick-red accent. It reads like the same journal under a desk lamp.

### Choosing a theme

- **Settings > Appearance > Theme** now offers four options: **Beige**, **White**, **Dark** and **Automatic**. Automatic follows the operating system's light/dark setting and switches live when the OS changes.
- The **header menu** (hamburger, top-right of Daily, Inbox, Collections and Habits) ends with a **Theme** section, right after **Show**. It has one swatch each for Beige, White and Dark, so you can switch without opening Settings. Automatic stays in Settings.
- The choice is saved to your preferences and syncs to your other open sessions.

### Where it applies

- Every logged-in screen, including menus, dropdowns, dialogs, the color picker and the mobile bottom bar.
- Login, register, forgot-password and reset-password stay beige.
- Reloading with Dark selected paints the dark palette immediately, without a flash of beige.
- On an installed PWA, the window title bar turns dark too.

### What stays the same

- Beige and White look exactly as before.
- Collection and label colors are yours and do not change.
- No pure black or pure white: dark surfaces are warm browns and the ink is cream.

## Relevant Files

- `api/src/services/preferencesService.ts` - accepts `dark` and `system` backgrounds
- `app/src/types/theme.ts` - `BackgroundPreference`, `ResolvedTheme`
- `app/src/utils/theme.ts` - `resolveTheme`, theme-color per theme, shared swatch colors
- `app/src/hooks/useResolvedTheme.ts` - follows the OS scheme while `system` is selected
- `app/src/index.css` - `:root`, `[data-theme="white"]`, `[data-theme="dark"]` token blocks
- `app/src/components/AppShell.tsx` - sets `<html data-theme>`, caches the last background
- `app/src/components/ui/ThemeSwitcher.tsx`, `app/src/components/ui/Toolbar.tsx` - header menu Theme section
- `app/src/pages/SettingsPage.tsx` - four-option theme picker
- `app/src/i18n/locales/{en,pt-BR}.ts`, `app/src/i18n/helpContent.ts` - labels and help text
- Modals and overlays (`ConfirmModal`, `QuickAdd`, `SearchOverlay`, `SectionDeleteModal`, `ColumnDeleteModal`, `Toolbar`, `CustomSelect`, `ContextMenu`, `PlannerDragContext`, `CollectionTreeNav`, `FilterBar`) - hardcoded colors replaced by tokens
- `DESIGN.md`, `app/src/pages/StyleguidePage.tsx` - dark palette documented
- `app/e2e/darkTheme.spec.ts` - end-to-end coverage
