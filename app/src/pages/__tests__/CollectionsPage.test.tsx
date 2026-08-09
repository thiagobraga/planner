import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollectionsPage } from '../CollectionsPage';
import {
  fetchCollectionView,
  fetchCollections,
  fetchPreferences,
  apiCreateTask,
  apiToggleTask,
  apiUpdateTask,
  apiDeleteTask,
  apiUpdatePreferences,
  apiUpdateCollection,
  fetchSavedColors,
  apiAddSavedColor,
} from '../../api/client';

const mockFetchCollectionView = vi.mocked(fetchCollectionView);
const mockFetchCollections = vi.mocked(fetchCollections);
const mockFetchPreferences = vi.mocked(fetchPreferences);
const mockApiCreateTask = vi.mocked(apiCreateTask);
const mockApiToggleTask = vi.mocked(apiToggleTask);
const mockApiUpdateTask = vi.mocked(apiUpdateTask);
const mockApiDeleteTask = vi.mocked(apiDeleteTask);
const mockApiUpdatePreferences = vi.mocked(apiUpdatePreferences);
const mockApiUpdateCollection = vi.mocked(apiUpdateCollection);
const mockFetchSavedColors = vi.mocked(fetchSavedColors);
const mockApiAddSavedColor = vi.mocked(apiAddSavedColor);

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchCollectionView: vi.fn(),
  fetchCollections: vi.fn(),
  fetchPreferences: vi.fn(),
  apiCreateTask: vi.fn(),
  apiToggleTask: vi.fn(),
  apiUpdateTask: vi.fn(),
  apiDeleteTask: vi.fn(),
  apiUpdatePreferences: vi.fn(),
  apiUpdateCollection: vi.fn(),
  apiCreateCollection: vi.fn(),
  apiDeleteCollection: vi.fn(),
  fetchSavedColors: vi.fn(),
  apiAddSavedColor: vi.fn(),
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
  TaskList: ({ tasks }: { tasks: { title: string }[] }) => (
    <div data-testid="task-list">
      {tasks.map((t, i) => (
        <div key={i}>{t.title}</div>
      ))}
    </div>
  ),
}));

const collectionViewData = {
  collection: { id: 'test-collection-id', name: 'Test Collection', color: '#d56b64', isInbox: false },
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
  mockApiUpdatePreferences.mockReset();
  mockApiUpdateCollection.mockReset();
  mockFetchSavedColors.mockReset();
  mockApiAddSavedColor.mockReset();

  mockFetchCollectionView.mockResolvedValue(collectionViewData);
  mockFetchCollections.mockResolvedValue([]);
  mockFetchPreferences.mockResolvedValue(defaultPreferences);
  mockFetchSavedColors.mockResolvedValue([]);
  mockApiAddSavedColor.mockResolvedValue([]);
});

const parentCollection = {
  id: 'parent-id',
  userId: 'u1',
  name: 'Parent',
  color: '#7dbfb2',
  parentId: null,
  isInbox: false,
  isArchived: false,
  orderValue: 0,
  createdAt: '',
  updatedAt: '',
};

const childCollection = {
  ...parentCollection,
  id: 'test-collection-id',
  name: 'Test Collection',
  color: '#d56b64',
  parentId: 'parent-id',
  orderValue: 1,
};

describe('CollectionsPage', () => {
  it('renders the collection name in the breadcrumb', async () => {
    renderPage();

    const title = await screen.findByText('Test Collection');
    const header = title.closest('header');

    expect(header).toBeInTheDocument();
    expect(header).toContainElement(screen.getByRole('button', { name: 'Hide completed tasks' }));
    expect(header).toContainElement(screen.getByRole('button', { name: 'Hide old notes' }));
    expect(screen.getByRole('button', { name: 'Hide old notes' }).closest('.page-header-toolbar')).toHaveClass('absolute', 'right-0');
  });

  it('updates completed-task visibility from the header toolbar', async () => {
    mockApiUpdatePreferences.mockResolvedValue({ ...defaultPreferences, hideCompletedTasks: true });
    renderPage();

    const button = await screen.findByRole('button', { name: 'Hide completed tasks' });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    await waitFor(() =>
      expect(mockApiUpdatePreferences).toHaveBeenCalledWith({ hideCompletedTasks: true }),
    );
    expect(await screen.findByRole('button', { name: 'Show completed tasks' })).toBeInTheDocument();
  });

  it('does not render Inbox header', async () => {
    renderPage();

    await screen.findByText('Test Collection');
    expect(screen.queryByText('Inbox')).not.toBeInTheDocument();
  });

  it('renders add task input', async () => {
    renderPage();

    const input = await screen.findByPlaceholderText('New task…');
    expect(input).toBeInTheDocument();
  });

  it('uses the collection id from URL params', async () => {
    renderPage();

    await screen.findByText('Test Collection');
    expect(mockFetchCollectionView).toHaveBeenCalledWith('test-collection-id');
  });

  describe('breadcrumb context menu', () => {
    async function openCrumbMenu(name: string) {
      mockFetchCollections.mockResolvedValue([parentCollection, childCollection]);
      renderPage();
      const crumb = (await screen.findByText(name)).closest('.collections-page-crumb')!;
      fireEvent.contextMenu(crumb, { clientX: 120, clientY: 30 });
      return screen.getByRole('menu');
    }

    it('offers the same collection actions as the sidebar', async () => {
      const menu = await openCrumbMenu('Test Collection');
      const labels = within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent);

      expect(labels).toEqual(['Change color…', 'Rename', 'Add sub-collection', 'Delete']);
    });

    it('targets the crumb that was right-clicked, not the current collection', async () => {
      const menu = await openCrumbMenu('Parent');
      fireEvent.click(within(menu).getByText('Change color…'));

      const picker = await screen.findByRole('dialog', { name: 'Change color' });
      expect(within(picker).getByLabelText('Color value')).toHaveValue('#7dbfb2');
    });

    it('recolors the crumb collection without touching its children', async () => {
      mockApiUpdateCollection.mockResolvedValue({ ...parentCollection, color: '#b7bf4e' });

      const menu = await openCrumbMenu('Parent');
      fireEvent.click(within(menu).getByText('Change color…'));

      const picker = await screen.findByRole('dialog', { name: 'Change color' });
      const input = within(picker).getByLabelText('Color value');
      fireEvent.change(input, { target: { value: '#b7bf4e' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() =>
        expect(mockApiUpdateCollection).toHaveBeenCalledWith('parent-id', { color: '#b7bf4e' }),
      );
      expect(mockApiUpdateCollection).toHaveBeenCalledTimes(1);
      // The child crumb keeps the colour it already had.
      await waitFor(() =>
        expect(
          (screen.getByText('Test Collection').closest('.collections-page-crumb') as HTMLElement)
            .firstElementChild,
        ).toHaveStyle({ background: '#d56b64' }),
      );
    });

    it('renames the crumb collection inline', async () => {
      mockApiUpdateCollection.mockResolvedValue({ ...childCollection, name: 'Renamed' });

      const menu = await openCrumbMenu('Test Collection');
      fireEvent.click(within(menu).getByText('Rename'));

      const input = await screen.findByLabelText('Rename');
      fireEvent.change(input, { target: { value: 'Renamed' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() =>
        expect(mockApiUpdateCollection).toHaveBeenCalledWith('test-collection-id', { name: 'Renamed' }),
      );
    });
  });
});
