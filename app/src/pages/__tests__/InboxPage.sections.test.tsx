import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  baseInboxData,
  sampleTasks,
  collection,
  section,
  taskListMock,
  collectionBoardMock,
} from './helpers/inboxFixtures';
import { renderPage, createInboxHarness, inboxBeforeEach } from './helpers/inboxHarness';
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

const { taskListCalls } = createInboxHarness({ mockTaskList, mockUseTaskDrag, mockUseSectionDrag });

inboxBeforeEach({ mockFetchInboxTasks, mockApiCreateTask, mockApiUpdateTask, mockApiToggleTask,
    mockApiDeleteTask, mockApiCreateSection, mockApiUpdateSection, mockApiDeleteSection,
    mockApiUpdatePreferences, mockFetchPreferences, mockFetchCollections, mockTaskList,
    mockUseSync, mockUseTaskDrag, mockUseSectionDrag });

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

