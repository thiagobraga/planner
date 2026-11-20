# Collection page matches the approved design

## What the user wants

The collection page with the detail panel open should look like the approved Claude design canvas ([mocks](https://claude.ai/artifact/HY12ssBqGWYN4aC1wyQgky), STOP 1 of `2026-11-18-development-home`). The canvas drew the board without the collections tree; the shipped split view keeps the tree, so the board and panel match the canvas and the tree stays on the left.

## Behavior

- **Board fills the pane.** Status columns share the space left of the panel equally and only scroll sideways once a column would drop below 216px. Nothing hides behind the docked panel at desktop width with full width on.
- **Column headers** read `A FAZER 2`: 12px tracked caps, card count in regular weight. The column and card menus appear on hover or keyboard focus; touch screens keep them visible.
- **Cards** use the card tint with a quiet 1px border and 6px radius. Preview rows stay on one line and end in an ellipsis; the full title is in the tooltip and the panel.
- **Embedded tasks** in a description show their own subtasks indented under the block, with an `N of M` mark. Those subtasks no longer repeat under Other subtasks.
- **Only tasks** marks a parent row with `N of M` and a task with no block in the description with "not in description".
- **Panel** follows the mock: 16/24/12 header padding, a quiet Full content / Only tasks toggle, a compact properties grid with a tinted status pill and "More properties" under the values, one 12px step between prose blocks, light uppercase section labels, a ruled Activity section.
- **Phone sheet** keeps the mock's 28px task rows. The checkbox keeps its 44px invisible hit area.
- **Full width:** the "Coleções" heading starts on the same x as the BulletPlanner brand.

## Not changed

The default 720px column stays as it is. With the panel docked, the board there still scrolls sideways; full width is the layout that matches the canvas. The default board layout stays list until a collection picks Columns. The card excerpt is the derived plain-text description, so a heading's text shows ahead of the paragraph.

## Relevant files

- `app/src/pages/collectionsLayout.css`
- `app/src/components/board/{BoardView,BoardColumn,BoardColumnHeader,BoardCardChecklist}.tsx`, `app/src/types/board.ts`
- `app/src/styles/{boards,boardFill,boardCards}.css`
- `app/src/components/detail/{TaskDetailPanel,TaskReferenceView,TaskReferenceContext,DetailTaskRows,DetailProperties,DetailActivity}.tsx`
- `app/src/components/detail/{detailPanel,detailContent,detailEditor,detailSheet}.css`
- `app/src/utils/subtree.ts`, `app/src/types/detail.ts`, `app/src/i18n/locales/details.ts`
- Tests: `app/src/components/board/__tests__/BoardView.test.tsx`, `app/src/components/detail/__tests__/TaskDetailPanel.test.tsx`
