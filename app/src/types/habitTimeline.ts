import type { ReactNode } from 'react';
import type { ApiHabitGroup } from './api';
import type { HabitEditTarget, HabitNode, HabitSections } from './habits';
import type { WeekStart } from './utils';

// Every row is one 24px band. Labels and day cells render from this same list so
// the two columns cannot drift out of alignment.
export type TimelineRow =
  | { key: string; kind: 'group-header'; group: ApiHabitGroup }
  | { key: string; kind: 'habit'; node: HabitNode; depth: number; groupId: string | null }
  | { key: string; kind: 'add-habit'; groupId: string | null }
  | { key: string; kind: 'spacer' }
  | { key: string; kind: 'add-group' };

/**
 * One drop region of the label column.
 *
 * Rows are grouped into sections so a habit can be dropped into a group that has
 * no rows to aim at. The day-grid column re-flattens these back into one list,
 * so both columns still render exactly the same bands in the same order.
 */
export interface TimelineSection {
  key: string;
  /** Null for the ungrouped list; absent entirely for the trailing add-group area. */
  groupId: string | null;
  /** The tail section holds only chrome and accepts nothing. */
  droppable: boolean;
  rows: TimelineRow[];
}

export interface TimelineDayCell {
  iso: string;
  letter: string;
  dayOfMonth: number;
  future: boolean;
  isWeekend: boolean;
}

/** A habit row as it renders: the node and how deep it sits. */
export interface TimelineNodeAtDepth {
  node: HabitNode;
  depth: number;
}

export interface TimelineMenuState {
  target: HabitEditTarget;
  canAddSub: boolean;
  x: number;
  y: number;
}

export interface HabitTimelineHandlers {
  onToggleCollapse: (id: string) => void;
  onToggleDay: (node: HabitNode, iso: string) => void;
  onStartEdit: (target: HabitEditTarget) => void;
  onCommitEdit: (target: HabitEditTarget, name: string) => void;
  onCancelEdit: (target: HabitEditTarget) => void;
  onAddHabit: (options: { groupId: string | null; parentId?: string }) => void;
  onAddGroup: () => void;
  onToggleGroupIcon: (id: string) => void;
  onDelete: (target: HabitEditTarget) => void;
  onArchive: (target: HabitEditTarget) => void;
}

export interface HabitTimelineProps extends HabitTimelineHandlers {
  sections: HabitSections;
  today: Date;
  weekStart: WeekStart;
  weekAnchor: Date;
  editing?: HabitEditTarget;
  collapsed: ReadonlySet<string>;
  /** The habit or group currently being dragged, so its block can be collapsed. */
  activeDragId?: string | null;
}

export type DayColClass = (day: TimelineDayCell) => string;

export interface HabitTimelineDaysProps {
  days: TimelineDayCell[];
  dayColClass: DayColClass;
}

export interface HabitTimelineDayGridProps extends HabitTimelineDaysProps {
  rows: TimelineRow[];
  onToggleDay: (node: HabitNode, iso: string) => void;
}

export interface HabitTimelineDayHeaderProps extends HabitTimelineDaysProps {
  labelColWidth: number;
  todayISO: string;
}

/** The dragged habit and the sub-habits it carries, drawn as whole rows. */
export interface HabitTimelineBlockPreviewProps extends HabitTimelineDaysProps {
  rows: TimelineNodeAtDepth[];
  labelColWidth: number;
}

export interface HabitTimelineLabelsProps
  extends Pick<
    HabitTimelineHandlers,
    'onToggleCollapse' | 'onStartEdit' | 'onCommitEdit' | 'onCancelEdit' | 'onAddHabit' | 'onAddGroup'
  > {
  sections: TimelineSection[];
  sortableIds: string[];
  width: number;
  editing?: HabitEditTarget;
  collapsed: ReadonlySet<string>;
  activeDragId?: string | null;
  insertionBeforeId: string | null;
  insertionDepth: number;
  onOpenMenu: (menu: TimelineMenuState) => void;
}

export interface HabitTimelineMenuProps
  extends Pick<HabitTimelineHandlers, 'onStartEdit' | 'onToggleGroupIcon' | 'onAddHabit' | 'onArchive' | 'onDelete'> {
  menu: TimelineMenuState;
  groupHasIcon: boolean;
  onClose: () => void;
}

export interface SortableHabitLabelRowProps {
  node: HabitNode;
  depth: number;
  groupId: string | null;
  indent: number;
  dimmed: boolean;
  showInsertionBefore: boolean;
  insertionDepth: number;
  children: ReactNode;
}

export interface SortableGroupHeaderProps {
  group: ApiHabitGroup;
  dimmed: boolean;
  children: ReactNode;
}

export interface TimelineSectionDropProps {
  groupId: string | null;
  droppable: boolean;
  children: ReactNode;
}

export interface UseHabitTimelineDragOptions {
  sections: HabitSections;
  collapsed: ReadonlySet<string>;
  activeDragId?: string | null;
  days: TimelineDayCell[];
  dayColClass: DayColClass;
  labelColWidth: number;
}
