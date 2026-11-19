import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { typeText } from '../../test/editableText';
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
  apiDeleteSection,
  apiUpdatePreferences,
  apiUpdateCollection,
  apiCreateCollection,
  apiDeleteCollection,
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
const mockApiDeleteSection = vi.mocked(apiDeleteSection);
const mockApiUpdatePreferences = vi.mocked(apiUpdatePreferences);
const mockApiUpdateCollection = vi.mocked(apiUpdateCollection);
const mockApiCreateCollection = vi.mocked(apiCreateCollection);
const mockApiDeleteCollection = vi.mocked(apiDeleteCollection);
const mockFetchSavedColors = vi.mocked(fetchSavedColors);
const mockApiAddSavedColor = vi.mocked(apiAddSavedColor);
const taskListMock = vi.hoisted(() =>
  vi.fn(
    ({
      tasks,
      onTaskToggle,
    }: {
      tasks: { id: string; title: string; labels?: unknown[] }[];
      onTaskToggle?: (id: string) => void;
    }) => (
      <div data-testid="task-list">
        {tasks.map((t, i) => (
          <div key={i}>
            <span>{t.title}</span>
            {onTaskToggle && (
              <button type="button" onClick={() => onTaskToggle(t.id)}>
                Toggle {t.title}
              </button>
            )}
          </div>
        ))}
      </div>
    ),
  ),
);

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchCollectionView: vi.fn(),
  fetchCollections: vi.fn(),
  fetchPreferences: vi.fn(),
  apiCreateTask: vi.fn(),
  apiToggleTask: vi.fn(),
  apiUpdateTask: vi.fn(),
  apiDeleteTask: vi.fn(),
  apiDeleteSection: vi.fn(),
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
  TaskList: taskListMock,
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
  sections: [],
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
  showNotes: true,
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
          <Route path="/daily" element={<div>Daily Destination</div>} />
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
  mockApiDeleteSection.mockReset();
  mockApiUpdatePreferences.mockReset();
  mockApiUpdateCollection.mockReset();
  mockApiCreateCollection.mockReset();
  mockApiDeleteCollection.mockReset();
  mockFetchSavedColors.mockReset();
  mockApiAddSavedColor.mockReset();
  taskListMock.mockClear();

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
  it('renders the collection name with the page toolbar on its row', async () => {
    renderPage();

    const title = await screen.findByText('Test Collection');
    const row = title.closest('.page-header-row');
    expect(row).toContainElement(screen.getByRole('button', { name: 'View' }));
    expect(screen.queryByRole('button', { name: 'Window' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More options' })).not.toBeInTheDocument();
  });

  it('does not render Inbox header', async () => {
    renderPage();

    await screen.findByText('Test Collection');
    expect(screen.queryByText('Inbox')).not.toBeInTheDocument();
  });

  it('renders add task input', async () => {
    renderPage();

    await screen.findByText('Test Collection');
    const input = await screen.findByRole('textbox', { name: 'New task…' });
    expect(input).toBeInTheDocument();
  });

  it('creates the typed task in the collection when the field loses focus', async () => {
    mockApiCreateTask.mockResolvedValue({ id: 'created-1', title: 'Draft spec' } as Awaited<ReturnType<typeof apiCreateTask>>);
    renderPage();

    await screen.findByText('Test Collection');
    const input = await screen.findByRole('textbox', { name: 'New task…' });
    typeText(input, 'Draft spec');
    fireEvent.blur(input);

    expect(mockApiCreateTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Draft spec', collectionId: 'test-collection-id' }));
    expect(input).toBeEmptyDOMElement();
    await act(async () => {
      await mockApiCreateTask.mock.results[0].value;
    });
  });

  it('renders add-task fields as contenteditable text, not form inputs', async () => {
    renderPage();

    await screen.findByText('Test Collection');
    const inputs = await screen.findAllByRole('textbox', { name: 'New task…' });
    for (const input of inputs) expect(input).toHaveAttribute('contenteditable', 'plaintext-only');
  });

  it('asks what to do with tasks when a populated section name is blanked', async () => {
    mockFetchCollectionView.mockResolvedValue({
      ...collectionViewData,
      tasks: [{ ...collectionViewData.tasks[0], sectionId: 'section-1' }],
      sections: [{
        id: 'section-1',
        name: 'Work',
        collectionId: 'test-collection-id',
        orderValue: 0,
      }],
    });
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

  it('uses the collection id from URL params', async () => {
    renderPage();

    await screen.findByText('Test Collection');
    expect(mockFetchCollectionView).toHaveBeenCalledWith('test-collection-id', { includeCompleted: false });
  });

  it('preserves structured labels in the task mapper', async () => {
    mockFetchCollectionView.mockResolvedValue({
      ...collectionViewData,
      tasks: [
        {
          ...collectionViewData.tasks[0],
          labels: [{ id: 'label-1', name: 'feature', color: '#7dbfb2' }],
        },
      ],
    });

    renderPage();

    await screen.findByText('Task 1');
    expect(taskListMock).toHaveBeenCalled();
    expect(taskListMock.mock.calls.at(-1)?.[0].tasks[0].labels).toEqual([
      { id: 'label-1', name: 'feature', color: '#7dbfb2' },
    ]);
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

    it('creates a sub-collection under the targeted crumb', async () => {
      mockApiCreateCollection.mockResolvedValue({
        ...childCollection,
        id: 'sub-id',
        name: 'Child Sub',
        parentId: 'test-collection-id',
      });

      const menu = await openCrumbMenu('Test Collection');
      fireEvent.click(within(menu).getByText('Add sub-collection'));

      const input = await screen.findByPlaceholderText('Collection name…');
      fireEvent.change(input, { target: { value: 'Child Sub' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() =>
        expect(mockApiCreateCollection).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Child Sub', parentId: 'test-collection-id' }),
        ),
      );
    });

    it('deletes the targeted collection after confirmation and navigates to daily', async () => {
      mockApiDeleteCollection.mockResolvedValue(undefined);

      const menu = await openCrumbMenu('Test Collection');
      fireEvent.click(within(menu).getByText('Delete'));

      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

      await waitFor(() =>
        expect(mockApiDeleteCollection).toHaveBeenCalledWith('test-collection-id'),
      );
      expect(await screen.findByText('Daily Destination')).toBeInTheDocument();
    });
  });

  it('deletes both tasks and section when confirmed in section delete modal', async () => {
    mockFetchCollectionView.mockResolvedValue({
      ...collectionViewData,
      tasks: [{ ...collectionViewData.tasks[0], sectionId: 'section-1' }],
      sections: [{
        id: 'section-1',
        name: 'Work',
        collectionId: 'test-collection-id',
        orderValue: 0,
      }],
    });
    mockApiDeleteTask.mockResolvedValue(undefined);
    mockApiDeleteSection.mockResolvedValue(undefined);
    renderPage();

    fireEvent.doubleClick(await screen.findByText('Work'));
    const input = screen.getByDisplayValue('Work');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    fireEvent.click(await screen.findByRole('button', { name: 'Delete section and tasks' }));

    await waitFor(() => expect(mockApiDeleteTask).toHaveBeenCalledWith('task-1'));
    await waitFor(() => expect(mockApiDeleteSection).toHaveBeenCalledWith('section-1'));
  });

  it('restores a completed task when toggle fails under hideCompletedTasks', async () => {
    mockFetchPreferences.mockResolvedValue({ ...defaultPreferences, hideCompletedTasks: true });
    mockApiToggleTask.mockRejectedValueOnce(new Error('network error'));
    renderPage();

    const toggleBtn = await screen.findByRole('button', { name: 'Toggle Task 1' });
    fireEvent.click(toggleBtn);

    await waitFor(() => expect(mockApiToggleTask).toHaveBeenCalledWith('task-1', true));
    expect(await screen.findByText('Task 1')).toBeInTheDocument();
  });

  it('renders the "+ New section" button with opacity-0 and hover:opacity-100 classes', async () => {
    renderPage();
    await screen.findByText('Test Collection');
    const button = await screen.findByRole('button', { name: /New section/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('opacity-0');
    expect(button).toHaveClass('hover:opacity-100');
  });
});
