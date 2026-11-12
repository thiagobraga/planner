import type { ReactNode } from 'react';

export interface ContextMenuItem {
  type: 'item' | 'separator';
  label?: ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  checked?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  onClick?: () => void;
  submenu?: ContextMenuItem[];
  /** Free-form content shown beside the item, like a submenu; `close` dismisses the whole menu. */
  panel?: (close: () => void) => ReactNode;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
  /** Draws the pointer toward the click origin; defaults to true. */
  caret?: boolean;
}
