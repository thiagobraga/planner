/** Task domain types — extracted from component props, hook options, store state, and utils.
 * Importers rewrite `import type { X } from '../api/client'` / `'../components/TaskItem'` etc.
 * to `import type { X } from '../types/tasks'`.
 */

import type { ReactNode } from 'react';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: number;
  collectionId?: string;
  sectionId?: string;
  parentTaskId?: string;
  dueDate?: string;
  dueTime?: string | null;
  endTime?: string | null;
  deadlineDate?: string | null;
  deadlineTime?: string | null;
  durationMinutes?: number | null;
  recurrenceRule?: {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    weekdays?: number[];
    dayOfMonth?: number;
    month?: number;
    fromCompletion?: boolean;
    until?: string;
  } | null;
  isCompleted: boolean;
  orderValue: number;
  labels?: {
    id: string;
    name: string;
    color: string;
  }[];
  indent?: number;
  type: 'task' | 'note' | 'event';
  createdAt?: string;
  moved?: boolean;
  statusId?: string | null;
}

export interface TaskItemProps {
  task: Task;
  isEditing?: boolean;
  dimmed?: boolean;
  hideDueDate?: boolean;
  dimNotes?: boolean;
  containerId?: string;
  subtreeIds?: string[];
  projectedDepth?: number;
  renderedDepth?: number;
  departed?: boolean;
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
  'onStartEdit' | 'onEditCommit' | 'onEditCancel' | 'onDelete' | 'onAddBelow' | 'onIndent' | 'onConvertType' | 'onRightClick'
>;

export interface TaskListProps extends TaskListCallbacks {
  tasks: Task[];
  editingId?: string;
  dimNotes?: boolean;
  hideDueDate?: boolean;
  containerId: string;
  dropId?: string;
  dayDate?: string;
  sectionId?: string;
  collectionId?: string;
  dropData?: unknown;
  activeDragId?: string | null;
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
  rows: { task: Task; depth: number }[];
}

export interface TaskVisibilityControlsProps {
  hideCompletedTasks: boolean;
  showNotes: boolean;
  disabled?: boolean;
  onHideCompletedTasksChange: (value: boolean) => void;
  onShowNotesChange: (value: boolean) => void;
}

export interface DaySection {
  date: string;
  tasks: Task[];
}

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

export interface Section {
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
  tasks: Task[];
  setTasks: (updater: (prev: Task[]) => Task[]) => void;
  scope: TaskOrderScope;
  onError?: () => void;
  onMoved?: () => void;
}

export interface ResolvedMove {
  input: {
    parentTaskId: string | null;
    dueDate: string | null;
    dueTime: string | null;
    endTime: string | null;
    deadlineDate: string | null;
    deadlineTime: string | null;
    durationMinutes: number | null;
    scope: { kind: 'collection' | 'day'; collectionId?: string; dayDate?: string };
  };
  parentTaskId: string | null;
  depth: number;
  orderValue: number;
  announcement: string;
  preview: string;
}

export interface UseSectionDragOptions {
  sections: Section[];
  setSections: (updater: (prev: Section[]) => Section[]) => void;
  onError?: () => void;
}

export type TaskOrderScope = {
  kind: 'collection' | 'day';
  collectionId?: string;
  dayDate?: string;
};

export interface TaskDragData {
  kind: 'task';
  taskId: string;
  parentTaskId: string | null;
  collectionId: string;
  sectionId: string | null;
  dueDate: string | null;
  depth: number;
  containerId: string;
  subtreeIds: string[];
}

export interface IndentResult<T> {
  tasks: T[];
  parentTaskId: string | null;
  changed: boolean;
}

export interface TreeNode {
  id: string;
  indent?: number;
  collectionId?: string;
}

export interface IndentTracker {
  indent: number;
  setIndent: (indent: number) => void;
}

export interface FlatRow<T extends TaskLike = TaskLike> {
  task: T;
  id: string;
  parentId: string | null;
  depth: number;
}

export interface TaskLike {
  id: string;
  parentTaskId?: string | null;
  orderValue?: number;
  createdAt?: string;
}

export interface Projection {
  parentId: string | null;
  depth: number;
  position: number;
}