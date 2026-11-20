import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';
import type { ApiSection, ApiStatus, ApiTask, BoardOrder } from './api';
import type { BoardGroupBy } from './drag';
import type { Task, TaskListCallbacks } from './task';
import type { TaskList } from '../components/TaskList';
import type { LeafProgress } from './detail';

/** Presentation is local to a page; `kanban` remains the legacy card-board value. */
export type BoardViewMode = 'list' | 'kanban-list' | 'kanban' | 'calendar';

export type BoardColumnId = `status:${string}` | `section:${string}` | `priority:${number}`;

export interface BoardColumn {
  id: BoardColumnId;
  value: string | number | null;
  title: string;
  color?: string;
  isCompletionStatus?: boolean;
  tasks: ApiTask[];
}

export interface StatusListTask {
  id: string;
  parentTaskId?: string;
  statusId?: string | null;
}

export interface StatusListGroup<T> {
  id: string;
  title: string;
  color: string;
  tasks: T[];
}

export interface BoardColumnDeleteOption {
  value: string;
  label: string;
}

export interface BoardViewProps {
  collectionId: string;
  groupBy: BoardGroupBy;
  columns: BoardColumn[];
  tasks: ApiTask[];
  canAddColumn?: boolean;
  onToggle?: (taskId: string, completed: boolean) => void;
  onAddColumn?: (name: string) => void;
  onRenameColumn?: (columnId: string, name: string) => void;
  onRecolorColumn?: (columnId: string, color: string) => void;
  onMarkCompletion?: (columnId: string) => void;
  onDeleteColumn?: (columnId: string) => void;
  statuses?: ApiStatus[];
  onUpdateStatusRoute?: (statusId: string, patch: Partial<Pick<ApiStatus, 'nextStatusMode' | 'nextStatusId' | 'acceptStatusId' | 'rejectStatusId'>>) => void;
  onCreateTask?: (title: string, column: BoardColumn) => Promise<void>;
  presentation?: Exclude<BoardViewMode, 'list' | 'calendar'>;
  taskListProps?: TaskListCallbacks & { editingId?: string; activeDragId?: string | null };
}

export interface BoardCardProps {
  task: ApiTask;
  subtasks: ApiTask[];
  containerId?: string;
  subtreeIds?: string[];
  progress?: LeafProgress;
  childCounts?: ReadonlyMap<string, number>;
  onToggle?: (taskId: string, completed: boolean) => void;
  hideDueDate?: boolean;
  onTaskContextMenu?: (taskId: string, position: { x: number; y: number }) => void;
}

export interface CollectionBoardProps {
  collectionId: string;
  queryKey: readonly unknown[];
  groupBy: BoardGroupBy;
  tasks: ApiTask[];
  statuses: ApiStatus[];
  completionStatusId: string | null;
  sections: ApiSection[];
  boardOrder: BoardOrder;
  onToggle?: (taskId: string, completed: boolean) => void;
  presentation?: Exclude<BoardViewMode, 'list' | 'calendar'>;
  taskListProps?: TaskListCallbacks & { editingId?: string; activeDragId?: string | null };
}

export interface AddColumnButtonProps {
  onAdd?: (name: string) => void;
}

export interface BoardColumnHeaderProps {
  columnId: string;
  groupBy: BoardGroupBy;
  title: string;
  /** Top-level cards in the column, shown after the name. */
  count?: number;
  color?: string;
  isCompletionStatus?: boolean;
  canEdit?: boolean;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
  setDragHandleRef?: (node: HTMLElement | null) => void;
  onRename?: (name: string) => void;
  onRecolor?: (color: string) => void;
  onMarkCompletion?: () => void;
  onDelete?: () => void;
  status?: ApiStatus;
  statuses?: ApiStatus[];
  onUpdateRoute?: (patch: Partial<Pick<ApiStatus, 'nextStatusMode' | 'nextStatusId' | 'acceptStatusId' | 'rejectStatusId'>>) => void;
}

export interface BoardColumnProps {
  collectionId: string;
  groupBy: BoardGroupBy;
  column: BoardColumn;
  allTasks: ApiTask[];
  onToggle?: (taskId: string, completed: boolean) => void;
  onRename?: (columnId: string, name: string) => void;
  onRecolor?: (columnId: string, color: string) => void;
  onMarkCompletion?: (columnId: string) => void;
  onDelete?: (columnId: string) => void;
  statuses?: ApiStatus[];
  onUpdateStatusRoute?: (statusId: string, patch: Partial<Pick<ApiStatus, 'nextStatusMode' | 'nextStatusId' | 'acceptStatusId' | 'rejectStatusId'>>) => void;
  onCreate?: (title: string, column: BoardColumn) => Promise<void>;
  presentation?: 'kanban-list' | 'kanban';
  taskListProps?: TaskListCallbacks & { editingId?: string; activeDragId?: string | null };
}

export interface BoardCardChecklistProps {
  parentTask: ApiTask;
  tasks: ApiTask[];
  /** Unique actionable leaves under the card; defaults to its direct tasks. */
  progress?: LeafProgress;
  /** Direct child counts by task id, shown on rows that have their own subtasks. */
  childCounts?: ReadonlyMap<string, number>;
  onToggle?: (taskId: string, completed: boolean) => void;
}

export type SharedTaskListProps = Omit<
  ComponentProps<typeof TaskList>,
  'tasks' | 'containerId' | 'sectionId' | 'dayDate'
>;

export interface StatusTaskListProps {
  groups: StatusListGroup<Task>[];
  taskListProps: SharedTaskListProps;
  afterFirstGroup?: ReactNode;
}

export interface ColumnDeleteModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  reassignOptions: BoardColumnDeleteOption[];
  selectedReassignToId: string | null;
  errorMessage: string | null;
  onChangeReassignToId: (value: string | null) => void;
  onDelete: () => void;
  onCancel: () => void;
}

export interface BuildColumnsInput {
  groupBy: BoardGroupBy;
  tasks: ApiTask[];
  statuses: ApiStatus[];
  completionStatusId: string | null;
  sections: ApiSection[];
  boardOrder: BoardOrder;
  noSectionTitle: string;
  priorityTitle: (priority: number) => string;
}

export interface BoardColumnDeleteModalState {
  isOpen: boolean;
  title: string;
  message: string;
  reassignOptions: BoardColumnDeleteOption[];
  selectedReassignToId: string | null;
  errorMessage: string | null;
  onChangeReassignToId: (value: string | null) => void;
  onDelete: () => void;
  onCancel: () => void;
}

export interface DeleteDraft {
  columnId: string;
  title: string;
  taskCount: number;
}

export interface UseBoardColumnDragOptions {
  collectionId: string;
  groupBy: BoardGroupBy;
  columns: BoardColumn[];
  setColumns: (updater: (prev: BoardColumn[]) => BoardColumn[]) => void;
  statuses?: ApiStatus[];
  sections?: ApiSection[];
  onError?: () => void;
  deleteMessage?: (groupBy: BoardGroupBy, taskCount: number) => string;
}

export interface UseBoardColumnDragResult {
  deleteModal: BoardColumnDeleteModalState | null;
  openDeleteColumn: (columnId: string) => void;
  closeDeleteColumn: () => void;
}
