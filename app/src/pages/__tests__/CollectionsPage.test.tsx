import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, it, expect, beforeEach } from 'vitest';
import { CollectionsPage } from '../CollectionsPage';
import {
  fetchCollectionView,
  fetchCollections,
  fetchPreferences,
  apiCreateTask,
  apiToggleTask,
  apiUpdateTask,
  apiDeleteTask,
} from '../../api/client';

const mockFetchCollectionView = vi.mocked(fetchCollectionView);
const mockFetchCollections = vi.mocked(fetchCollections);
const mockFetchPreferences = vi.mocked(fetchPreferences);
const mockApiCreateTask = vi.mocked(apiCreateTask);
const mockApiToggleTask = vi.mocked(apiToggleTask);
const mockApiUpdateTask = vi.mocked(apiUpdateTask);
const mockApiDeleteTask = vi.mocked(apiDeleteTask);

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchCollectionView: vi.fn(),
  fetchCollections: vi.fn(),
  fetchPreferences: vi.fn(),
  apiCreateTask: vi.fn(),
  apiToggleTask: vi.fn(),
  apiUpdateTask: vi.fn(),
  apiDeleteTask: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock('../../hooks/useTaskDrag', () => ({
  useTaskDrag: vi.fn(() => ({ activeDragId: null })),
}));

vi.mock('../../components/TaskList', () => ({
  TaskList: ({ tasks }: { tasks: { title: string }[] }) => (
    <div data-testid="task-list">
      {tasks.map((t, i) => (
        <div key={i}>{t.title}</div>
      ))}
    </div>
  ),
}));

const collectionViewData = {
  collection: { id: 'test-collection-id', name: 'Test Collection', color: 'berry_red', isInbox: false },
  tasks: [
    {
      id: 'task-1',
      title: 'Task 1',
      collectionId: 'test-collection-id',
      priority: 4,
      isCompleted: false,
      orderValue: 1,
      type: 'task' as const,
    },
  ],
  collectionId: 'test-collection-id',
};

const defaultPreferences = {
  userId: 'user-1',
  timeZone: 'UTC',
  weekStart: 'monday' as const,
  theme: 'light' as const,
  notificationsEnabled: false,
  font: 'lora' as const,
  showDots: true,
  background: 'beige' as const,
  smallCaps: false,
  hideCompletedTasks: false,
  hideOldNotes: false,
};

function renderPage(initialPath = '/collection/test-collection-id') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/collection/:id" element={<CollectionsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockFetchCollectionView.mockReset();
  mockFetchCollections.mockReset();
  mockFetchPreferences.mockReset();
  mockApiCreateTask.mockReset();
  mockApiToggleTask.mockReset();
  mockApiUpdateTask.mockReset();
  mockApiDeleteTask.mockReset();

  mockFetchCollectionView.mockResolvedValue(collectionViewData);
  mockFetchCollections.mockResolvedValue([]);
  mockFetchPreferences.mockResolvedValue(defaultPreferences);
});

describe('CollectionsPage', () => {
  it('renders the collection name in the breadcrumb', async () => {
    renderPage();

    expect(await screen.findByText('Test Collection')).toBeInTheDocument();
  });

  it('does not render Inbox header', async () => {
    renderPage();

    await screen.findByText('Test Collection');
    expect(screen.queryByText('Inbox')).not.toBeInTheDocument();
  });

  it('renders add task input', async () => {
    renderPage();

    const input = await screen.findByPlaceholderText('Add task…');
    expect(input).toBeInTheDocument();
  });

  it('uses the collection id from URL params', async () => {
    renderPage();

    await screen.findByText('Test Collection');
    expect(mockFetchCollectionView).toHaveBeenCalledWith('test-collection-id');
  });
});
