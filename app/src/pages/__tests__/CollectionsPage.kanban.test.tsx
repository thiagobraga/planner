import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
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

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/collection/${collectionId}`]}>
        <Routes>
          <Route path="/collection/:id" element={<CollectionsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
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

  it('mounts the shared board with the local view and saved group', async () => {
    window.localStorage.setItem('planner.boardViews.v1', JSON.stringify({ [collectionId]: 'kanban' }));
    const { container } = renderPage();

    expect(await screen.findByTestId('collection-board')).toHaveAttribute('data-group-by', 'priority');
    expect(screen.queryByTestId('task-list')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(container.querySelector('.board-group-select')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kanban cards' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('uses the same grouping controls for a persisted Kanban lists view', async () => {
    window.localStorage.setItem('planner.boardViews.v1', JSON.stringify({ [collectionId]: 'kanban-list' }));
    const { container } = renderPage();

    expect(await screen.findByTestId('collection-board')).toHaveAttribute('data-presentation', 'kanban-list');
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(container.querySelector('.board-group-select')).toBeInTheDocument();
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

    renderPage();

    expect(await screen.findByTestId('task-list')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Backlog' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('collection-board')).not.toBeInTheDocument();
  });
});
