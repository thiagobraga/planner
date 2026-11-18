import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';

export interface ContextMenuItem {
  type: 'item' | 'separator' | 'header';
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
  /** Hangs the root panel from position.x leftward when 'end'; defaults to 'start'. */
  align?: 'start' | 'end';
}

export interface ContextMenuRootProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
  caret: boolean;
  align: 'start' | 'end';
}

export interface MenuPanelProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  level: number;
  activePath: number[];
  setActivePath: Dispatch<SetStateAction<number[]>>;
  onClose: () => void;
  isRoot?: boolean;
  caret?: boolean;
  align?: 'start' | 'end';
}

export interface SubMenuWrapperProps {
  parentItem: ContextMenuItem;
  parentRef: RefObject<HTMLDivElement | null>;
  itemIndex: number;
  level: number;
  activePath: number[];
  setActivePath: Dispatch<SetStateAction<number[]>>;
  onClose: () => void;
}

export interface InlinePanelProps {
  position: { x: number; y: number };
  children: ReactNode;
}
