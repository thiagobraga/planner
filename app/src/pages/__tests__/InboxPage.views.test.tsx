import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  basePreferences,
  baseInboxData,
  sampleTasks,
  createdTask,
  status,
  taskListMock,
  collectionBoardMock,
} from './helpers/inboxFixtures';
import { renderPage, createInboxHarness, inboxBeforeEach } from './helpers/inboxHarness';
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
  TaskList: taskListMock,
}));

vi.mock('../../components/board/CollectionBoard', () => ({
  CollectionBoard: collectionBoardMock,
}));

const { taskListCalls, latestDragOptions, latestSectionDragOptions } = createInboxHarness({
  mockTaskList,
  mockUseTaskDrag,
  mockUseSectionDrag,
});

inboxBeforeEach({ mockFetchInboxTasks, mockApiCreateTask, mockApiUpdateTask, mockApiToggleTask,
    mockApiDeleteTask, mockApiCreateSection, mockApiUpdateSection, mockApiDeleteSection,
    mockApiUpdatePreferences, mockFetchPreferences, mockFetchCollections, mockTaskList,
    mockUseSync, mockUseTaskDrag, mockUseSectionDrag });

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

    it('ignores status grouping in list view and always lists by section', async () => {
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

      await screen.findByText('Buy groceries');
      expect(screen.queryByRole('heading', { name: 'Backlog' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Done' })).not.toBeInTheDocument();

      const inboxTasks = taskListCalls('collection:inbox').at(-1)![0].tasks.map((t) => t.id);
      expect(inboxTasks).toEqual(expect.arrayContaining(['task-1', 'task-2', 'task-3']));

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
