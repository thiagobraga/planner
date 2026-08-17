import { vi } from 'vitest';
import type {
  Preferences,
  ApiTask,
  ApiCollection,
  ApiSection,
  ApiStatus,
} from '../../api/client';

export const basePreferences: Preferences = {
  userId: 'user-1',
  locale: 'en',
  timeZone: 'Europe/London',
  weekStart: 'monday',
  theme: 'light',
  notificationsEnabled: true,
  font: 'lora',
  showDots: true,
  background: 'beige',
  smallCaps: false,
  hideCompletedTasks: false,
  hideOldNotes: false,
  collapsedCollectionIds: [],
  boardViewModes: {},
};

export const baseInboxData = {
  tasks: [],
  collectionId: null,
  inboxCollectionId: undefined,
  sections: [],
  statuses: [],
  completionStatusId: null,
  boardOrder: { status: {}, priority: {} },
};

export const sampleTasks: ApiTask[] = [
  {
    id: 'task-1',
    title: 'Buy groceries',
    description: '',
    priority: 4,
    collectionId: 'col-1',
    sectionId: undefined,
    parentTaskId: undefined,
    dueDate: undefined,
    isCompleted: false,
    orderValue: 1,
    depth: 0,
    type: 'task',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'task-2',
    title: 'Write tests',
    description: '',
    priority: 4,
    collectionId: 'col-1',
    sectionId: undefined,
    parentTaskId: undefined,
    dueDate: undefined,
    isCompleted: true,
    orderValue: 2,
    depth: 0,
    type: 'task',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

export function createdTask(overrides: Partial<ApiTask> = {}): ApiTask {
  return {
    id: 'created-1',
    title: 'Created',
    description: '',
    priority: 4,
    collectionId: 'col-1',
    sectionId: undefined,
    parentTaskId: undefined,
    dueDate: undefined,
    isCompleted: false,
    orderValue: 0,
    depth: 0,
    type: 'task',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function collection(overrides: Partial<ApiCollection> = {}): ApiCollection {
  return {
    id: 'col-home',
    userId: 'user-1',
    parentId: null,
    name: 'Home',
    color: '#8fbc8f',
    isInbox: false,
    isArchived: false,
    orderValue: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function section(overrides: Partial<ApiSection> = {}): ApiSection {
  return {
    id: 'section-1',
    name: 'Work',
    collectionId: 'col-1',
    orderValue: 0,
    ...overrides,
  };
}

export function status(overrides: Partial<ApiStatus> = {}): ApiStatus {
  return {
    id: 'st-1',
    collectionId: 'col-1',
    name: 'Backlog',
    color: '#8fbc8f',
    orderValue: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export const taskListMock = vi.fn(
  ({
    tasks,
    containerId,
    editingId,
    onTaskToggle,
    onStartEdit,
    onEditCommit,
    onEditCancel,
    onDelete,
    onAddBelow,
    onIndent,
    onConvertType,
    onRightClick,
  }: {
    tasks: Array<{ id: string; title: string; type: string }>;
    containerId: string;
    editingId?: string;
    onTaskToggle?: (id: string) => void;
    onStartEdit?: (id: string) => void;
    onEditCommit?: (id: string, title: string) => void;
    onEditCancel?: (id: string) => void;
    onDelete?: (id: string) => void;
    onAddBelow?: (id: string) => void;
    onIndent?: (id: string, dir: 1 | -1) => void;
    onConvertType?: (id: string, type: 'task' | 'note' | 'event') => void;
    onRightClick?: (id: string, position: { x: number; y: number }) => void;
  }) => (
    <div data-testid={`task-list-${containerId}`} role="list">
      <span data-testid="editing-id">{editingId ?? ''}</span>
      {tasks.map((task) => (
        <div
          key={task.id}
          data-testid={`task-item-${task.id}`}
          data-task-id={task.id}
          tabIndex={-1}
          role="listitem"
        >
          <span>{task.title}</span>
          <span data-testid={`task-type-${task.id}`}>{task.type}</span>
          <button data-testid={`toggle-${task.id}`} onClick={() => onTaskToggle?.(task.id)}>
            toggle
          </button>
          <button data-testid={`indent-${task.id}`} onClick={() => onIndent?.(task.id, 1)}>
            indent
          </button>
          <button data-testid={`unindent-${task.id}`} onClick={() => onIndent?.(task.id, -1)}>
            unindent
          </button>
          <button data-testid={`delete-${task.id}`} onClick={() => onDelete?.(task.id)}>
            delete
          </button>
          <button data-testid={`edit-${task.id}`} onClick={() => onStartEdit?.(task.id)}>
            edit
          </button>
          <button
            data-testid={`commit-${task.id}`}
            onClick={() => onEditCommit?.(task.id, 'Edited title')}
          >
            commit
          </button>
          <button data-testid={`commit-blank-${task.id}`} onClick={() => onEditCommit?.(task.id, '')}>
            commit blank
          </button>
          <button data-testid={`cancel-edit-${task.id}`} onClick={() => onEditCancel?.(task.id)}>
            cancel edit
          </button>
          <button data-testid={`add-below-${task.id}`} onClick={() => onAddBelow?.(task.id)}>
            add below
          </button>
          <button
            data-testid={`convert-${task.id}`}
            onClick={() => onConvertType?.(task.id, task.type === 'note' ? 'task' : 'note')}
          >
            convert
          </button>
          <button data-testid={`convert-event-${task.id}`} onClick={() => onConvertType?.(task.id, 'event')}>
            convert to event
          </button>
          <button
            data-testid={`context-${task.id}`}
            onClick={() => onRightClick?.(task.id, { x: 10, y: 10 })}
          >
            context
          </button>
        </div>
      ))}
    </div>
  ),
);

export const collectionBoardMock = vi.fn(
  ({
    collectionId,
    groupBy,
    onToggle,
  }: {
    collectionId: string;
    groupBy: string;
    onToggle?: (taskId: string) => void;
  }) => (
    <div data-testid="collection-board" data-collection-id={collectionId} data-group-by={groupBy}>
      <button data-testid="board-toggle-task-1" onClick={() => onToggle?.('task-1')}>
        toggle task-1
      </button>
    </div>
  ),
);
