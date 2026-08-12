import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InboxPage } from '../InboxPage';
import { trackMove, resetTrackedMoves } from '../../utils/moveEcho';
import {
  fetchInboxTasks,
  apiCreateTask,
  apiUpdateTask,
  apiToggleTask,
  apiDeleteTask,
  apiCreateSection,
  apiUpdateSection,
  apiDeleteSection,
  apiUpdatePreferences,
  fetchPreferences,
  fetchCollections,
  type Preferences,
  type ApiTask,
  type ApiCollection,
  type ApiSection,
  type ApiStatus,
} from '../../api/client';
import { TaskList } from '../../components/TaskList';
import { useSync } from '../../hooks/useSync';
import { useTaskDrag } from '../../hooks/useTaskDrag';
import { useSectionDrag } from '../../hooks/useSectionDrag';

const mockFetchInboxTasks = vi.mocked(fetchInboxTasks);
const mockApiCreateTask = vi.mocked(apiCreateTask);
const mockApiUpdateTask = vi.mocked(apiUpdateTask);
const mockApiToggleTask = vi.mocked(apiToggleTask);
const mockApiDeleteTask = vi.mocked(apiDeleteTask);
const mockApiCreateSection = vi.mocked(apiCreateSection);
const mockApiUpdateSection = vi.mocked(apiUpdateSection);
const mockApiDeleteSection = vi.mocked(apiDeleteSection);
const mockApiUpdatePreferences = vi.mocked(apiUpdatePreferences);
const mockFetchPreferences = vi.mocked(fetchPreferences);
const mockFetchCollections = vi.mocked(fetchCollections);
const mockTaskList = vi.mocked(TaskList);
const mockUseSync = vi.mocked(useSync);
const mockUseTaskDrag = vi.mocked(useTaskDrag);
const mockUseSectionDrag = vi.mocked(useSectionDrag);

const basePreferences: Preferences = {
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

const baseInboxData = {
  tasks: [],
  collectionId: null,
  inboxCollectionId: undefined,
  sections: [],
  statuses: [],
  completionStatusId: null,
  boardOrder: { status: {}, priority: {} },
};

const sampleTasks: ApiTask[] = [
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

function createdTask(overrides: Partial<ApiTask> = {}): ApiTask {
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

function collection(overrides: Partial<ApiCollection> = {}): ApiCollection {
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

function section(overrides: Partial<ApiSection> = {}): ApiSection {
  return {
    id: 'section-1',
    name: 'Work',
    collectionId: 'col-1',
    orderValue: 0,
    ...overrides,
  };
}

function status(overrides: Partial<ApiStatus> = {}): ApiStatus {
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

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchInboxTasks: vi.fn(),
  apiCreateTask: vi.fn(),
  apiUpdateTask: vi.fn(),
  apiToggleTask: vi.fn(),
  apiDeleteTask: vi.fn(),
  apiCreateSection: vi.fn(),
  apiUpdateSection: vi.fn(),
  apiDeleteSection: vi.fn(),
  apiUpdatePreferences: vi.fn(),
  fetchPreferences: vi.fn(),
  fetchCollections: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock('../../hooks/useTaskDrag', () => ({
  useTaskDrag: vi.fn(),
}));

vi.mock('../../hooks/useSectionDrag', () => ({
  useSectionDrag: vi.fn(),
}));

vi.mock('../../hooks/useSync', () => ({
  useSync: vi.fn(),
}));

vi.mock('../../utils/phrases', () => ({
  getPhrase: vi.fn(() => 'Dump it here. Sort it later.'),
}));

vi.mock('../../components/TaskList', () => ({
  TaskList: vi.fn(
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
      onConvertType?: (id: string, type: 'task' | 'note') => void;
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
  ),
}));

vi.mock('../../components/board/CollectionBoard', () => ({
  CollectionBoard: ({
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
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function inboxList() {
  return screen.getByTestId('task-list-collection:inbox');
}

function taskListCalls(containerId: string) {
  return mockTaskList.mock.calls.filter(([props]) => props.containerId === containerId);
}

function latestDragOptions() {
  return mockUseTaskDrag.mock.calls.at(-1)![0];
}

function latestSectionDragOptions() {
  return mockUseSectionDrag.mock.calls.at(-1)![0];
}

beforeEach(() => {
  mockFetchInboxTasks.mockReset();
  mockApiCreateTask.mockReset();
  mockApiUpdateTask.mockReset();
  mockApiToggleTask.mockReset();
  mockApiDeleteTask.mockReset();
  mockApiCreateSection.mockReset();
  mockApiUpdateSection.mockReset();
  mockApiDeleteSection.mockReset();
  mockApiUpdatePreferences.mockReset();
  mockFetchPreferences.mockReset();
  mockFetchCollections.mockReset();
  mockTaskList.mockClear();
  mockUseSync.mockClear();
  mockUseTaskDrag.mockClear();
  mockUseSectionDrag.mockClear();
  mockFetchInboxTasks.mockResolvedValue(baseInboxData);
  mockFetchPreferences.mockResolvedValue(basePreferences);
  mockFetchCollections.mockResolvedValue([]);
  mockApiCreateTask.mockResolvedValue(createdTask());
  mockApiUpdateTask.mockResolvedValue(undefined);
  mockApiToggleTask.mockResolvedValue(sampleTasks[0]);
  mockApiDeleteTask.mockResolvedValue(undefined);
  mockApiCreateSection.mockResolvedValue(section());
  mockApiUpdateSection.mockResolvedValue(section());
  mockApiDeleteSection.mockResolvedValue(undefined);
  mockApiUpdatePreferences.mockResolvedValue(basePreferences);
  mockUseTaskDrag.mockReturnValue({ activeDragId: null });
  mockUseSync.mockReturnValue(undefined);
  mockUseSectionDrag.mockReturnValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('InboxPage', () => {
  it('shows a loading state (empty task list, header, and input) while the inbox query is pending', () => {
    mockFetchInboxTasks.mockReturnValueOnce(new Promise(() => {}));
    renderPage();

    expect(screen.getByText('Inbox')).toBeInTheDocument();
    expect(screen.getByText('Dump it here. Sort it later.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('New task…')).toBeInTheDocument();
    expect(inboxList().querySelectorAll('[role="listitem"]')).toHaveLength(0);
  });

  it('renders the header with Inbox title and a phrase', async () => {
    renderPage();

    const header = screen.getByText('Inbox').closest('header');
    expect(header).toContainElement(await screen.findByText('Dump it here. Sort it later.'));
    expect(header).toContainElement(screen.getByRole('button', { name: 'Hide completed tasks' }));
    expect(header).toContainElement(screen.getByRole('button', { name: 'Hide old notes' }));
    expect(screen.getByRole('button', { name: 'Hide old notes' }).closest('.page-header-toolbar')).toHaveClass('absolute', 'right-0');
  });

  it('updates the hide-old-notes preference from the header toolbar', async () => {
    mockApiUpdatePreferences.mockResolvedValue({ ...basePreferences, hideOldNotes: true });
    renderPage();

    const button = await screen.findByRole('button', { name: 'Hide old notes' });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    await waitFor(() =>
      expect(mockApiUpdatePreferences).toHaveBeenCalledWith({ hideOldNotes: true }),
    );
    expect(await screen.findByRole('button', { name: 'Show old notes' })).toBeInTheDocument();
  });

  it('renders tasks when inbox data arrives', async () => {
    mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Buy groceries')).toBeInTheDocument();
    });
    expect(screen.getByText('Write tests')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^task-item-/)).toHaveLength(2);
  });

  it('renders the add-task input', async () => {
    renderPage();

    expect(await screen.findByPlaceholderText('New task…')).toBeInTheDocument();
  });

  describe('task creation', () => {
    it('creates a task optimistically and replaces it with the server row', async () => {
      mockApiCreateTask.mockResolvedValue(createdTask({ title: 'Buy groceries' }));
      const { container } = renderPage();

      const input = await screen.findByPlaceholderText('New task…');
      fireEvent.change(input, { target: { value: 'Buy groceries' } });
      fireEvent.submit(input.closest('form')!);

      expect(mockApiCreateTask).toHaveBeenCalledWith({
        title: 'Buy groceries',
        priority: 4,
        dueDate: undefined,
        recurrenceRule: undefined,
      });
      expect(await screen.findByTestId('task-item-created-1')).toBeInTheDocument();
      expect(container.querySelector('.inbox-page input')?.getAttribute('value')).toBe('');
    });

    it('strips a natural date from the title and sends it as the due date', async () => {
      mockApiCreateTask.mockResolvedValue(createdTask({ title: 'Buy milk', dueDate: '2026-08-13' }));
      renderPage();

      const input = await screen.findByPlaceholderText('New task…');
      fireEvent.change(input, { target: { value: 'Buy milk tomorrow' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() =>
        expect(mockApiCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Buy milk', dueDate: expect.any(String) }),
        ),
      );
    });

    it('passes a parsed recurrence rule to the API', async () => {
      mockApiCreateTask.mockResolvedValue(createdTask({ title: 'Walk' }));
      renderPage();

      const input = await screen.findByPlaceholderText('New task…');
      fireEvent.change(input, { target: { value: 'Walk every day' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() =>
        expect(mockApiCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Walk', recurrenceRule: { type: 'daily', interval: 1 } }),
        ),
      );
    });

    it('removes the optimistic row and refetches when creation fails', async () => {
      mockApiCreateTask.mockRejectedValueOnce(new Error('boom'));
      renderPage();

      const input = await screen.findByPlaceholderText('New task…');
      fireEvent.change(input, { target: { value: 'Doomed task' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => expect(screen.queryByText('Doomed task')).not.toBeInTheDocument());
      expect(mockFetchInboxTasks.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('does nothing when the input only contains whitespace', async () => {
      renderPage();

      const input = await screen.findByPlaceholderText('New task…');
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => expect(mockApiCreateTask).not.toHaveBeenCalled());
    });

    it('starts a note when the leading key is "-"', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      renderPage();
      await screen.findByText('Buy groceries');

      const input = screen.getByPlaceholderText('New task…');
      fireEvent.keyDown(input, { key: '-' });

      const note = await screen.findByTestId(/^task-item-temp-/);
      expect(screen.getByTestId(`task-type-${note.dataset.taskId}`)).toHaveTextContent('note');
      expect(screen.getByTestId('editing-id')).toHaveTextContent(note.dataset.taskId!);
    });

    it('ignores non-dash keys in the add input', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      renderPage();
      await screen.findByText('Buy groceries');

      const input = screen.getByPlaceholderText('New task…');
      fireEvent.keyDown(input, { key: 'a' });

      expect(screen.queryByTestId(/^task-item-temp-/)).not.toBeInTheDocument();
      expect(mockApiCreateTask).not.toHaveBeenCalled();
    });

    it('committing the temp note creates it with type note', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      mockApiCreateTask.mockResolvedValue(createdTask({ title: 'My note', type: 'note' }));
      renderPage();
      await screen.findByText('Buy groceries');

      const input = screen.getByPlaceholderText('New task…');
      fireEvent.keyDown(input, { key: '-' });
      const note = await screen.findByTestId(/^task-item-temp-/);
      const tempId = note.dataset.taskId!;

      fireEvent.click(screen.getByTestId(`commit-${tempId}`));

      await waitFor(() =>
        expect(mockApiCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Edited title', type: 'note' }),
        ),
      );
      expect(await screen.findByTestId('task-item-created-1')).toBeInTheDocument();
    });

    it('adds a task to a section from the section input, and rolls it back on failure', async () => {
      mockFetchInboxTasks.mockResolvedValue({
        ...baseInboxData,
        inboxCollectionId: 'col-1',
        sections: [section()],
        tasks: sampleTasks,
      });
      mockApiCreateTask.mockResolvedValueOnce(createdTask({ title: 'Section task', sectionId: 'section-1' }));
      mockApiCreateTask.mockRejectedValueOnce(new Error('boom'));
      renderPage();
      await screen.findByLabelText('Work');

      const sectionForm = screen.getAllByPlaceholderText('New task…')[1].closest('form')!;
      fireEvent.change(sectionForm.querySelector('input')!, { target: { value: 'Section task' } });
      fireEvent.submit(sectionForm);

      await waitFor(() =>
        expect(mockApiCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Section task', sectionId: 'section-1' }),
        ),
      );

      fireEvent.change(sectionForm.querySelector('input')!, { target: { value: 'Another' } });
      fireEvent.submit(sectionForm);
      await waitFor(() => expect(screen.queryByText('Another')).not.toBeInTheDocument());
    });

    it('does nothing when submitting an empty section input', async () => {
      mockFetchInboxTasks.mockResolvedValue({
        ...baseInboxData,
        inboxCollectionId: 'col-1',
        sections: [section()],
      });
      renderPage();
      await screen.findByLabelText('Work');

      const sectionForm = screen.getAllByPlaceholderText('New task…')[1].closest('form')!;
      fireEvent.submit(sectionForm);

      expect(mockApiCreateTask).not.toHaveBeenCalled();
      expect(screen.queryByTestId(/^task-item-temp-/)).not.toBeInTheDocument();
    });

    it('does nothing when the section input only contains whitespace', async () => {
      mockFetchInboxTasks.mockResolvedValue({
        ...baseInboxData,
        inboxCollectionId: 'col-1',
        sections: [section()],
      });
      renderPage();
      await screen.findByLabelText('Work');

      const sectionForm = screen.getAllByPlaceholderText('New task…')[1].closest('form')!;
      fireEvent.change(sectionForm.querySelector('input')!, { target: { value: '   ' } });
      fireEvent.submit(sectionForm);

      expect(screen.queryByTestId(/^task-item-temp-/)).not.toBeInTheDocument();
      expect(mockApiCreateTask).not.toHaveBeenCalled();
    });
  });

  describe('editing', () => {
    it('commits an edited title through the API', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      mockApiUpdateTask.mockResolvedValue(undefined);
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('edit-task-1'));
      expect(screen.getByTestId('editing-id')).toHaveTextContent('task-1');

      fireEvent.click(screen.getByTestId('commit-task-1'));
      await waitFor(() =>
        expect(mockApiUpdateTask).toHaveBeenCalledWith('task-1', { title: 'Edited title' }),
      );
      expect(screen.getByTestId('editing-id')).toHaveTextContent('');
    });

    it('deletes the task when the edited title is blanked', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      mockApiDeleteTask.mockResolvedValue(undefined);
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('commit-blank-task-1'));

      await waitFor(() => expect(mockApiDeleteTask).toHaveBeenCalledWith('task-1'));
      expect(screen.queryByTestId('task-item-task-1')).not.toBeInTheDocument();
    });

    it('refetches when the blanked-title delete fails', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      mockApiDeleteTask.mockRejectedValue(new Error('boom'));
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('commit-blank-task-1'));

      await waitFor(() => expect(mockFetchInboxTasks).toHaveBeenCalledTimes(2));
    });

    it('refetches when committing an edited title fails', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      mockApiUpdateTask.mockRejectedValue(new Error('boom'));
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('edit-task-1'));
      fireEvent.click(screen.getByTestId('commit-task-1'));

      await waitFor(() => expect(mockFetchInboxTasks).toHaveBeenCalledTimes(2));
    });

    it('cancelling an edit clears the editing state', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('edit-task-1'));
      expect(screen.getByTestId('editing-id')).toHaveTextContent('task-1');

      fireEvent.click(screen.getByTestId('cancel-edit-task-1'));
      expect(screen.getByTestId('editing-id')).toHaveTextContent('');
      expect(mockApiDeleteTask).not.toHaveBeenCalled();
    });

    it('committing a temp task creates it with its projected position', async () => {
      mockFetchInboxTasks.mockResolvedValue({
        ...baseInboxData,
        inboxCollectionId: 'col-1',
        sections: [section()],
        tasks: [
          { ...sampleTasks[0], sectionId: 'section-1' },
          { ...sampleTasks[1], sectionId: 'section-1', parentTaskId: 'task-1' },
        ],
      });
      mockApiCreateTask.mockResolvedValue(createdTask({ title: 'Edited title', sectionId: 'section-1' }));
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('add-below-task-2'));
      const temp = await screen.findByTestId(/^task-item-temp-/);

      fireEvent.click(screen.getByTestId(`commit-${temp.dataset.taskId}`));
      await waitFor(() =>
        expect(mockApiCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Edited title',
            type: 'task',
            sectionId: 'section-1',
            parentTaskId: 'task-1',
            depth: 0,
          }),
        ),
      );
    });

    it('drops the temp row when committing a new task fails', async () => {
      mockFetchInboxTasks.mockResolvedValue({
        ...baseInboxData,
        inboxCollectionId: 'col-1',
        tasks: sampleTasks,
      });
      mockApiCreateTask.mockRejectedValue(new Error('boom'));
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('add-below-task-1'));
      const temp = await screen.findByTestId(/^task-item-temp-/);

      fireEvent.click(screen.getByTestId(`commit-${temp.dataset.taskId}`));
      await waitFor(() =>
        expect(screen.queryByTestId(/^task-item-temp-/)).not.toBeInTheDocument(),
      );
      expect(screen.getByTestId('task-item-task-1')).toBeInTheDocument();
    });

    it('blank-committing a temp task removes it without any API call', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('add-below-task-1'));
      const temp = await screen.findByTestId(/^task-item-temp-/);
      const tempId = temp.dataset.taskId!;

      fireEvent.click(screen.getByTestId(`commit-blank-${tempId}`));
      expect(screen.queryByTestId(`task-item-${tempId}`)).not.toBeInTheDocument();
      expect(mockApiCreateTask).not.toHaveBeenCalled();
      expect(mockApiDeleteTask).not.toHaveBeenCalled();
    });

    it('cancelling an edit on a temp task removes the row', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('add-below-task-1'));
      const temp = await screen.findByTestId(/^task-item-temp-/);
      const tempId = temp.dataset.taskId!;

      fireEvent.click(screen.getByTestId(`cancel-edit-${tempId}`));
      expect(screen.queryByTestId(`task-item-${tempId}`)).not.toBeInTheDocument();
    });

    it('converts a task to a note via the API', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      mockApiUpdateTask.mockResolvedValue(undefined);
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('convert-task-1'));

      await waitFor(() => expect(mockApiUpdateTask).toHaveBeenCalledWith('task-1', { type: 'note' }));
      expect(screen.getByTestId('task-type-task-1')).toHaveTextContent('note');
    });

    it('converts a temp row locally without an API call', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('add-below-task-1'));
      const temp = await screen.findByTestId(/^task-item-temp-/);
      const tempId = temp.dataset.taskId!;

      fireEvent.click(screen.getByTestId(`convert-${tempId}`));
      expect(screen.getByTestId(`task-type-${tempId}`)).toHaveTextContent('note');
      expect(mockApiUpdateTask).not.toHaveBeenCalled();
    });

    it('refetches when converting a task type fails', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      mockApiUpdateTask.mockRejectedValue(new Error('boom'));
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('convert-task-1'));

      await waitFor(() => expect(mockFetchInboxTasks).toHaveBeenCalledTimes(2));
    });

    it('deletes a task through the API and focuses the previous row', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      mockApiDeleteTask.mockResolvedValue(undefined);
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('delete-task-1'));

      await waitFor(() => expect(mockApiDeleteTask).toHaveBeenCalledWith('task-1'));
      expect(screen.queryByTestId('task-item-task-1')).not.toBeInTheDocument();
      await waitFor(() => expect(document.activeElement?.dataset.taskId).toBe('task-2'));
    });

    it('falls back to focusing the add input when deleting the last task', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: [sampleTasks[0]], collectionId: 'col-1' });
      mockApiDeleteTask.mockResolvedValue(undefined);
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('delete-task-1'));

      await waitFor(() =>
        expect(document.activeElement?.className).toContain('task-add-input'),
      );
    });

    it('deleting a temp row is local-only', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('add-below-task-1'));
      const temp = await screen.findByTestId(/^task-item-temp-/);
      const tempId = temp.dataset.taskId!;

      fireEvent.click(screen.getByTestId(`delete-${tempId}`));
      expect(screen.queryByTestId(`task-item-${tempId}`)).not.toBeInTheDocument();
      expect(mockApiDeleteTask).not.toHaveBeenCalled();
    });

    it('indents a task under its previous sibling and unindents it again', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      mockApiUpdateTask.mockResolvedValue(undefined);
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('indent-task-2'));
      await waitFor(() =>
        expect(mockApiUpdateTask).toHaveBeenCalledWith('task-2', { parentTaskId: 'task-1' }),
      );

      fireEvent.click(screen.getByTestId('unindent-task-2'));
      await waitFor(() =>
        expect(mockApiUpdateTask).toHaveBeenCalledWith('task-2', { parentTaskId: null }),
      );
    });

    it('refetches when an indent update fails', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      mockApiUpdateTask.mockRejectedValue(new Error('boom'));
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('indent-task-2'));

      await waitFor(() => expect(mockFetchInboxTasks).toHaveBeenCalledTimes(2));
    });

    it('does nothing when unindenting a top-level task', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('unindent-task-1'));

      expect(mockApiUpdateTask).not.toHaveBeenCalled();
      expect(screen.getByTestId('task-item-task-1')).toBeInTheDocument();
    });

    it('indents a temp row locally without an API call', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('add-below-task-2'));
      const temp = await screen.findByTestId(/^task-item-temp-/);

      fireEvent.click(screen.getByTestId(`indent-${temp.dataset.taskId}`));

      expect(mockApiUpdateTask).not.toHaveBeenCalled();
      expect(screen.getByTestId(`task-item-${temp.dataset.taskId}`)).toBeInTheDocument();
    });

    it('refetches when deleting a task fails', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      mockApiDeleteTask.mockRejectedValue(new Error('boom'));
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('delete-task-1'));

      await waitFor(() => expect(mockFetchInboxTasks).toHaveBeenCalledTimes(2));
    });
  });

  describe('completion', () => {
    it('toggles a task to completed', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      mockApiToggleTask.mockResolvedValue({ ...sampleTasks[0], isCompleted: true });
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('toggle-task-1'));

      await waitFor(() => expect(mockApiToggleTask).toHaveBeenCalledWith('task-1', true));
    });

    it('toggles before the preferences query resolves', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      mockApiToggleTask.mockResolvedValue({ ...sampleTasks[0], isCompleted: true });
      let resolvePrefs!: (value: unknown) => void;
      mockFetchPreferences.mockReturnValue(
        new Promise((resolve) => {
          resolvePrefs = resolve;
        }),
      );
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('toggle-task-1'));

      await waitFor(() => expect(mockApiToggleTask).toHaveBeenCalledWith('task-1', true));
      resolvePrefs(basePreferences);
    });

    it('toggles a temp row locally without an API call', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('add-below-task-1'));
      const temp = await screen.findByTestId(/^task-item-temp-/);

      fireEvent.click(screen.getByTestId(`toggle-${temp.dataset.taskId}`));

      expect(mockApiToggleTask).not.toHaveBeenCalled();
      expect(screen.getByTestId(`task-item-${temp.dataset.taskId}`)).toBeInTheDocument();
    });

    it('reopens a completed task', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      mockApiToggleTask.mockResolvedValue({ ...sampleTasks[1], isCompleted: false });
      renderPage();

      await screen.findByText('Write tests');
      fireEvent.click(screen.getByTestId('toggle-task-2'));

      await waitFor(() => expect(mockApiToggleTask).toHaveBeenCalledWith('task-2', false));
    });

    it('reverts the optimistic toggle and refetches when the request fails', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      mockApiToggleTask.mockRejectedValueOnce(new Error('boom'));
      renderPage();

      await screen.findByText('Buy groceries');
      fireEvent.click(screen.getByTestId('toggle-task-1'));

      await waitFor(() => expect(mockFetchInboxTasks.mock.calls.length).toBeGreaterThanOrEqual(2));
      expect(screen.getByTestId('task-item-task-1')).toBeInTheDocument();
    });

    it('removes the row when hideCompletedTasks is on and a task is completed', async () => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
      mockFetchPreferences.mockResolvedValue({ ...basePreferences, hideCompletedTasks: true });
      mockApiToggleTask.mockResolvedValue({ ...sampleTasks[0], isCompleted: true });
      renderPage();

      await screen.findByText('Buy groceries');
      await waitFor(() => expect(screen.getByTestId('toggle-task-1')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('toggle-task-1'));

      await waitFor(() => expect(mockApiToggleTask).toHaveBeenCalledWith('task-1', true));
      await waitFor(() =>
        expect(screen.queryByTestId('task-item-task-1')).not.toBeInTheDocument(),
      );
    });
  });

  describe('context menu', () => {
    beforeEach(() => {
      mockFetchInboxTasks.mockResolvedValue({ tasks: sampleTasks, collectionId: 'col-1' });
    });

    it('opens on right-click and inserts a row above and below', async () => {
      renderPage();
      await screen.findByText('Buy groceries');

      fireEvent.click(screen.getByTestId('context-task-1'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Add below' }));
      const below = await screen.findByTestId(/^task-item-temp-/);
      expect(screen.getByTestId('editing-id')).toHaveTextContent(below.dataset.taskId!);

      fireEvent.click(screen.getByTestId(`context-task-1`));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Add above' }));
      await waitFor(() => expect(screen.getAllByTestId(/^task-item-temp-/)).toHaveLength(2));
    });

    it('adds a row above a task that has a previous sibling', async () => {
      renderPage();
      await screen.findByText('Buy groceries');

      fireEvent.click(screen.getByTestId('context-task-2'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Add above' }));

      const above = await screen.findByTestId(/^task-item-temp-/);
      const items = screen.getAllByTestId(/^task-item-/).map((el) => el.dataset.taskId);
      expect(items).toEqual(['task-1', above.dataset.taskId, 'task-2']);
    });

    it('deletes the task from the menu', async () => {
      mockApiDeleteTask.mockResolvedValue(undefined);
      renderPage();
      await screen.findByText('Buy groceries');

      fireEvent.click(screen.getByTestId('context-task-1'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));

      await waitFor(() => expect(mockApiDeleteTask).toHaveBeenCalledWith('task-1'));
      expect(screen.queryByTestId('task-item-task-1')).not.toBeInTheDocument();
    });

    it('moves the task to a collection from the submenu', async () => {
      mockFetchCollections.mockResolvedValue([collection()]);
      mockApiUpdateTask.mockResolvedValue(undefined);
      renderPage();
      await screen.findByText('Buy groceries');

      fireEvent.click(screen.getByTestId('context-task-1'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Collection' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Home' }));

      await waitFor(() =>
        expect(mockApiUpdateTask).toHaveBeenCalledWith('task-1', { collectionId: 'col-home' }),
      );
    });

    it('moves the task back to the inbox from the "No collection" item', async () => {
      mockFetchCollections.mockResolvedValue([
        collection({ id: 'inbox-col', name: 'Inbox', isInbox: true }),
      ]);
      mockApiUpdateTask.mockResolvedValue(undefined);
      renderPage();
      await screen.findByText('Buy groceries');

      fireEvent.click(screen.getByTestId('context-task-1'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Collection' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'No collection' }));

      await waitFor(() =>
        expect(mockApiUpdateTask).toHaveBeenCalledWith('task-1', { collectionId: 'inbox-col' }),
      );
    });

    it('refetches when moving the task to a collection fails', async () => {
      mockFetchCollections.mockResolvedValue([collection()]);
      mockApiUpdateTask.mockRejectedValue(new Error('boom'));
      renderPage();
      await screen.findByText('Buy groceries');

      fireEvent.click(screen.getByTestId('context-task-1'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Collection' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Home' }));

      await waitFor(() => expect(mockFetchInboxTasks).toHaveBeenCalledTimes(2));
    });

    it('refetches when moving the task back to the inbox fails', async () => {
      mockFetchCollections.mockResolvedValue([
        collection({ id: 'inbox-col', name: 'Inbox', isInbox: true }),
      ]);
      mockApiUpdateTask.mockRejectedValue(new Error('boom'));
      renderPage();
      await screen.findByText('Buy groceries');

      fireEvent.click(screen.getByTestId('context-task-1'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Collection' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'No collection' }));

      await waitFor(() => expect(mockFetchInboxTasks).toHaveBeenCalledTimes(2));
    });

    it('does nothing when no inbox collection exists', async () => {
      mockFetchCollections.mockResolvedValue([collection({ isInbox: false })]);
      renderPage();
      await screen.findByText('Buy groceries');

      fireEvent.click(screen.getByTestId('context-task-1'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Collection' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'No collection' }));

      expect(mockApiUpdateTask).not.toHaveBeenCalled();
      expect(screen.getByTestId('task-item-task-1')).toBeInTheDocument();
    });

    it('renames and deletes a section from its context menu', async () => {
      mockFetchInboxTasks.mockResolvedValue({
        ...baseInboxData,
        inboxCollectionId: 'col-1',
        sections: [section()],
        tasks: [{ ...sampleTasks[0], sectionId: 'section-1' }],
      });
      renderPage();

      fireEvent.contextMenu(await screen.findByLabelText('Work'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));
      expect(screen.getByDisplayValue('Work')).toBeInTheDocument();

      fireEvent.contextMenu(screen.getByLabelText('Work'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
      expect(await screen.findByRole('dialog', { name: 'Delete "Work"?' })).toBeInTheDocument();
    });
  });

  describe('sections', () => {
    function sectionedData() {
      return {
        ...baseInboxData,
        inboxCollectionId: 'col-1',
        sections: [section()],
        tasks: [{ ...sampleTasks[0], sectionId: 'section-1' }],
      };
    }

    it('renders section groups sorted by orderValue, after the top-level list', async () => {
      mockFetchInboxTasks.mockResolvedValue({
        ...baseInboxData,
        inboxCollectionId: 'col-1',
        sections: [
          section({ id: 'section-1', name: 'Zeta', orderValue: 5 }),
          section({ id: 'section-2', name: 'Alpha', orderValue: 1 }),
        ],
        tasks: [
          { ...sampleTasks[0], sectionId: 'section-2' },
          { ...sampleTasks[1], sectionId: 'section-1' },
        ],
      });
      renderPage();

      await screen.findByText('Zeta');
      const lists = screen.getAllByTestId(/^task-list-/);
      expect(lists.map((el) => el.dataset.testid)).toEqual([
        'task-list-collection:inbox',
        'task-list-section:section-2',
        'task-list-section:section-1',
      ]);
    });

    it('creates a new section from the "+ New section" row', async () => {
      mockFetchInboxTasks.mockResolvedValue(sectionedData());
      mockApiCreateSection.mockResolvedValue(section({ id: 'created-section', name: 'Chores' }));
      renderPage();
      await screen.findByLabelText('Work');

      fireEvent.click(screen.getByRole('button', { name: /New section/i }));
      const input = screen.getByPlaceholderText('New section');
      fireEvent.change(input, { target: { value: 'Chores' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() =>
        expect(mockApiCreateSection).toHaveBeenCalledWith('col-1', { name: 'Chores' }),
      );
      expect(await screen.findByText('Chores')).toBeInTheDocument();
    });

    it('drops the new section if its creation fails', async () => {
      mockFetchInboxTasks.mockResolvedValue(sectionedData());
      mockApiCreateSection.mockRejectedValueOnce(new Error('boom'));
      renderPage();
      await screen.findByLabelText('Work');

      fireEvent.click(screen.getByRole('button', { name: /New section/i }));
      const input = screen.getByPlaceholderText('New section');
      fireEvent.change(input, { target: { value: 'Chores' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => expect(screen.queryByText('Chores')).not.toBeInTheDocument());
    });

    it('cancels a new section with Escape', async () => {
      mockFetchInboxTasks.mockResolvedValue(sectionedData());
      renderPage();
      await screen.findByLabelText('Work');

      fireEvent.click(screen.getByRole('button', { name: /New section/i }));
      const input = screen.getByPlaceholderText('New section');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(screen.queryByPlaceholderText('New section')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /New section/i })).toBeInTheDocument();
    });

    it('removes a new section when its name is committed empty', async () => {
      mockFetchInboxTasks.mockResolvedValue(sectionedData());
      renderPage();
      await screen.findByLabelText('Work');

      fireEvent.click(screen.getByRole('button', { name: /New section/i }));
      const input = screen.getByPlaceholderText('New section');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.queryByPlaceholderText('New section')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /New section/i })).toBeInTheDocument();
      expect(mockApiCreateSection).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Work')).toBeInTheDocument();
    });

    it('does nothing when there is no inbox collection', async () => {
      mockFetchInboxTasks.mockResolvedValue({ ...baseInboxData, tasks: sampleTasks });
      renderPage();
      await screen.findByText('Buy groceries');

      fireEvent.click(screen.getByRole('button', { name: /New section/i }));

      expect(screen.queryByPlaceholderText('New section')).not.toBeInTheDocument();
      expect(mockApiCreateSection).not.toHaveBeenCalled();
    });

    it('renames a section in place via the API', async () => {
      mockFetchInboxTasks.mockResolvedValue(sectionedData());
      mockApiUpdateSection.mockResolvedValue(section({ name: 'Work renamed' }));
      renderPage();

      fireEvent.doubleClick(await screen.findByText('Work'));
      const input = screen.getByDisplayValue('Work');
      fireEvent.change(input, { target: { value: 'Work renamed' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() =>
        expect(mockApiUpdateSection).toHaveBeenCalledWith('section-1', { name: 'Work renamed' }),
      );
      expect(await screen.findByText('Work renamed')).toBeInTheDocument();
    });

    it('cancels renaming an existing section with Escape', async () => {
      mockFetchInboxTasks.mockResolvedValue(sectionedData());
      renderPage();

      fireEvent.doubleClick(await screen.findByText('Work'));
      const input = screen.getByDisplayValue('Work');
      fireEvent.change(input, { target: { value: 'Work 2' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(screen.queryByDisplayValue('Work 2')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Work')).toBeInTheDocument();
      expect(mockApiUpdateSection).not.toHaveBeenCalled();
    });

    it('keeps the new name when the rename API call fails', async () => {
      mockFetchInboxTasks.mockResolvedValue(sectionedData());
      mockApiUpdateSection.mockRejectedValue(new Error('boom'));
      renderPage();

      fireEvent.doubleClick(await screen.findByText('Work'));
      const input = screen.getByDisplayValue('Work');
      fireEvent.change(input, { target: { value: 'Work renamed' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => expect(mockApiUpdateSection).toHaveBeenCalledWith('section-1', { name: 'Work renamed' }));
      expect(screen.getByLabelText('Work renamed')).toBeInTheDocument();
    });

    it('opens the delete dialog from the section options button', async () => {
      mockFetchInboxTasks.mockResolvedValue(sectionedData());
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Options for section Work' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Delete section' }));

      const dialog = await screen.findByRole('dialog', { name: 'Delete "Work"?' });
      expect(dialog).toHaveTextContent('This section has 1 task(s). What should happen to them?');
    });

    it('deletes the section and its tasks from the dialog', async () => {
      mockFetchInboxTasks.mockResolvedValue(sectionedData());
      mockApiDeleteTask.mockResolvedValue(undefined);
      mockApiDeleteSection.mockResolvedValue(undefined);
      renderPage();

      fireEvent.doubleClick(await screen.findByText('Work'));
      const input = screen.getByDisplayValue('Work');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      fireEvent.click(
        await screen.findByRole('button', { name: 'Delete section and tasks' }),
      );

      await waitFor(() => expect(mockApiDeleteTask).toHaveBeenCalledWith('task-1'));
      await waitFor(() => expect(mockApiDeleteSection).toHaveBeenCalledWith('section-1'));
      expect(screen.queryByText('Work')).not.toBeInTheDocument();
      expect(screen.queryByTestId('task-item-task-1')).not.toBeInTheDocument();
    });

    it('refetches when deleting a section fails', async () => {
      mockFetchInboxTasks.mockImplementation(async () => sectionedData());
      mockApiDeleteTask.mockRejectedValue(new Error('boom'));
      renderPage();
      await screen.findByLabelText('Work');

      fireEvent.doubleClick(screen.getByText('Work'));
      const input = screen.getByDisplayValue('Work');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      fireEvent.click(await screen.findByRole('button', { name: 'Delete section and tasks' }));

      await waitFor(() => expect(mockFetchInboxTasks).toHaveBeenCalledTimes(2));
    });

    it('moves the tasks to the top level from the dialog', async () => {
      mockFetchInboxTasks.mockResolvedValue(sectionedData());
      mockApiDeleteSection.mockResolvedValue(undefined);
      renderPage();

      fireEvent.doubleClick(await screen.findByText('Work'));
      const input = screen.getByDisplayValue('Work');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      fireEvent.click(await screen.findByRole('button', { name: 'Move tasks to top-level' }));

      await waitFor(() => expect(mockApiDeleteSection).toHaveBeenCalledWith('section-1'));
      expect(screen.queryByText('Work')).not.toBeInTheDocument();
      expect(screen.getByTestId('task-item-task-1')).toBeInTheDocument();
      expect(taskListCalls('collection:inbox').at(-1)![0].tasks.map((t) => t.id)).toContain('task-1');
    });

    it('keeps unrelated tasks in place when moving section tasks to the top level', async () => {
      mockFetchInboxTasks.mockResolvedValue({
        ...baseInboxData,
        inboxCollectionId: 'col-1',
        sections: [section()],
        tasks: [{ ...sampleTasks[0], sectionId: 'section-1' }, sampleTasks[1]],
      });
      mockApiDeleteSection.mockResolvedValue(undefined);
      renderPage();

      fireEvent.doubleClick(await screen.findByText('Work'));
      const input = screen.getByDisplayValue('Work');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      fireEvent.click(await screen.findByRole('button', { name: 'Move tasks to top-level' }));

      await waitFor(() => expect(mockApiDeleteSection).toHaveBeenCalledWith('section-1'));
      const ids = taskListCalls('collection:inbox').at(-1)![0].tasks.map((t) => t.id);
      expect(ids).toContain('task-1');
      expect(ids).toContain('task-2');
    });

    it('refetches when moving tasks to the top level fails', async () => {
      mockFetchInboxTasks.mockResolvedValue(sectionedData());
      mockApiDeleteSection.mockRejectedValue(new Error('boom'));
      renderPage();

      fireEvent.doubleClick(await screen.findByText('Work'));
      const input = screen.getByDisplayValue('Work');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      fireEvent.click(await screen.findByRole('button', { name: 'Move tasks to top-level' }));

      await waitFor(() => expect(mockFetchInboxTasks).toHaveBeenCalledTimes(2));
    });

    it('shows the empty-section dialog without a delete-tasks option, and Escape closes it', async () => {
      mockFetchInboxTasks.mockResolvedValue({
        ...baseInboxData,
        inboxCollectionId: 'col-1',
        sections: [section({ id: 'section-2', name: 'Empty' })],
      });
      renderPage();

      fireEvent.doubleClick(await screen.findByText('Empty'));
      const input = screen.getByDisplayValue('Empty');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      const dialog = await screen.findByRole('dialog', { name: 'Delete "Empty"?' });
      expect(dialog).toHaveTextContent('This section is empty. Delete it?');
      expect(screen.queryByRole('button', { name: 'Delete section and tasks' })).not.toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('asks what to do with tasks when a populated section name is blanked', async () => {
      mockFetchInboxTasks.mockResolvedValue(sectionedData());
      renderPage();

      fireEvent.doubleClick(await screen.findByText('Work'));
      const input = screen.getByDisplayValue('Work');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(await screen.findByRole('dialog', { name: 'Delete "Work"?' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete section and tasks' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Move tasks to top-level' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(mockApiDeleteTask).not.toHaveBeenCalled();
      expect(mockApiDeleteSection).not.toHaveBeenCalled();
    });
  });

  describe('view modes', () => {
    it('renders the kanban board when the saved preference says so', async () => {
      mockFetchInboxTasks.mockResolvedValue({
        ...baseInboxData,
        inboxCollectionId: 'col-1',
        tasks: sampleTasks,
      });
      mockFetchPreferences.mockResolvedValue({
        ...basePreferences,
        boardViewModes: { 'col-1': { view: 'kanban' } },
      });
      renderPage();

      const board = await screen.findByTestId('collection-board');
      expect(board).toHaveAttribute('data-collection-id', 'col-1');
      expect(board).toHaveAttribute('data-group-by', 'status');
      expect(screen.queryByTestId('task-list-collection:inbox')).not.toBeInTheDocument();
    });

    it('switches to the kanban view from the toolbar and persists the preference', async () => {
      mockFetchInboxTasks.mockResolvedValue({
        ...baseInboxData,
        inboxCollectionId: 'col-1',
        tasks: sampleTasks,
      });
      mockApiUpdatePreferences.mockResolvedValue({
        ...basePreferences,
        boardViewModes: { 'col-1': { view: 'kanban' } },
      });
      renderPage();
      await screen.findByText('Buy groceries');
      const hideOldNotes = await screen.findByRole('button', { name: 'Hide old notes' });
      await waitFor(() => expect(hideOldNotes).not.toBeDisabled());

      const kanbanButton = screen.getByRole('button', { name: 'Kanban' });
      fireEvent.click(kanbanButton);

      await waitFor(() =>
        expect(mockApiUpdatePreferences).toHaveBeenCalledWith({
          boardViewModes: { 'col-1': { view: 'kanban' } },
        }),
      );
      expect(await screen.findByTestId('collection-board')).toBeInTheDocument();
    });

    it('toggles a task from the kanban board', async () => {
      mockFetchInboxTasks.mockResolvedValue({
        ...baseInboxData,
        inboxCollectionId: 'col-1',
        tasks: sampleTasks,
      });
      mockFetchPreferences.mockResolvedValue({
        ...basePreferences,
        boardViewModes: { 'col-1': { view: 'kanban' } },
      });
      renderPage();

      const board = await screen.findByTestId('collection-board');
      expect(board).toHaveAttribute('data-collection-id', 'col-1');

      fireEvent.click(screen.getByTestId('board-toggle-task-1'));
      await waitFor(() => expect(mockApiToggleTask).toHaveBeenCalledWith('task-1', true));
    });

    it('renders status groups with counts and the add form after the first group', async () => {
      mockFetchInboxTasks.mockResolvedValue({
        ...baseInboxData,
        inboxCollectionId: 'col-1',
        statuses: [
          status(),
          status({ id: 'st-2', name: 'Done', color: '#c9483b', orderValue: 1 }),
        ],
        completionStatusId: 'st-2',
        tasks: [
          sampleTasks[0],
          { ...sampleTasks[1], parentTaskId: 'task-1' },
          { ...createdTask({ id: 'task-3', title: 'Shipped', statusId: 'st-2' }) },
        ],
      });
      mockApiCreateTask.mockResolvedValue(createdTask({ title: 'Ship it' }));
      renderPage();

      await screen.findByRole('heading', { name: 'Backlog' });
      const headings = screen.getAllByRole('heading');
      expect(headings.map((h) => h.textContent)).toEqual(['Inbox', 'Backlog', 'Done']);

      await waitFor(() => expect(taskListCalls('status:st-1').length).toBeGreaterThan(0));
      const backlogTasks = taskListCalls('status:st-1').at(-1)![0].tasks.map((t) => t.id);
      expect(backlogTasks).toEqual(expect.arrayContaining(['task-1', 'task-2']));

      const doneTasks = taskListCalls('status:st-2').at(-1)![0].tasks.map((t) => t.id);
      expect(doneTasks).toEqual(['task-3']);

      const input = screen.getByPlaceholderText('New task…');
      fireEvent.change(input, { target: { value: 'Ship it' } });
      fireEvent.submit(input.closest('form')!);
      await waitFor(() =>
        expect(mockApiCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Ship it' }),
        ),
      );
    });
  });

  describe('sync and drag wiring', () => {
    it('refetches the inbox on a task sync event, but ignores other entities', async () => {
      renderPage();
      await screen.findByText('Inbox');
      expect(mockFetchInboxTasks).toHaveBeenCalledTimes(1);

      const handler = mockUseSync.mock.calls.at(-1)![0];
      await act(async () => handler({ entityType: 'task', entityId: 'task-1', payload: {} }));
      await waitFor(() => expect(mockFetchInboxTasks).toHaveBeenCalledTimes(2));

      await act(async () => handler({ entityType: 'section', entityId: 'section-1', payload: {} }));
      expect(mockFetchInboxTasks).toHaveBeenCalledTimes(2);
    });

    it('skips the refetch when the event echoes an in-flight move', async () => {
      trackMove(['task-1']);
      renderPage();
      await screen.findByText('Inbox');
      expect(mockFetchInboxTasks).toHaveBeenCalledTimes(1);

      const handler = mockUseSync.mock.calls.at(-1)![0];
      await act(async () => handler({ entityType: 'task', entityId: 'task-1', payload: {} }));
      expect(mockFetchInboxTasks).toHaveBeenCalledTimes(1);

      resetTrackedMoves();
    });

    it('refetches on drag errors and invalidates collections when a task leaves', async () => {
      renderPage();
      await screen.findByText('Inbox');
      expect(mockFetchInboxTasks).toHaveBeenCalledTimes(1);

      await act(async () => latestDragOptions().onError());
      await waitFor(() => expect(mockFetchInboxTasks).toHaveBeenCalledTimes(2));

      await act(async () => latestDragOptions().onMoved());
      await act(async () => latestSectionDragOptions().onError());
      await waitFor(() => expect(mockFetchInboxTasks).toHaveBeenCalledTimes(3));
    });
  });

  it('focuses the add input when clicking the page background', async () => {
    const { container } = renderPage();

    fireEvent.click(container.querySelector('.inbox-page')!);
    await waitFor(() =>
      expect(document.activeElement?.className).toContain('task-add-input'),
    );
  });
});