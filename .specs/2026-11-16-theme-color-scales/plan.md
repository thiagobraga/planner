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
- `.specs/2026-11-16-theme-color-scales/task.md`: implementation and verification status.
