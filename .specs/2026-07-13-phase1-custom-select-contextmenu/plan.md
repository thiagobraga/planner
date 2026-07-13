# Phase 1 — Custom Select, Context Menu & Styleguide

**Status:** Ready for implementation  
**Dependencies:** None — this is the foundation phase  
**Estimated scope:** 4 new files, 2 modified files

## Context

The Planner currently uses a styled native `<select>` (`app/src/components/ui/Select.tsx`) which wraps a browser `<select>` with a chevron icon. This phase creates two new reusable components:

1. **CustomSelect** — a fully custom dropdown select (not native `<select>`) with keyboard nav, ARIA, viewport-aware positioning, and the Planner's paper-journal aesthetic.
2. **ContextMenu** — a right-click context menu sharing the same visual language and positioning logic.

Both components are then showcased in the Styleguide page.

## Design Constraints (from DESIGN.md)

- Font: Lora serif only — used on every text element including menu items
- Palette: Cream Paper `#f5f0e8` background, Ink `#44443d` text, Dot Grey `#d8d3cb` for hover/selection tints
- Elevation: menus/popovers use Medium shadow (`0 4px 12px rgba(68,68,61,0.10)`) + 1px Border
- Border: `#e5e1d8`, radius `rounded-md` (8px)
- Destructive items: Warm Brick Red `#c9483b` text
- Disabled: `opacity-40`, `cursor: not-allowed`
- Motion: 150ms ease-out for open/close
- No glassmorphism, no hard shadows, no blue, no sans-serif

## Proposed Changes

### Component: CustomSelect

#### [NEW] `app/src/components/ui/CustomSelect.tsx`

A headless-pattern custom select with:

**Props:**
```typescript
interface CustomSelectProps {
  label?: string;
  placeholder?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  errorText?: string;
  className?: string;
  id?: string;
}
```

**Implementation details:**
- Trigger: 40px tall, same shell as existing Input (1px Border, 8px radius, Cream bg, Lora 14px)
- Trailing chevron (ChevronDown from lucide-react, already used by existing Select)
- Dropdown panel: Cream Paper bg, 1px Border, 8px radius, `shadow-medium`, max-height 240px with scroll
- Each option: 32px tall, padding `0 12px`, hover bg `rgba(212,207,199,0.4)` (same as task-item hover)
- Selected option: bg `rgba(212,207,199,0.6)` (same as task-item--selected)
- Disabled option: `opacity-40`, `cursor: not-allowed`, no hover
- Error state: border-accent on trigger, brick-red help text below
- Focus state: border-ink on trigger (same as Input focus)

**Positioning logic:**
- Default: opens below the trigger, left-aligned
- If insufficient space below, open above
- If insufficient space right, align right edge to trigger right edge
- Use `useLayoutEffect` to measure after mount

**Keyboard navigation:**
- `Enter` / `Space` to open/close
- `ArrowDown` / `ArrowUp` to navigate options
- `Enter` to select highlighted option
- `Escape` to close without selecting
- `Home` / `End` to jump to first/last option
- Type-ahead: typing characters focuses matching option

**ARIA attributes:**
- Trigger: `role="combobox"`, `aria-expanded`, `aria-haspopup="listbox"`, `aria-activedescendant`
- Listbox: `role="listbox"`, each option `role="option"`, `aria-selected`, `aria-disabled`
- Label linked via `aria-labelledby`

**Click-outside handling:**
- `useEffect` with `mousedown` listener on document
- Close dropdown when clicking outside the component

---

### Component: ContextMenu

#### [NEW] `app/src/components/ui/ContextMenu.tsx`

**Props:**
```typescript
interface ContextMenuItem {
  type: 'item' | 'separator';
  label?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  onClick?: () => void;
  submenu?: ContextMenuItem[];
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}
```

**Implementation details:**
- Rendered via React Portal into `document.body`
- Panel: Cream Paper bg, 1px Border, 8px radius, `shadow-medium`, min-width 180px
- Each item: 32px tall, padding `0 12px`, Lora 14px, Ink text
- Hover: bg `rgba(212,207,199,0.4)`
- Destructive item: text `text-accent` (Warm Brick Red), hover bg `rgba(201,72,59,0.08)`
- Disabled item: `opacity-40`, `cursor: not-allowed`, no hover, no onClick
- Separator: 1px height, bg border color, margin `4px 12px`
- Submenu: indicated by ChevronRight icon on right side; opens to the right of parent item
- If submenu would overflow right edge of viewport, open to the left instead

**Positioning logic:**
- Position at `{x, y}` coordinates (from `contextmenu` event)
- If menu would overflow right edge: shift left so right edge = viewport right - 8px
- If menu would overflow bottom: shift up so bottom edge = viewport bottom - 8px
- Min 8px padding from all viewport edges

**Keyboard navigation:**
- `ArrowDown` / `ArrowUp` to navigate items (skip separators and disabled)
- `Enter` to activate item
- `Escape` to close
- `ArrowRight` to open submenu
- `ArrowLeft` to close submenu and return to parent
- Auto-focus first non-disabled item on open

**ARIA:**
- Container: `role="menu"`
- Items: `role="menuitem"`, `aria-disabled`
- Separator: `role="separator"`

**Click-outside:** Close on any mousedown outside the menu tree.

---

### Shared Hook

#### [NEW] `app/src/hooks/useFloatingPosition.ts`

Shared positioning logic for both CustomSelect and ContextMenu:

```typescript
function useFloatingPosition(
  triggerRef: RefObject<HTMLElement> | null,
  floatingRef: RefObject<HTMLElement>,
  options: {
    position?: { x: number; y: number }; // for context menu
    placement?: 'below' | 'above'; // for select
    align?: 'start' | 'end';
    padding?: number; // min distance from viewport edge
  }
): { top: number; left: number; placement: string }
```

---

### Styleguide Integration

#### [MODIFY] `app/src/pages/StyleguidePage.tsx`

Add two new Card sections after the existing cards (Card 12 and 13):

**Card 12 — Custom Select:**
- Closed state with placeholder
- Open state showing options
- Option selected (showing selected label in trigger)
- Disabled state
- Error state with error text
- Many options with scroll (15+ items to trigger scrollbar)
- Interactive: user can actually interact with them

**Card 13 — Context Menu:**
- Static specimens showing different configurations:
  - Standard menu with common items
  - Menu with separators
  - Menu with disabled item
  - Menu with destructive item
  - Menu with submenu (Project selector)
- Interactive demo: a designated area where right-clicking opens a live context menu

---

## Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `app/src/components/ui/CustomSelect.tsx` | NEW | Custom select component |
| `app/src/components/ui/ContextMenu.tsx` | NEW | Context menu component |
| `app/src/hooks/useFloatingPosition.ts` | NEW | Shared viewport-aware positioning hook |
| `app/src/pages/StyleguidePage.tsx` | MODIFY | Add cards 12–13 for new components |

## Reused Components & Patterns

- `ChevronDown` / `ChevronRight` from `lucide-react` (already a dependency)
- Existing CSS tokens from `index.css` (colors, shadows, radius, motion)
- Existing Card wrapper from StyleguidePage
- Portal pattern similar to existing `SearchOverlay.tsx` and `ConfirmModal.tsx`

## Risks & Considerations

- The existing `Select.tsx` (native select) should NOT be removed — it's used in StyleguidePage and SettingsPage. The new `CustomSelect` is a separate component.
- Submenu positioning needs careful handling for deeply nested submenus near viewport edges.
- Touch device support: context menu won't fire on long-press by default; that's acceptable for V1 (desktop-first).

## Verification

1. `cd app && npx tsc --noEmit` — TypeScript must compile
2. `pnpm lint` — no lint errors
3. `pnpm -F app test` — existing tests pass
4. Manual: visit `/styleguide`, verify new sections render and are interactive
5. Keyboard-only navigation through both components
6. Browser zoom at 150% / narrow viewport: menus reposition correctly
