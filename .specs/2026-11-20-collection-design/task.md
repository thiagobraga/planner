# Tasks

1. [x] Render the canvas boards to PNG and seed the same data into a worktree stack for side-by-side screenshots.
2. [x] Layout
   - [x] `scrollbar-gutter: auto` on the collections main column (it never scrolls), so the tree heading lines up with the brand.
   - [x] `.board-grid--fill`: `repeat(var(--board-columns), minmax(216px, 1fr))`, count set by `BoardView`.
3. [x] Board chrome (`styles/boardFill.css`, split out to keep `boards.css` under 419 lines)
   - [x] Header count as a sibling of the `h2`, so the heading name stays the column title.
   - [x] 12px gap between header and cards; hover/focus reveal for column and card menus (`@media (hover: hover)`).
4. [x] Cards: `--planner-card-bg`, border-subtle at 50%, 6px radius; `.board-card-checklist-title` ellipsis.
5. [x] Panel nesting (test first)
   - [x] `subtreeWithout()` and `embeddedCoverage()` in `utils/subtree.ts`.
   - [x] `TaskReferenceView` renders the subtree minus other embedded branches; `embedded` added to the reference context.
   - [x] Other subtasks excludes covered ids; `DetailTaskRows` shows `N of M` and "not in description".
6. [x] Panel CSS per mock, phone sheet chips and 28px rows.
7. [x] Verify: app tests (190 files, 1653 tests), lint (warnings only, none new), build, screenshots at 1440 and 390 in `app/dist/screenshots/`.
