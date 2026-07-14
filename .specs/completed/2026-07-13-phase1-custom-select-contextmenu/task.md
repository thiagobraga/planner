# Phase 1 - Tasks

## Custom Select Component

- [x] Create `app/src/hooks/useFloatingPosition.ts` - shared viewport-aware positioning hook
  - [x] Measure floating element dimensions after mount
  - [x] Flip above/below when insufficient space
  - [x] Shift horizontally when overflowing viewport edges
  - [x] Minimum 8px padding from all viewport edges
  - [x] Support both anchor-based (select) and coordinate-based (context menu) positioning

- [x] Create `app/src/components/ui/CustomSelect.tsx`
  - [x] Build trigger element (40px tall, same shell as Input: 1px border, 8px radius, Cream bg)
  - [x] Add trailing ChevronDown icon (from lucide-react)
  - [x] Display selected option label or placeholder text
  - [x] Implement dropdown panel (Cream bg, 1px border, 8px radius, `shadow-medium`)
  - [x] Set max-height 240px with scroll for many options
  - [x] Style each option: 32px tall, padding `0 12px`, Lora 14px
  - [x] Hover state: `rgba(212,207,199,0.4)` background
  - [x] Selected state: `rgba(212,207,199,0.6)` background
  - [x] Disabled option: `opacity-40`, `cursor: not-allowed`
  - [x] Error state: border-accent on trigger, brick-red error text below
  - [x] Focus state: border-ink (same as Input)
  - [x] Use `useFloatingPosition` for viewport-aware positioning
  - [x] Implement click-outside to close (mousedown listener on document)
  - [x] Implement Escape to close
  - [x] Implement keyboard navigation:
    - [x] Enter / Space to toggle open/close
    - [x] ArrowDown / ArrowUp to navigate options
    - [x] Enter to select highlighted
    - [x] Home / End to jump first/last
    - [x] Type-ahead character matching
  - [x] Add ARIA attributes:
    - [x] `role="combobox"`, `aria-expanded`, `aria-haspopup="listbox"` on trigger
    - [x] `role="listbox"` on dropdown, `role="option"` on items
    - [x] `aria-selected`, `aria-disabled`, `aria-activedescendant`
    - [x] `aria-labelledby` for label linkage
  - [x] Render dropdown via React Portal into `document.body`

## Context Menu Component

- [x] Create `app/src/components/ui/ContextMenu.tsx`
  - [x] Build menu panel (Cream bg, 1px border, 8px radius, `shadow-medium`, min-width 180px)
  - [x] Render via React Portal into `document.body`
  - [x] Style items: 32px tall, padding `0 12px`, Lora 14px, Ink text
  - [x] Hover state: `rgba(212,207,199,0.4)` background
  - [x] Destructive items: text-accent (Warm Brick Red), hover `rgba(201,72,59,0.08)` bg
  - [x] Disabled items: `opacity-40`, `cursor: not-allowed`, no hover, no click
  - [x] Separators: 1px height, border color, margin `4px 12px`
  - [x] Submenu support: ChevronRight icon on right, opens to right of parent item
  - [x] If submenu overflows right edge, open to the left
  - [x] Use `useFloatingPosition` for viewport clamping
  - [x] Click-outside to close (mousedown listener)
  - [x] Escape to close
  - [x] Selecting an item closes the menu
  - [x] Keyboard navigation:
    - [x] ArrowDown / ArrowUp to navigate (skip separators, skip disabled)
    - [x] Enter to activate item
    - [x] ArrowRight to open submenu
    - [x] ArrowLeft to close submenu
    - [x] Auto-focus first non-disabled item on open
  - [x] ARIA attributes:
    - [x] `role="menu"` on container
    - [x] `role="menuitem"` on items, `aria-disabled`
    - [x] `role="separator"` on separators

## Styleguide Integration

- [x] Modify `app/src/pages/StyleguidePage.tsx`
  - [x] Import CustomSelect and ContextMenu
  - [x] Add Card 12 - Custom Select specimens:
    - [x] Closed state with placeholder
    - [x] Open state (interactive)
    - [x] Option selected
    - [x] Disabled state
    - [x] Error state with error text
    - [x] Many options with scroll (15+ items)
  - [x] Add Card 13 - Context Menu specimens:
    - [x] Standard menu with common items
    - [x] Menu with separators
    - [x] Menu with disabled item
    - [x] Menu with destructive item
    - [x] Menu with submenu (project selector)
    - [x] Interactive demo area (right-click to open)

## Verification

- [x] `cd app && npx tsc --noEmit` - TypeScript compiles
- [x] `pnpm lint` - no lint errors
- [x] `pnpm -F app test` - existing tests pass
- [x] Manual: visit `/styleguide`, verify new sections render and are interactive
- [x] Test keyboard-only navigation through both components
- [x] Test at 150% zoom / narrow viewport: menus reposition correctly
