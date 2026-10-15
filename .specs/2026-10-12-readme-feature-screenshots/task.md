# Tasks

Legend: `[ ]` not started, `[~]` in progress, `[x]` done.

1. [x] Spec (`plan.md`, this file)
2. [x] Decide screens, viewports, themes, demo data (see `plan.md`)
3. [ ] Demo data
   - [ ] Start the dev stack: `docker compose up -d`
   - [ ] Create a clean account with fictional tasks, habits, collections
4. [ ] Capture
   - [ ] One Playwright script: 3 screens x desktop and mobile x light and dark = 12 PNGs
   - [ ] Save PNGs to `.github/assets/` with names like `daily-list.png`
   - [ ] Compress images (target under 300 KB each)
5. [ ] README
   - [ ] Rewrite Features as blocks: image, title, 1-2 lines
   - [ ] Merge the four offline bullets into one block
   - [ ] Drop the glassmorphic and React Router bullets
   - [ ] Add a "Connect AI agents" block linking to the API section
   - [ ] Use `<picture>` with `prefers-color-scheme` to switch light and dark
6. [ ] Verify
   - [ ] Render the README on GitHub (draft PR preview) in light and dark mode
   - [ ] Check image paths and file sizes
