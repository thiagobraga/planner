import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionsPage } from '../CollectionsPage';
import { fetchCollectionView, fetchCollections, fetchPreferences } from '../../api/client';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchCollectionView: vi.fn(),
  fetchCollections: vi.fn(),
  fetchPreferences: vi.fn(),
  apiUpdatePreferences: vi.fn(),
  fetchSavedColors: vi.fn().mockResolvedValue([]),
  apiAddSavedColor: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock('../../hooks/useTaskDrag', () => ({
  useTaskDrag: vi.fn(() => ({ activeDragId: null })),
}));

vi.mock('../../hooks/useSectionDrag', () => ({
  useSectionDrag: vi.fn(),
}));

vi.mock('../../components/TaskList', () => ({
  TaskList: () => <div data-testid="task-list" />,
}));

vi.mock('../../components/board/CollectionBoard', () => ({
  CollectionBoard: ({ groupBy, presentation }: { groupBy: string; presentation?: string }) => (
    <div data-testid="collection-board" data-group-by={groupBy} data-presentation={presentation} />
  ),
}));

const collectionId = '29eb35a4-7d34-4981-a67d-476d3cbddad8';

async function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/collection/${collectionId}`]}>
          <Routes>
            <Route path="/collection/:id" element={<CollectionsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

describe('CollectionsPage kanban wiring', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(fetchCollectionView).mockResolvedValue({
      collection: { id: collectionId, name: 'Kanban Lab', color: '#c98079', isInbox: false },
      collectionId,
      tasks: [],
      sections: [],
      statuses: [],
      completionStatusId: null,
      boardOrder: {},
    });
    vi.mocked(fetchCollections).mockResolvedValue([]);
    vi.mocked(fetchPreferences).mockResolvedValue({
      userId: 'user-1',
      locale: 'en',
      timeZone: 'UTC',
      weekStart: 'monday',
      theme: 'light',
      notificationsEnabled: false,
      font: 'lora',
      showDots: true,
      background: 'beige',
      smallCaps: false,
      hideCompletedTasks: false,
      showNotes: true,
      collapsedCollectionIds: [],
      boardViewModes: { [collectionId]: { groupBy: 'priority' } },
    });
  });

  function withMode(mode: Record<string, string>) {
    vi.mocked(fetchPreferences).mockResolvedValue({
      userId: 'user-1', locale: 'en', timeZone: 'UTC', weekStart: 'monday', theme: 'light',
      notificationsEnabled: false, font: 'lora', showDots: true, background: 'beige', smallCaps: false,
      hideCompletedTasks: true, showNotes: true, collapsedCollectionIds: [],
      boardViewModes: { [collectionId]: mode },
    });
  }

  it('mounts the shared board with the saved layout, style and group', async () => {
    withMode({ layout: 'columns', style: 'cards', groupBy: 'priority' });
    await renderPage();

    const board = await screen.findByTestId('collection-board');
    expect(board).toHaveAttribute('data-group-by', 'priority');
    expect(board).toHaveAttribute('data-presentation', 'kanban');
    expect(screen.queryByTestId('task-list')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Group: Priority' })).toBeInTheDocument();
    expect(fetchCollectionView).toHaveBeenLastCalledWith(collectionId, { includeCompleted: false });
  });

  it('asks for completed tasks when the columns are grouped by status', async () => {
    withMode({ layout: 'columns', groupBy: 'status' });
    await renderPage();

    expect(await screen.findByTestId('collection-board')).toHaveAttribute('data-presentation', 'kanban-list');
    expect(fetchCollectionView).toHaveBeenLastCalledWith(collectionId, { includeCompleted: true });
  });

  it('hides the grouping menu on List', async () => {
    withMode({ layout: 'list', groupBy: 'priority' });
    await renderPage();

    await screen.findByRole('button', { name: 'View' });
    expect(screen.queryByRole('button', { name: /^Group:/ })).not.toBeInTheDocument();
  });

  it('ignores the status groupBy preference and lists by section after switching to list', async () => {
    vi.mocked(fetchCollectionView).mockResolvedValue({
      collection: { id: collectionId, name: 'Kanban Lab', color: '#c98079', isInbox: false },
      collectionId,
      tasks: [{
        id: 'task-1', title: 'Design board columns', priority: 4, collectionId,
        statusId: 'backlog', isCompleted: false, orderValue: 1000, type: 'task',
      }],
      sections: [],
      statuses: [{
        id: 'backlog', collectionId, name: 'Backlog', color: '#adb9c1',
        orderValue: 0, createdAt: '', updatedAt: '',
      }],
      completionStatusId: 'backlog',
      boardOrder: {},
    });
    vi.mocked(fetchPreferences).mockResolvedValue({
      userId: 'user-1', locale: 'en', timeZone: 'UTC', weekStart: 'monday', theme: 'light',
      notificationsEnabled: false, font: 'lora', showDots: true, background: 'beige',
      smallCaps: false, hideCompletedTasks: false, showNotes: true,
      collapsedCollectionIds: [],
      boardViewModes: { [collectionId]: { view: 'list', groupBy: 'status' } },
    });

    await renderPage();

    expect(await screen.findByTestId('task-list')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Backlog' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('collection-board')).not.toBeInTheDocument();
  });
});
