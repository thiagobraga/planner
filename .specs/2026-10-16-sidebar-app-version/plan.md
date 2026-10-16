# Show Current App Version on Sidebar - Plan

## Goal

Display the current application version (e.g., `v0.6.0`) on the navigation sidebar in both expanded and collapsed states, matching Planner's paper-journal aesthetic, typography, and 24px vertical grid rhythm.

## What

Currently, Planner does not display its release version anywhere in the UI sidebar. While version checking exists for detecting server deployments and updates (`useVersionCheck` and `UpdateToast`), users and administrators cannot see what release version of Planner is running.

This feature adds:
1. A quiet, legible version indicator at the bottom of the sidebar navigation footer (below Logout).
2. Proper support for both expanded sidebar drawer (`w-55`) and collapsed sidebar icon bar (`w-12`).
3. Alignment with the 24px baseline grid (`h-6`) using Lora serif typography and subdued ink color (`text-ink-light opacity-50`).
4. Accessibility and localization support with localized tooltip titles (`Version 0.6.0` / `Versão 0.6.0`).
5. Build-time injection of the app version from `package.json` into the client application via Vite `define`.

## User Flows

### 1. Viewing Version in Expanded Sidebar
- The user opens the app or views the expanded sidebar navigation.
- At the bottom of the sidebar, under the settings, help, and session controls (Logout), the version is displayed quietly as `v0.6.0`.
- Hovering over the version indicator reveals a localized tooltip: `Version 0.6.0` (in English) or `Versão 0.6.0` (in Brazilian Portuguese).
- The text is non-interactive, unselectable (`select-none`), and sits cleanly within the 24px vertical baseline without causing unexpected scrollbars or visual clutter.

### 2. Viewing Version in Collapsed Sidebar
- The user collapses the sidebar into the compact icon-only column (`w-12`).
- The bottom utility section shows the version centered horizontally below the Logout icon button as `v0.6.0` in a compact 10px serif font.
- Hovering over the collapsed version readout reveals the localized tooltip `Version 0.6.0` / `Versão 0.6.0`.

## Design Rules & Token Mapping

- **Typography**: Lora serif (`font-[inherit]`). No sans-serif fonts.
- **Vertical Rhythm**: 24px baseline rhythm (`h-6` flex container) in expanded mode to match `SidebarNavItem` (`h-6`) and baseline grid.
- **Colors**: `text-ink-light` at 50% opacity (`opacity-50`). Does not compete with active navigation items or primary controls.
- **Elevation**: Flat, adhering to paper-journal aesthetic.
- **No Em Dashes**: Follow repository guidelines strictly (simple dashes `-` only).

## Relevant Files

- `app/vite.config.ts` - Injects `__APP_VERSION__` via Vite `define` using `package.json` version.
- `app/src/types/version.ts` (new) - Declares type definition for `__APP_VERSION__`.
- `app/src/utils/version.ts` (new) - Exports `APP_VERSION` constant with fallback.
- `app/src/components/Sidebar.tsx` - Renders version display in expanded and collapsed sidebar layouts.
- `app/src/i18n/locales/en.ts` - English translation key (`nav.version`).
- `app/src/i18n/locales/pt-BR.ts` - Brazilian Portuguese translation key (`nav.version`).
- `app/src/components/__tests__/Sidebar.test.tsx` - Unit tests for expanded and collapsed version display.
- `app/e2e/sidebarVersion.spec.ts` (new) - End-to-end test verifying version presence in UI.
