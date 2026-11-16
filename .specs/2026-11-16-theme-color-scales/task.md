# Theme Color Scales Tasks

## 1. Isolated setup
- [x] Read approved plan and inspect existing workspace edits.
- [x] Create `.worktrees/theme-color-scales` on `feat/theme-color-scales`.
- [x] Version approved plan and technical checklist under `.specs/`.
- [ ] Commit and push plan; open draft PR before implementation.
- [ ] Start isolated stack and trusted browser preview.

## 2. Palette foundations
- [ ] Inventory `app/src/styles/theme.css` anchors and semantic roles.
- [ ] Write failing regression tests for five themes, 11 shades, semantic mappings, and contrast.
- [ ] Define neutral, accent, and functional scales with dedicated shared types.
- [ ] Map existing semantic tokens to palette shades, preserving theme identities.

## 3. Apply and document
- [ ] Replace component-specific fixed UI colors with semantic palette tokens; preserve user-assigned colors.
- [ ] Add failing styleguide tests, then render all five palettes with labels, values, and semantic usage without changing saved preferences.
- [ ] Update `DESIGN.md` with mappings and shade selection guidance.

## 4. Verify and deliver
- [ ] Add and run targeted Playwright coverage, including desktop and 390px for all themes.
- [ ] Inspect affected views, text, controls, focus, and state contrast; save screenshots in `app/dist/screenshots/`.
- [ ] Run relevant unit tests, lint, typecheck, and build.
- [ ] Review diff, check touched file sizes, commit and push scoped changes.
- [ ] Update checklist with evidence and mark PR ready for review; keep stack running.
