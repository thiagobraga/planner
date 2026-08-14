import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  basePreferences,
  baseInboxData,
  sampleTasks,
  createdTask,
  section,
  taskListMock,
  collectionBoardMock,
} from './helpers/inboxFixtures';
import { renderPage, inboxList, inboxBeforeEach } from './helpers/inboxHarness';
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

inboxBeforeEach({ mockFetchInboxTasks, mockApiCreateTask, mockApiUpdateTask, mockApiToggleTask,
    mockApiDeleteTask, mockApiCreateSection, mockApiUpdateSection, mockApiDeleteSection,
    mockApiUpdatePreferences, mockFetchPreferences, mockFetchCollections, mockTaskList,
    mockUseSync, mockUseTaskDrag, mockUseSectionDrag });

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
    expect(screen.getByRole('button', { name: 'Hide old notes' }).closest('.page-header-toolbar')).toBeInTheDocument();
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

  it('focuses the add input when clicking the page background', async () => {
    const { container } = renderPage();

    fireEvent.click(container.querySelector('.inbox-page')!);
    await waitFor(() =>
      expect(document.activeElement?.className).toContain('task-add-input'),
    );
  });
});
