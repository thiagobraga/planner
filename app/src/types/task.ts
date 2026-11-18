import type { ReactNode } from 'react';
import type { LabelSummary, TaskMoveInput } from './api';
import type {
  BoardColumnDropData,
  DayDropData,
  NoDateDropData,
  SectionDropData,
  TaskOrderScope,
} from './drag';
import type { TaskIndentHandler, TaskListContextMenuHandler } from './taskIndent';

/** Mirrors api/src/types/recurrence.ts. */
export interface RecurrenceRule {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  /** 0=Sun ... 6=Sat, for weekly rules. */
  weekdays?: number[];
  dayOfMonth?: number;
  month?: number;
  /** Count the next occurrence from the completion day instead of the scheduled date. */
  fromCompletion?: boolean;
  /** YYYY-MM-DD, last day an occurrence may fall on. */
  until?: string;
}

/** GET /dates/parse response. */
export interface ParsedDateInput {
  date: string;
  time: string | null;
  recurrence: RecurrenceRule | null;
}

/** The date/time facets a user edits together: planned day and time, hard deadline, expected length, repeat. */
export interface TaskSchedule {
  dueDate: string | null;
  dueTime: string | null;
  deadlineDate: string | null;
  deadlineTime: string | null;
  durationMinutes: number | null;
  recurrenceRule: RecurrenceRule | null;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: number;
  collectionId?: string;
  sectionId?: string;
  statusId?: string | null;
  parentTaskId?: string;
  dueDate?: string;
  /** HH:MM wall-clock time; `endTime` is derived by the API from the duration. */
  dueTime?: string | null;
  endTime?: string | null;
  deadlineDate?: string | null;
  deadlineTime?: string | null;
  durationMinutes?: number | null;
  recurrenceRule?: RecurrenceRule | null;
  isCompleted: boolean;
  orderValue: number;
  labels?: LabelSummary[];
  indent?: number;
  type: 'task' | 'note' | 'event';
  createdAt?: string;
  collectionName?: string;
  collectionColor?: string;
  collectionIsInbox?: boolean;
  sectionName?: string;
  /** Set on Reorganize preview rows whose due date would change, for a highlight. */
  moved?: boolean;
}

export interface TaskItemProps {
  task: Task;
  isEditing?: boolean;
  dimmed?: boolean;
  hideDueDate?: boolean;
  dimNotes?: boolean;
  /** The list this row renders in - a collection list, or one Daily date section. */
  containerId?: string;
  /** `[task.id, ...descendantIds]`, so a drop inside the dragged block is detectable. */
  subtreeIds?: string[];
  /**
   * Depth this row would land at, set only on the row being dragged. It renders
   * as the insertion indicator, so horizontal drag previews the nesting level
   * before the drop rather than only after it.
   */
  projectedDepth?: number;
  /**
   * Depth within the list actually being rendered. Falls back to the task's
   * stored tree depth when a caller does not flatten its own rows.
   */
  renderedDepth?: number;
  /**
   * The block has left this list: the drop is heading somewhere else. The row
   * gives up its space rather than holding a slot the drop will not use.
   */
  departed?: boolean;
  /** Rendered beside the title - used on Daily, where rows span collections. */
  collectionBadge?: ReactNode;
  onToggle?: (id: string) => void;
  onStartEdit?: (id: string) => void;
  onEditCommit?: (id: string, title: string) => void;
  onEditCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddBelow?: (id: string) => void;
  onIndent?: (id: string, dir: 1 | -1) => void;
  onConvertType?: (id: string, type: 'task' | 'note' | 'event') => void;
  onRightClick?: (id: string, position: { x: number; y: number }) => void;
}

export type TaskListCallbacks = Pick<
  TaskItemProps,
  'onStartEdit' | 'onEditCommit' | 'onEditCancel' | 'onDelete' | 'onAddBelow' | 'onConvertType'
> & { onIndent?: TaskIndentHandler; onRightClick?: TaskListContextMenuHandler };

export interface TaskListProps extends TaskListCallbacks {
  tasks: Task[];
  editingId?: string;
  dimNotes?: boolean;
  hideDueDate?: boolean;
  /** Stable id for this list, used as the drag container and droppable id. */
  containerId: string;
  /** A board list needs its own drop id because its column is also sortable. */
  dropId?: string;
  /**
   * Set on Daily, where each rendered date is its own drop target. Omitted for
   * collection lists, which are addressed by container id alone.
   */
  dayDate?: string;
  /** Keep nesting within each due date when multiple days share a list. */
  groupNestingByDueDate?: boolean;
  /**
   * Set on Collections/Inbox when grouping tasks by section. Creates a section
   * drop target so tasks can be moved into this section.
   */
  sectionId?: string;
  /** Required when sectionId is set; used to populate SectionDropData. */
  collectionId?: string;
  /** Supplies a grouped-board destination for an otherwise empty task list. */
  dropData?: DayDropData | NoDateDropData | SectionDropData | BoardColumnDropData;
  /** The task currently being dragged, so its descendants can be dimmed. */
  activeDragId?: string | null;
  /** Rendered next to a row's title - Daily uses it for the collection chip. */
  renderBadge?: (task: Task) => ReactNode;
  onTaskToggle?: (id: string) => void;
}

export interface TaskComment {
  id: string;
  text: string;
  createdAt: string;
}

export interface TaskDetailProps {
  task: Task | null;
  onClose: () => void;
  onUpdate?: (id: string, updates: Partial<Task>) => void;
  onDelete?: (id: string) => void;
}

export interface TaskBlockPreviewProps {
  /** The dragged row first, then its descendants in render order. */
  rows: { task: Task; depth: number }[];
}

/** Zustand store row: no labels, no render-only fields. */
export interface StoreTask {
  id: string;
  title: string;
  description?: string;
  priority: number;
  collectionId: string;
  sectionId?: string;
  parentTaskId?: string;
  dueDate?: string;
  recurrenceRule?: object | null;
  isCompleted: boolean;
  orderValue: number;
}

export interface StoreSection {
  id: string;
  name: string;
  collectionId: string;
  orderValue: number;
}

export interface TaskState {
  tasks: StoreTask[];
  setTasks: (tasks: StoreTask[]) => void;
  addTask: (task: StoreTask) => void;
  updateTask: (id: string, updates: Partial<StoreTask>) => void;
  removeTask: (id: string) => void;
}

export interface TaskSelectionState {
  selectedTaskIds: Set<string>;
  selectTask: (id: string, isMulti: boolean) => void;
  toggleTask: (id: string) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
}

export interface UseTaskDragOptions {
  enabled?: boolean;
  /** Current rows, flat and unordered; the hook builds the tree itself. */
  tasks: Task[];
  /** Apply an optimistic result, and restore a snapshot on failure. */
  setTasks: (updater: (prev: Task[]) => Task[]) => void;
  /** The ordering scope a drop in this page's own list belongs to. */
  scope: TaskOrderScope;
  /** Called after a failed move so the page can refetch authoritative order. */
  onError?: () => void;
  /**
   * Called after a successful move, so the page can invalidate the *other* views
   * a move can reach into. A task dropped on a sidebar collection leaves this
   * page's list and joins one this page does not own; without this, navigating
   * there would serve a cache that never saw the move.
   */
  onMoved?: () => void;
}

export interface ResolvedMove {
  input: TaskMoveInput;
  parentTaskId: string | null;
  depth: number;
  /**
   * A same-space estimate of the server's midpoint, so the optimistic
   * re-sort (which orders siblings by `orderValue`, same as `flattenTasks`)
   * lands the row where it was dropped instead of snapping back to its old
   * slot until the authoritative response arrives.
   */
  orderValue: number;
  /** Past tense, spoken once the move has committed. */
  announcement: string;
  /**
   * Present tense, spoken while the row hovers this target. A keyboard user
   * arrowing through positions never sees the overlay, so without this the
   * projected target is invisible to them until they commit the drop.
   */
  preview: string;
}

export interface UseSectionDragOptions {
  sections: StoreSection[];
  setSections: (updater: (prev: StoreSection[]) => StoreSection[]) => void;
  /** Called after a failed reorder, so the page can refetch authoritative order. */
  onError?: () => void;
}

/**
 * Horizontal nesting intent, measured from the row the pointer is currently on.
 *
 * dnd-kit reports `delta.x` as total travel since pointer-down. Reading that as
 * nesting intent means a drag's horizontal drift accumulates over its whole
 * length, so a long vertical drag arrives asking for several levels of nesting
 * the user never gestured for - the further the drag, the deeper the accident.
 *
 * Rebasing on every new hovered row makes the intent local: what matters is how
 * far sideways the pointer moved *since reaching the row it is now over*, not
 * how far it wandered getting there.
 */
export interface IndentTracker {
  /** Record the drag's total horizontal delta, as dnd-kit reports it. */
  move(totalDeltaX: number): void;
  /** The pointer reached a different row; intent restarts from here. */
  enterRow(): void;
  /** Horizontal intent relative to the current row, in pixels. */
  offset(): number;
  /** Forget everything; call at the start of each drag. */
  reset(): void;
}

export interface TreeNode {
  id: string;
  indent?: number;
  collectionId?: string;
}

export interface IndentResult<T> {
  /** The list with the task (and its subtree) re-indented, or the original list unchanged. */
  tasks: T[];
  /** The new parent id to persist (`null` = top level). Only meaningful when `changed`. */
  parentTaskId: string | null;
  /** False when the keypress was a no-op - callers should skip the API call. */
  changed: boolean;
}

export interface TaskLike {
  id: string;
  parentTaskId?: string | null;
  orderValue?: number;
  createdAt?: string;
}

export interface FlatRow<T extends TaskLike = TaskLike> {
  task: T;
  id: string;
  parentId: string | null;
  depth: number;
}

export interface Projection {
  /** Parent the dragged task would take. */
  parentId: string | null;
  /** Depth it would render at. */
  depth: number;
  /** Zero-based index among its new siblings - not the flat render index. */
  position: number;
}

export interface ApiScheduleFields {
  dueTime?: string | null;
  endTime?: string | null;
  deadlineDate?: string | null;
  deadlineTime?: string | null;
  durationMinutes?: number | null;
  recurrenceRule?: RecurrenceRule | null;
}
