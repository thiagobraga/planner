import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DailyPage } from '../DailyPage';
import {
  fetchDailyTimeline,
  fetchPreferences,
  fetchCollections,
  apiCreateTask,
  type ApiTask,
  type Preferences,
  type ApiCollection,
} from '../../api/client';

const mockFetchDailyTimeline = vi.mocked(fetchDailyTimeline);
const mockFetchPreferences = vi.mocked(fetchPreferences);
const mockFetchCollections = vi.mocked(fetchCollections);
const mockCreateTask = vi.mocked(apiCreateTask);

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchDailyTimeline: vi.fn(),
  fetchPreferences: vi.fn(),
  fetchCollections: vi.fn(),
  apiCreateTask: vi.fn(),
  apiToggleTask: vi.fn(),
  apiUpdateTask: vi.fn(),
  apiDeleteTask: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock('../../hooks/useTaskDrag', () => ({
  useTaskDrag: () => ({ activeDragId: null }),
}));

vi.mock('../../hooks/useSync', () => ({
  useSync: vi.fn(),
}));

vi.mock('../../utils/phrases', () => ({
  getPhrase: () => 'Make today count',
}));

/**
 * Unlike the display-only mock in `DailyPage.test.tsx`, this one exposes the
 * row callbacks so a test can drive the real add-below/commit sequence.
 */
vi.mock('../../components/TaskList', () => ({
  TaskList: ({
    tasks,
    onAddBelow,
    onEditCommit,
  }: {
    tasks: { id: string; title: string }[];
    onAddBelow?: (id: string) => void;
    onEditCommit?: (id: string, title: string) => void;
  }) => (
    <div data-testid="task-list">
      {tasks.map((t) => (
        <div key={t.id} data-testid={`task-${t.id}`}>
          {t.title}
          <button data-testid={`add-below-${t.id}`} onClick={() => onAddBelow?.(t.id)}>
            add below
          </button>
          <button
            data-testid={`commit-${t.id}`}
            onClick={() => onEditCommit?.(t.id, 'Written under this day')}
          >
            commit
          </button>
        </div>
      ))}
    </div>
  ),
}));

const basePreferences: Preferences = {
  userId: 'user-1',
  locale: 'en',
  timeZone: 'UTC',
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

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);

function dateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const todayKey = dateKey(today);
const yesterdayKey = dateKey(yesterday);

const overdueTask: ApiTask = {
  id: 'task-overdue-1',
  title: 'Overdue task',
  priority: 4,
  collectionId: 'col-1',
  isCompleted: false,
  orderValue: 0,
  depth: 0,
  type: 'task',
  dueDate: yesterdayKey,
};

const todayTask: ApiTask = {
  id: 'task-today-1',
  title: 'Today task',
  priority: 4,
  collectionId: 'col-1',
  isCompleted: false,
  orderValue: 0,
  depth: 0,
  type: 'task',
  dueDate: todayKey,
  createdAt: new Date().toISOString(),
};

const mockCollections: ApiCollection[] = [
  {
    id: 'col-1',
    userId: 'user-1',
    parentId: null,
    name: 'Work',
    color: 'blue',
    isInbox: false,
    isArchived: false,
    orderValue: 0,
    createdAt: '',
    updatedAt: '',
  },
];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DailyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchDailyTimeline.mockImplementation((start, end) => Promise.resolve({
    start,
    end,
    days: [
      ...(start <= yesterdayKey && yesterdayKey <= end
        ? [{ date: yesterdayKey, tasks: [overdueTask] }]
        : []),
      ...(start <= todayKey && todayKey <= end
        ? [{ date: todayKey, tasks: [todayTask] }]
        : []),
    ],
  }));
  mockFetchPreferences.mockResolvedValue(basePreferences);
  mockFetchCollections.mockResolvedValue(mockCollections);
  mockCreateTask.mockResolvedValue({ ...todayTask, id: 'created-1' });
});

describe('DailyPage - the day a new row is created under', () => {
  it('saves a row added under an earlier day with that day, not today', async () => {
    renderPage();

    fireEvent.click(await screen.findByTestId('add-below-task-overdue-1'));

    const tempRow = await screen.findByTestId(/^commit-temp-/);
    fireEvent.click(tempRow);

    await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
    expect(mockCreateTask.mock.calls[0][0]).toMatchObject({
      title: 'Written under this day',
      dueDate: yesterdayKey,
    });
  });

  it('still saves a row added under today with today', async () => {
    renderPage();

    fireEvent.click(await screen.findByTestId('add-below-task-today-1'));

    const tempRow = await screen.findByTestId(/^commit-temp-/);
    fireEvent.click(tempRow);

    await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
    expect(mockCreateTask.mock.calls[0][0]).toMatchObject({ dueDate: todayKey });
  });
});
