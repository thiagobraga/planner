# Collections Context Menu Max-Height, Scrollbar & Add Collection Button Grid Alignment - Tasks

## 1. Setup & Environment

- [ ] 1.1 Verify git workspace status and branch readiness (`feat/collections-context-menu-scroll`)
- [ ] 1.2 Confirm test suite runs cleanly before modifications

## 2. Collections Header Button Grid Alignment (TDD)

- [ ] 2.1 In `app/src/pages/CollectionsIndexPage.tsx`:
  - Set header flex container to explicit height `h-6` (24px)
  - Resize Add Collection button to `w-6 h-6 flex items-center justify-center rounded-full`
  - Update Plus icon to `size={16} strokeWidth={1.5}`
- [ ] 2.2 Add unit test in `app/src/pages/__tests__/CollectionsIndexPage.test.tsx`:
  - Verify header row has class `h-6`
  - Verify Add Collection button has class `w-6` and `h-6`

## 3. ContextMenu Component Refactor (TDD)

- [ ] 3.1 Update `ContextMenu.tsx` types:
  - Add optional `maxHeight?: number | string` to `ContextMenuProps` and `ContextMenuItem` (e.g. `submenuMaxHeight?: number | string` or `maxHeight?: number | string`)
  - Set default max-height on `MenuPanel` (`max-h-72` / `288px` or `min(288px, calc(100vh - 32px))`)
- [ ] 3.2 Restructure `MenuPanel` layout:
  - Keep `.ui-context-menu-panel` as the outer bordered, positioned container
  - Place `.ui-context-menu-caret` outside the scrolling area so it is never clipped
  - Wrap items in an inner scroll container (`.ui-context-menu-items`) with `overflow-y-auto` and `maxHeight`
- [ ] 3.3 Implement hover and blur scrollbar visibility:
  - Track hover state (`onMouseEnter` / `onMouseLeave`) on the menu panel
  - Track focus/blur state (`onBlur` checking `relatedTarget`, plus window `blur` listener)
  - Derive `showScrollbar = isHovered && isFocused` and expose via `data-show-scrollbar="true"|"false"`
- [ ] 3.4 Keyboard scroll-into-view:
  - On `highlightedIndex` change, ensure the active item calls `.scrollIntoView({ block: 'nearest' })`
- [ ] 3.5 Dynamic submenu positioning on parent scroll:
  - Recompute submenu position if parent menu scrolls

## 4. Styling & Scrollbar Rules

- [ ] 4.1 In `app/src/index.css`:
  - Define quiet scrollbar styles for `.ui-context-menu-items`:
    - Default: `scrollbar-color: transparent transparent`, `::-webkit-scrollbar-thumb { background-color: transparent }`
    - When `data-show-scrollbar="true"`: `scrollbar-color: var(--planner-scrollbar-thumb) transparent`, `::-webkit-scrollbar-thumb { background-color: var(--planner-scrollbar-thumb) }`
    - Hover on thumb: `background-color: var(--planner-scrollbar-thumb-hover)`
    - Smooth opacity/color transition

## 5. Collection Context Menu Call Sites

- [ ] 5.1 Verify collection submenu configuration in `InboxPage.tsx`, `DailyPage.tsx`, and `CollectionsPage.tsx`
- [ ] 5.2 Ensure collection action context menus (`buildCollectionMenuItems`) in `CollectionsIndexPage.tsx`, `CollectionsPage.tsx`, and `CollectionTreeNav.tsx` behave correctly

## 6. Testing

- [ ] 6.1 Write unit tests in `app/src/components/__tests__/ContextMenu.scroll.test.tsx`:
  - Renders inner scroll container with max-height when items overflow
  - Toggles `data-show-scrollbar` on mouse enter and mouse leave
  - Resets `data-show-scrollbar` to false on panel blur and window blur
  - Scrolls highlighted item into view on arrow navigation
- [ ] 6.2 Verify existing context menu and collections index tests (`primitives.test.tsx`, `ContextMenu.panel.test.tsx`, `ContextMenu.icons.test.tsx`, `CollectionsIndexPage.test.tsx`) pass

## 7. Verification

- [ ] 7.1 Run full app test suite (`npm test`)
- [ ] 7.2 Run app build (`npm run build`)
- [ ] 7.3 Run lint check (`npm run lint`)
