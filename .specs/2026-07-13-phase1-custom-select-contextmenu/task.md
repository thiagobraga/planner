# Phase 1 - Tasks

## Custom Select Component

- [ ] Create `app/src/hooks/useFloatingPosition.ts` - shared viewport-aware positioning hook
  - [ ] Measure floating element dimensions after mount
  - [ ] Flip above/below when insufficient space
  - [ ] Shift horizontally when overflowing viewport edges
  - [ ] Minimum 8px padding from all viewport edges
  - [ ] Support both anchor-based (select) and coordinate-based (context menu) positioning

- [ ] Create `app/src/components/ui/CustomSelect.tsx`
  - [ ] Build trigger element (40px tall, same shell as Input: 1px border, 8px radius, Cream bg)
  - [ ] Add trailing ChevronDown icon (from lucide-react)
  - [ ] Display selected option label or placeholder text
  - [ ] Implement dropdown panel (Cream bg, 1px border, 8px radius, `shadow-medium`)
  - [ ] Set max-height 240px with scroll for many options
  - [ ] Style each option: 32px tall, padding `0 12px`, Lora 14px
  - [ ] Hover state: `rgba(212,207,199,0.4)` background
  - [ ] Selected state: `rgba(212,207,199,0.6)` background
  - [ ] Disabled option: `opacity-40`, `cursor: not-allowed`
  - [ ] Error state: border-accent on trigger, brick-red error text below
  - [ ] Focus state: border-ink (same as Input)
  - [ ] Use `useFloatingPosition` for viewport-aware positioning
  - [ ] Implement click-outside to close (mousedown listener on document)
  - [ ] Implement Escape to close
  - [ ] Implement keyboard navigation:
    - [ ] Enter / Space to toggle open/close
    - [ ] ArrowDown / ArrowUp to navigate options
    - [ ] Enter to select highlighted
    - [ ] Home / End to jump first/last
    - [ ] Type-ahead character matching
  - [ ] Add ARIA attributes:
    - [ ] `role="combobox"`, `aria-expanded`, `aria-haspopup="listbox"` on trigger
    - [ ] `role="listbox"` on dropdown, `role="option"` on items
    - [ ] `aria-selected`, `aria-disabled`, `aria-activedescendant`
    - [ ] `aria-labelledby` for label linkage
  - [ ] Render dropdown via React Portal into `document.body`

## Context Menu Component

- [ ] Create `app/src/components/ui/ContextMenu.tsx`
  - [ ] Build menu panel (Cream bg, 1px border, 8px radius, `shadow-medium`, min-width 180px)
  - [ ] Render via React Portal into `document.body`
  - [ ] Style items: 32px tall, padding `0 12px`, Lora 14px, Ink text
  - [ ] Hover state: `rgba(212,207,199,0.4)` background
  - [ ] Destructive items: text-accent (Warm Brick Red), hover `rgba(201,72,59,0.08)` bg
  - [ ] Disabled items: `opacity-40`, `cursor: not-allowed`, no hover, no click
  - [ ] Separators: 1px height, border color, margin `4px 12px`
  - [ ] Submenu support: ChevronRight icon on right, opens to right of parent item
  - [ ] If submenu overflows right edge, open to the left
  - [ ] Use `useFloatingPosition` for viewport clamping
  - [ ] Click-outside to close (mousedown listener)
  - [ ] Escape to close
  - [ ] Selecting an item closes the menu
  - [ ] Keyboard navigation:
    - [ ] ArrowDown / ArrowUp to navigate (skip separators, skip disabled)
    - [ ] Enter to activate item
    - [ ] ArrowRight to open submenu
    - [ ] ArrowLeft to close submenu
    - [ ] Auto-focus first non-disabled item on open
  - [ ] ARIA attributes:
    - [ ] `role="menu"` on container
    - [ ] `role="menuitem"` on items, `aria-disabled`
    - [ ] `role="separator"` on separators

## Styleguide Integration

- [ ] Modify `app/src/pages/StyleguidePage.tsx`
  - [ ] Import CustomSelect and ContextMenu
  - [ ] Add Card 12 - Custom Select specimens:
    - [ ] Closed state with placeholder
    - [ ] Open state (interactive)
    - [ ] Option selected
    - [ ] Disabled state
    - [ ] Error state with error text
    - [ ] Many options with scroll (15+ items)
  - [ ] Add Card 13 - Context Menu specimens:
    - [ ] Standard menu with common items
    - [ ] Menu with separators
    - [ ] Menu with disabled item
    - [ ] Menu with destructive item
    - [ ] Menu with submenu (project selector)
    - [ ] Interactive demo area (right-click to open)

## Verification

- [ ] `cd app && npx tsc --noEmit` - TypeScript compiles
- [ ] `pnpm lint` - no lint errors
- [ ] `pnpm -F app test` - existing tests pass
- [ ] Manual: visit `/styleguide`, verify new sections render and are interactive
- [ ] Test keyboard-only navigation through both components
- [ ] Test at 150% zoom / narrow viewport: menus reposition correctly
