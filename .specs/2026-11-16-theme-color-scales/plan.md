# Theme Color Scales

## Summary

Create Planner-specific color scales using the [Tailwind 50-950 convention](https://tailwindcss.com/docs/colors), while preserving each theme’s visual identity. Show every theme’s palette together in the styleguide.

## Changes

- Create a dedicated worktree and feature branch, then open a draft PR before implementation.
- Define 11-step shade scales around Planner’s existing neutral, accent, and functional colors. Keep semantic tokens for text, surfaces, borders, and states, and map them to appropriate shades for each theme.
- Apply the scales across app elements, including component-specific colors, while preserving readable contrast and user-assigned collection and label colors.
- Replace the styleguide’s hard-coded light/dark list with palette grids for White, Beige, Dark, Nord Light, and Nord Dark. Show shade labels, values, and semantic token usage without changing the saved theme.
- Update `DESIGN.md` with the palette structure, theme mappings, and guidance for choosing shades. Save the user-facing spec and technical checklist under `.specs/`.

## Verification

- Add regression tests for palette definitions, semantic mappings, and styleguide coverage.
- Run relevant unit and end-to-end tests, lint, typecheck, and build.
- Inspect affected views and the styleguide in all themes at desktop and 390px widths; capture screenshots and check text, controls, focus, and state contrast.

## Assumptions

- Existing theme colors are the anchors for the new scales; visual changes should remain consistent with each theme.
- White is included because it is an existing theme, alongside the four named in the request.

## Relevant Files

- `app/src/styles/theme.css`: theme scales and semantic token mappings.
- `app/src/styles/palettes.css`: numbered shade definitions.
- `app/src/pages/StyleguidePage.tsx`: palette section integration.
- `app/src/components/styleguide/ThemePalettes.tsx`: all-theme palette grids.
- `app/src/types/theme.ts`: shared palette types.
- `app/src/utils/themePalettes.ts`: palette metadata and semantic usage.
- `app/src/components/`, `app/src/styles/`, `app/src/index.css`: component color consumers.
- `app/src/pages/__tests__/StyleguidePage.test.tsx`: styleguide regression coverage.
- `app/e2e/themePalettes.spec.ts`: browser coverage and responsive theme checks.
- `DESIGN.md`: palette structure and shade selection guidance.
- `.docker/site/Dockerfile`: include the shared palette stylesheet in site image stages.
- `.specs/2026-11-16-theme-color-scales/plan.md`: approved scope, technical checklist, and verification status.

## Technical Checklist

### 1. Isolated setup
- [x] Read approved plan and inspect existing workspace edits.
- [x] Create `.worktrees/theme-color-scales` on `feat/theme-color-scales`.
- [x] Version approved plan and technical checklist under `.specs/`.
- [x] Commit and push plan; opened draft PR #433 before implementation.
- [x] Start isolated stack and trusted browser preview. Dependencies use dedicated /tmp bind mounts because /p is full.

### 2. Palette foundations
- [x] Inventory `app/src/styles/theme.css` anchors and semantic roles.
- [x] Write failing regression tests for five themes, 11 shades, semantic mappings, and contrast.
- [x] Define neutral, accent, and functional scales with dedicated shared types.
- [x] Map existing semantic tokens to palette shades, preserving theme identities.

### 3. Apply and document
- [x] Replace component-specific fixed UI colors with semantic palette tokens; preserve user-assigned colors.
- [x] Add failing styleguide tests, then render all five palettes with labels, values, and semantic usage without changing saved preferences.
- [x] Update `DESIGN.md` with mappings and shade selection guidance.

### 4. Verify and deliver
- [x] Add and run targeted Playwright coverage, including desktop and 390px for all themes.
- [x] Inspect affected views, text, controls, focus, and state contrast; save screenshots in `app/dist/screenshots/`.
- [x] Run relevant unit tests, lint, typecheck, and build.
- [ ] Review diff, check touched file sizes, commit and push scoped changes.
- [ ] Update checklist with evidence and mark PR ready for review; keep stack running.

## Verification Evidence

- Unit suite: 177 files, 1,543 tests passed. Existing Daily/Collections async act warnings remain.
- Browser verification: palette matrix covers all five themes at 1440px and 390px, saved-theme preservation, runtime text/control/focus contrast, keyboard focus, quick-add controls, reload persistence, and console errors.
- Existing Dark/Nord browser suites exercise portal colors, synchronization, automatic mode, failed-save recovery, and logout. All 13 relevant cases passed across the final matrix run and the updated Dark overlay rerun.
- Screenshots: `app/dist/screenshots/palettes-<theme>-<width>.png` and `palette-controls-<theme>-<width>.png`.
- Intentional shade consolidation: Dark overlays now use neutral-900 (`#292219`), documented in `DESIGN.md`; page, accent, and dot anchors stay preserved. Secondary/state text uses stronger shades for readable contrast.
- No backend/schema changes. Browser tests use real API sessions and preferences against isolated PostgreSQL/Redis. Styleguide browser tests require dedicated test-admin environment variables and were executed locally.
- Mechanical design audit: no findings in new palette styles/components. Existing alternative selectable fonts remain unchanged.
- Local setup: ignored Compose override pins fresh PostgreSQL 16 and mounts worktree-only dependencies from `/tmp/planner-theme-color-scales/` because `/p` ran out of disk space. Preview: `https://theme-color-scales.planner.local`.

- Final app lint passed with 40 existing warnings; TypeScript and production build passed. The shared marketing Docker context now includes the imported palette stylesheet; site image verification is in progress.
