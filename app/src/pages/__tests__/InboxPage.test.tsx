import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InboxPage } from '../InboxPage';
import {
  fetchInboxTasks,
  apiCreateTask,
  apiUpdateTask,
  apiToggleTask,
  apiDeleteTask,
  fetchPreferences,
  type Preferences,
  type ApiTask,
} from '../../api/client';

const mockFetchInboxTasks = vi.mocked(fetchInboxTasks);
const mockApiCreateTask = vi.mocked(apiCreateTask);
const mockApiUpdateTask = vi.mocked(apiUpdateTask);
const mockApiToggleTask = vi.mocked(apiToggleTask);
const mockApiDeleteTask = vi.mocked(apiDeleteTask);
const mockFetchPreferences = vi.mocked(fetchPreferences);

const basePreferences: Preferences = {
  userId: 'user-1',
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
};

const baseInboxData: { tasks: ApiTask[]; collectionId: string | null } = {
  tasks: [],
  collectionId: null,
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

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchInboxTasks: vi.fn(),
  apiCreateTask: vi.fn(),
  apiUpdateTask: vi.fn(),
  apiToggleTask: vi.fn(),
  apiDeleteTask: vi.fn(),
  fetchPreferences: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock('../../hooks/useTaskDrag', () => ({
  useTaskDrag: vi.fn(() => ({ activeDragId: null })),
}));

vi.mock('../../hooks/useSync', () => ({
  useSync: vi.fn(),
}));

vi.mock('../../utils/phrases', () => ({
  getPhrase: vi.fn(() => 'Dump it here. Sort it later.'),
}));

vi.mock('../../components/TaskList', () => ({
  TaskList: vi.fn(({ tasks, onTaskToggle, onIndent, onDelete }) => (
    <div data-testid="task-list">
      {tasks.map((t: { id: string; title: string; isCompleted: boolean }) => (
        <div key={t.id} data-testid={`task-item-${t.id}`}>
          <span>{t.title}</span>
          <button
            data-testid={`toggle-${t.id}`}
            onClick={() => onTaskToggle?.(t.id)}
          >
            {t.isCompleted ? 'uncomplete' : 'complete'}
          </button>
          <button
            data-testid={`indent-${t.id}`}
            onClick={() => onIndent?.(t.id, 1)}
          >
            indent
          </button>
          <button
            data-testid={`delete-${t.id}`}
            onClick={() => onDelete?.(t.id)}
          >
            delete
          </button>
        </div>
      ))}
    </div>
  )),
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

beforeEach(() => {
  mockFetchInboxTasks.mockReset();
  mockApiCreateTask.mockReset();
  mockApiUpdateTask.mockReset();
  mockApiToggleTask.mockReset();
  mockApiDeleteTask.mockReset();
  mockFetchPreferences.mockReset();
  mockFetchInboxTasks.mockResolvedValue(baseInboxData);
  mockFetchPreferences.mockResolvedValue(basePreferences);
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
    expect(screen.getByPlaceholderText('Add task…')).toBeInTheDocument();
    expect(screen.getByTestId('task-list').children).toHaveLength(0);
  });

  it('renders the header with Inbox title and a phrase', async () => {
    renderPage();

    expect(screen.getByText('Inbox')).toBeInTheDocument();
    expect(await screen.findByText('Dump it here. Sort it later.')).toBeInTheDocument();
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

    expect(await screen.findByPlaceholderText('Add task…')).toBeInTheDocument();
  });
});
