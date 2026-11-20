import type { ReactNode } from 'react';
import type { Task } from './task';
import type { WeekStart } from './utils';

export interface AuthShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export type TokenType = 'keyword' | 'operator' | 'string' | 'error' | 'text';

export interface Token {
  text: string;
  type: TokenType;
}

export interface FilterBarProps {
  value?: string;
  onChange?: (value: string) => void;
  onApply?: (value: string) => void;
}

export interface QuickAddProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    title: string,
    dueDate?: string,
    recurrenceRule?: object | null,
    type?: 'task' | 'note' | 'event',
  ) => void;
}

export interface SearchResult {
  type: 'task' | 'collection' | 'label';
  id: string;
  title: string;
  subtitle?: string;
}

export interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  tasks?: Task[];
  collections?: Array<{ id: string; name: string }>;
  labels?: Array<{ id: string; name: string }>;
  onSelectTask?: (id: string) => void;
}

export interface MonthlyCalendarSpecimenProps {
  compact?: boolean;
  weekStart: WeekStart;
}

export type MonthTile = {
  year: number;
  month: number;
  offset: number;
};

export interface MonthSelectorProps {
  year: number;
  month: number; // 0-based
  onChange: (year: number, month: number) => void;
  className?: string;
}

export interface MonthSelectorHandle {
  animateTo: (year: number, month: number) => void;
}

export interface MonthlyViewProps {
  tasks: Task[];
  onToggle: (id: string) => void;
  onTaskContextMenu?: (id: string, position: { x: number; y: number }) => void;
  /** Month shown (0-based). Pass with `onMonthChange` when the page owns navigation, e.g. to fetch that month. */
  visibleMonth?: { year: number; month: number };
  onMonthChange?: (year: number, month: number) => void;
  /** The page toolbar already navigates months. */
  hideSelector?: boolean;
}

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: string;
  /** A `<Toolbar>` element - PageHeader renders it as-is; Toolbar owns its own layout classes. */
  toolbar?: ReactNode;
  /** A `<PageToolbar>` kept on the title's own row, right-aligned; the title truncates first. */
  actions?: ReactNode;
  /** Extra content in `.page-header-copy-text`, after the title/subtitle (e.g. CollectionsPage's inline sub-collection input). */
  afterTitle?: ReactNode;
  /** Extra classes on the `<h1>` (e.g. CollectionsPage's breadcrumb-trail layout). */
  titleClassName?: string;
  /** Accessible name for `<h1>` when `title` contains interactive controls like color dots. */
  titleAriaLabel?: string;
  /** Extra classes on the outer `<header>`. */
  className?: string;
}
