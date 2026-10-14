# Tasks

Legend: `[ ]` not started, `[~]` in progress, `[x]` done.

1. [x] Spec (`plan.md`, this file)
2. [x] Decide screens, viewports, themes, demo data (see `plan.md`)
3. [x] Demo data
   - [x] Dev stack already running (`docker compose up -d`)
   - [x] `scripts/readme-screenshots.ts` registers a throwaway account and seeds fictional collections, tasks, habit groups and 12 weeks of completions through the API
4. [x] Capture
   - [x] Same script: 3 screens x desktop and mobile x light and dark = 12 PNGs (`node scripts/readme-screenshots.ts`)
   - [x] Saved to `.github/assets/` as `<screen>-<viewport>-<theme>.png`
   - [x] Sizes are 44-146 KB, so no extra compression was needed
5. [x] README
   - [x] Features rewritten as blocks: title, 1-2 lines, desktop and mobile side by side
   - [x] Four offline bullets merged into one block
   - [x] Glassmorphic and React Router bullets dropped
   - [x] "Connect AI agents" block links to the MCP Server section
   - [x] `<picture>` with `prefers-color-scheme` switches light and dark
6. [ ] Verify
   - [x] Image paths in README all resolve; file sizes checked
   - [ ] Render the README on GitHub (draft PR preview) in light and dark mode
