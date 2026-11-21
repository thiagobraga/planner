import type { WeekStart } from './utils';
import type { ApiHabit, ApiHabitGroup } from './api';

export type DayState = 'empty' | 'half' | 'full';

export interface HabitNode {
  id: string;
  name: string;
  parentId: string | null;
  groupId: string | null;
  orderValue: number;
  createdAt?: string;
  completions: Set<string>;
  children: HabitNode[];
}

export interface HabitGroupSection {
  group: ApiHabitGroup;
  habits: HabitNode[];
}

export interface HabitSections {
  ungrouped: HabitNode[];
  groups: HabitGroupSection[];
}

/** A habit hierarchy is one level deep, so depth is only ever root or child. */
export type HabitDepth = 0 | 1;

export interface HabitRow {
  id: string;
  name: string;
  /** Null for a root habit. */
  parentId: string | null;
  /** For a root, the group it sits in. A child inherits its parent's, so null. */
  groupId: string | null;
  depth: HabitDepth;
  /** The section this row renders in - a group id, or UNGROUPED_CONTAINER. */
  containerId: string;
  /** Sub-habits carried along by this root. Non-empty means it cannot become one. */
  childIds: string[];
}

export interface HabitProjection {
  /** The parent the habit would take; null when it lands as a root. */
  parentId: string | null;
  /** The group it would belong to; always null when it lands as a sub-habit. */
  groupId: string | null;
  depth: HabitDepth;
  /** Zero-based index among its new siblings - not the flat render index. */
  position: number;
}

export interface UseHabitDragOptions {
  habits: ApiHabit[];
  groups: ApiHabitGroup[];
  /** Apply an optimistic habit list, and restore a snapshot on failure. */
  setHabits: (next: ApiHabit[]) => void;
  /** Apply an optimistic group list, and restore a snapshot on failure. */
  setGroups: (next: ApiHabitGroup[]) => void;
  /** Called after a failed move so the page can refetch authoritative order. */
  onError?: () => void;
}

export type HabitsView = 'timeline' | 'calendar';

export interface HabitBlockPreviewProps {
  /** The dragged habit or group name. */
  name: string;
  /** Optional group icon occupying one 24px grid cell. */
  icon?: string | null;
  /** Sub-habits carried along, or habits carried by a dragged group. */
  count: number;
  kind: 'habit' | 'habit-group';
}

export interface HabitDotProps {
  state: DayState;
  size?: number;
  /** Renders the hover affordance used by interactive day cells. */
  interactive?: boolean;
}

export interface HabitMonthGridProps {
  year: number;
  month: number;
  today: Date;
  weekStart: WeekStart;
  /** Resolves the rendered state of one day. Parents report their derived state. */
  stateFor: (iso: string) => DayState;
  onToggle?: (iso: string) => void;
  label?: string;
  readOnly?: boolean;
}

export interface HabitCalendarProps {
  sections: HabitSections;
  today: Date;
  year: number;
  month: number;
  weekStart: WeekStart;
  onMonthChange: (year: number, month: number) => void;
  onToggleDay: (node: HabitNode, iso: string) => void;
  editing?: HabitEditTarget;
  /** The habit or group currently being dragged, so its card can dim. */
  activeDragId?: string | null;
  onStartEdit?: (target: HabitEditTarget) => void;
  onCommitEdit?: (target: HabitEditTarget, name: string) => void;
  onCancelEdit?: (target: HabitEditTarget) => void;
}

export interface HabitCalendarGridProps {
  habits: HabitNode[];
  groupId: string | null;
  today: Date;
  year: number;
  month: number;
  weekStart: WeekStart;
  onToggleDay: (node: HabitNode, iso: string) => void;
  editing?: HabitEditTarget;
  activeDragId?: string | null;
  onStartEdit?: (target: HabitEditTarget) => void;
  onCommitEdit?: (target: HabitEditTarget, name: string) => void;
  onCancelEdit?: (target: HabitEditTarget) => void;
}

export type HabitEditTarget = { kind: 'habit' | 'group'; id: string };

export interface HabitsToolbarProps {
  view: HabitsView;
  onViewChange: (view: HabitsView) => void;
  weekAnchor: Date;
  today: Date;
  weekStart: WeekStart;
  onWeekChange: (date: Date) => void;
  /** Back to the current week (timeline) or month (calendar). */
  onToday: () => void;
  /** `[` and `]` in the calendar step one month. */
  onMonthShift: (delta: -1 | 1) => void;
}
