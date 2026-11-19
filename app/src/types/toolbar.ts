import type { ReactNode } from 'react';
import type { ViewLayout, ViewRange, ViewStyle } from './view';

export interface MenuButtonProps {
  label: ReactNode;
  /** Accessible name when the label alone is not descriptive. */
  ariaLabel?: string;
  /** Hangs the panel from the trigger's right edge. Defaults to 'end'. */
  align?: 'start' | 'end';
  /** Opens as a bottom sheet (mobile bar) instead of a dropdown. */
  sheet?: boolean;
  className?: string;
  /** Panel content; `close` dismisses the menu. */
  children: (close: () => void) => ReactNode;
}

export interface MenuItemProps {
  label: ReactNode;
  icon?: ReactNode;
  /** Keys shown on the right, e.g. "v l". */
  shortcut?: string | null;
  checked?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface ViewMenuProps {
  layouts: readonly ViewLayout[];
  layout: ViewLayout;
  onLayoutChange: (layout: ViewLayout) => void;
  style: ViewStyle;
  onStyleChange: (style: ViewStyle) => void;
  /** Omit on pages without dates (Collections, Inbox). */
  range?: ViewRange;
  onRangeChange?: (range: ViewRange) => void;
  /** Extra items at the end, such as Reorganize. */
  extra?: (close: () => void) => ReactNode;
  sheet?: boolean;
}

export interface GroupByOption<T extends string> {
  value: T;
  label: string;
  icon: ReactNode;
}

export interface GroupByMenuProps<T extends string> {
  value: T;
  options: readonly GroupByOption<T>[];
  onChange: (value: T) => void;
  sheet?: boolean;
}

export interface DateNavProps {
  from: string;
  to: string;
  today: string;
  weekStart: 'sunday' | 'monday';
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Moves the anchor to the picked day. */
  onPick: (iso: string) => void;
  /** Short label (13-15/11). */
  compact?: boolean;
  /** Today lives inside the date picker instead of its own button. */
  hideToday?: boolean;
  defaultOpen?: boolean;
  /** Opens the calendar above the control (phone bar sits at the bottom). */
  openUp?: boolean;
}

/** How tight the title row is: 0 roomy, 1 compact date, 2 no Today button. */
export type ToolbarDensity = 0 | 1 | 2;

export interface PageToolbarProps {
  /** Date navigation or the group-by menu. Receives the current density. */
  nav?: (density: ToolbarDensity, mobile: boolean) => ReactNode;
  /** The View menu, as a bottom sheet on phones. */
  view: (options: { sheet: boolean }) => ReactNode;
}
