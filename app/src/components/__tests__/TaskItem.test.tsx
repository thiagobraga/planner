import { render, screen, fireEvent } from '@testing-library/react';
import { SortableContext } from '@dnd-kit/sortable';
import { getCaret, setCaret } from '../../utils/editableText';
import { typeText } from '../../test/editableText';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskItem } from '../TaskItem';
import { CollectionChip } from '../ui/Chip';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
import { useDebugStore } from '../../stores/debugStore';
import type { Task } from '../../types/task';

function renderTaskItem(task: Task, props: Partial<React.ComponentProps<typeof TaskItem>> = {}) {
  return render(
    <PlannerDragProvider>
      <SortableContext items={[task.id]}>
        <TaskItem task={task} isEditing {...props} />
      </SortableContext>
    </PlannerDragProvider>,
  );
}

const baseTask: Task = {
  id: 't1',
  title: '',
  priority: 4,
  isCompleted: false,
  orderValue: 0,
  type: 'task',
};

describe('TaskItem - inline editing', () => {
  const titled = { ...baseTask, title: 'Buy milk' };

  it('starts with the title and the caret at its end', () => {
    renderTaskItem(titled);
    const input = screen.getByRole('textbox');

    expect(input).toHaveTextContent('Buy milk');
    expect(input).toHaveFocus();
    expect(getCaret(input)).toEqual({ start: 8, end: 8 });
  });

  it('commits the edited title when the field loses focus', () => {
    const onEditCommit = vi.fn();
    renderTaskItem(titled, { onEditCommit });
    const input = screen.getByRole('textbox');

    typeText(input, 'Buy oat milk');
    fireEvent.blur(input);

    expect(onEditCommit).toHaveBeenCalledWith('t1', 'Buy oat milk');
  });

  it('commits once and opens a row below on Enter', () => {
    const onEditCommit = vi.fn();
    const onAddBelow = vi.fn();
    renderTaskItem(titled, { onEditCommit, onAddBelow });
    const input = screen.getByRole('textbox');

    typeText(input, 'Buy oat milk');
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);

    expect(onEditCommit).toHaveBeenCalledTimes(1);
    expect(onEditCommit).toHaveBeenCalledWith('t1', 'Buy oat milk');
    expect(onAddBelow).toHaveBeenCalledWith('t1');
  });

  it('cancels on Escape without committing on the blur that follows', () => {
    const onEditCommit = vi.fn();
    const onEditCancel = vi.fn();
    renderTaskItem(titled, { onEditCommit, onEditCancel });
    const input = screen.getByRole('textbox');

    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);

    expect(onEditCancel).toHaveBeenCalledWith('t1');
    expect(onEditCommit).not.toHaveBeenCalled();
  });

  it('deletes the row on Backspace once the title is empty', () => {
    const onDelete = vi.fn();
    renderTaskItem(titled, { onDelete });
    const input = screen.getByRole('textbox');

    typeText(input, '');
    fireEvent.keyDown(input, { key: 'Backspace' });

    expect(onDelete).toHaveBeenCalledWith('t1');
  });
});

describe('TaskItem - task/note conversion', () => {
  it('pressing "-" on an empty task input converts to note without committing', () => {
    const onConvertType = vi.fn();
    const onEditCommit = vi.fn();
    renderTaskItem(baseTask, { onConvertType, onEditCommit });

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: '-' });

    expect(onConvertType).toHaveBeenCalledWith('t1', 'note');
    expect(onEditCommit).not.toHaveBeenCalled();
  });

  it('does not convert when the task input already has text', () => {
    const onConvertType = vi.fn();
    renderTaskItem({ ...baseTask, title: 'Buy milk' }, { onConvertType });

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: '-' });

    expect(onConvertType).not.toHaveBeenCalled();
  });

  it.each(['[', ']', '*'])('pressing "%s" on an empty note input converts back to task', (key) => {
    const onConvertType = vi.fn();
    const onEditCommit = vi.fn();
    renderTaskItem({ ...baseTask, type: 'note' }, { onConvertType, onEditCommit });

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key });

    expect(onConvertType).toHaveBeenCalledWith('t1', 'task');
    expect(onEditCommit).not.toHaveBeenCalled();
  });

  it('does not fire task->note conversion on an already-note row', () => {
    const onConvertType = vi.fn();
    renderTaskItem({ ...baseTask, type: 'note' }, { onConvertType });

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: '-' });

    expect(onConvertType).not.toHaveBeenCalled();
  });

  it('converts a task with existing text when space follows a leading "-"', () => {
    const onConvertType = vi.fn();
    renderTaskItem({ ...baseTask, title: '-Buy milk' }, { onConvertType });

    const input = screen.getByRole('textbox');
    setCaret(input, 1, 1);
    fireEvent.keyDown(input, { key: ' ' });

    expect(onConvertType).toHaveBeenCalledWith('t1', 'note');
    expect(input).toHaveTextContent('Buy milk');
  });

  it.each(['[', ']', '*'])(
    'converts a note with existing text when space follows a leading "%s"',
    (marker) => {
      const onConvertType = vi.fn();
      renderTaskItem({ ...baseTask, type: 'note', title: `${marker}Buy milk` }, { onConvertType });

      const input = screen.getByRole('textbox');
      setCaret(input, 1, 1);
      fireEvent.keyDown(input, { key: ' ' });

      expect(onConvertType).toHaveBeenCalledWith('t1', 'task');
      expect(input).toHaveTextContent('Buy milk');
    },
  );

  it('leaves the marker alone when it is not the start of the line', () => {
    const onConvertType = vi.fn();
    renderTaskItem({ ...baseTask, title: 'Buy - milk' }, { onConvertType });

    const input = screen.getByRole('textbox');
    setCaret(input, 5, 5);
    fireEvent.keyDown(input, { key: ' ' });

    expect(onConvertType).not.toHaveBeenCalled();
    expect(input).toHaveTextContent('Buy - milk');
  });

  it('does not strip a leading "-" that would convert a note into itself', () => {
    const onConvertType = vi.fn();
    renderTaskItem({ ...baseTask, type: 'note', title: '-Buy milk' }, { onConvertType });

    const input = screen.getByRole('textbox');
    setCaret(input, 1, 1);
    fireEvent.keyDown(input, { key: ' ' });

    expect(onConvertType).not.toHaveBeenCalled();
    expect(input).toHaveTextContent('-Buy milk');
  });

  it('ignores the prefix while part of the line is selected', () => {
    const onConvertType = vi.fn();
    renderTaskItem({ ...baseTask, title: '-Buy milk' }, { onConvertType });

    const input = screen.getByRole('textbox');
    setCaret(input, 1, 4);
    fireEvent.keyDown(input, { key: ' ' });

    expect(onConvertType).not.toHaveBeenCalled();
    expect(input).toHaveTextContent('-Buy milk');
  });

  it('renders a plain non-interactive dash bullet for notes, no checkbox', () => {
    renderTaskItem({ ...baseTask, type: 'note', title: 'A note' }, { isEditing: false });

    expect(screen.queryByRole('button', { name: /complete|reopen/i })).not.toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('dims past note rows the same way completed tasks are dimmed', () => {
    renderTaskItem({ ...baseTask, type: 'note', title: 'Old note' }, { isEditing: false, dimmed: true });

    expect(screen.getByRole('button', { name: 'Old note' })).toHaveClass('opacity-[0.35]');
  });

  it('renders a checkbox toggle button for tasks', () => {
    renderTaskItem({ ...baseTask, title: 'A task' }, { isEditing: false });

    expect(screen.getByRole('button', { name: /complete|reopen/i })).toBeInTheDocument();
  });

  it('pressing "(" on an empty task input converts to event without committing', () => {
    const onConvertType = vi.fn();
    const onEditCommit = vi.fn();
    renderTaskItem(baseTask, { onConvertType, onEditCommit });

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: '(' });

    expect(onConvertType).toHaveBeenCalledWith('t1', 'event');
    expect(onEditCommit).not.toHaveBeenCalled();
  });

  it('does not fire task->event conversion on an already-event row', () => {
    const onConvertType = vi.fn();
    renderTaskItem({ ...baseTask, type: 'event' }, { onConvertType });

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: '(' });

    expect(onConvertType).not.toHaveBeenCalled();
  });

  it.each(['[', ']', '*'])('pressing "%s" on an empty event input converts back to task', (key) => {
    const onConvertType = vi.fn();
    renderTaskItem({ ...baseTask, type: 'event' }, { onConvertType });

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key });

    expect(onConvertType).toHaveBeenCalledWith('t1', 'task');
  });

  it('converts a task with existing text when space follows a leading "("', () => {
    const onConvertType = vi.fn();
    renderTaskItem({ ...baseTask, title: '(Team standup' }, { onConvertType });

    const input = screen.getByRole('textbox');
    setCaret(input, 1, 1);
    fireEvent.keyDown(input, { key: ' ' });

    expect(onConvertType).toHaveBeenCalledWith('t1', 'event');
    expect(input).toHaveTextContent('Team standup');
  });

  it('renders a plain non-interactive circle bullet for events, no checkbox', () => {
    renderTaskItem({ ...baseTask, type: 'event', title: 'Team standup' }, { isEditing: false });

    expect(screen.queryByRole('button', { name: /complete|reopen/i })).not.toBeInTheDocument();
    expect(screen.getByText('○')).toBeInTheDocument();
  });

  describe('mobile onChange fallback', () => {
    it('converts to note when the input value becomes just "-" (no keydown)', () => {
      const onConvertType = vi.fn();
      renderTaskItem(baseTask, { onConvertType });

      const input = screen.getByRole('textbox');
      typeText(input, '-');

      expect(onConvertType).toHaveBeenCalledWith('t1', 'note');
      expect(input).toBeEmptyDOMElement();
    });

    it('converts to event and strips a leading "( " typed via a virtual keyboard', () => {
      const onConvertType = vi.fn();
      renderTaskItem(baseTask, { onConvertType });

      const input = screen.getByRole('textbox');
      typeText(input, '( Team standup');

      expect(onConvertType).toHaveBeenCalledWith('t1', 'event');
      expect(input).toHaveTextContent('Team standup');
    });

    it('does not convert when the marker is not at the start of the value', () => {
      const onConvertType = vi.fn();
      renderTaskItem(baseTask, { onConvertType });

      const input = screen.getByRole('textbox');
      typeText(input, 'Buy (milk');

      expect(onConvertType).not.toHaveBeenCalled();
      expect(input).toHaveTextContent('Buy (milk');
    });

    it('does not re-convert an already-matching type', () => {
      const onConvertType = vi.fn();
      renderTaskItem({ ...baseTask, type: 'event' }, { onConvertType });

      const input = screen.getByRole('textbox');
      typeText(input, '( still an event');

      expect(onConvertType).not.toHaveBeenCalled();
      expect(input).toHaveTextContent('( still an event');
    });
  });

  it('renders structured label chips using the shared task-row chip style', () => {
    renderTaskItem(
      {
        ...baseTask,
        labels: [
          { id: 'label-1', name: 'feature', color: '#7dbfb2' },
          { id: 'label-2', name: 'bug', color: '#c9483b' },
        ],
      },
      { isEditing: false },
    );

    const featureChip = screen.getByText('feature').closest('.task-item-label-chip');
    expect(featureChip).toBeInTheDocument();
    expect(featureChip).toHaveClass('ui-meta-chip');
    expect(screen.getByText('bug').closest('.task-item-label-chip')).toHaveClass('ui-meta-chip');
    expect(screen.queryByText('@feature')).not.toBeInTheDocument();
    expect(screen.queryByText('@bug')).not.toBeInTheDocument();
  });
});

describe('TaskItem - time, deadline, priority, order and uniform chips', () => {
  const timed: Task = { ...baseTask, title: 'Write report', dueDate: '2026-08-14' };

  it('pairs due date and due time in one split meta chip', () => {
    const { container } = renderTaskItem({ ...timed, dueTime: '14:30' }, { isEditing: false });
    const schedule = container.querySelector('.task-item-schedule .ui-meta-chip');
    expect(schedule).toBeInTheDocument();
    expect(schedule?.querySelector('.task-item-due-date')).toBeInTheDocument();
    expect(schedule?.querySelector('.task-item-time')).toHaveTextContent('14:30');
  });

  it('shows the time window when start and end are known', () => {
    renderTaskItem({ ...timed, dueTime: '14:30', endTime: '16:00', durationMinutes: 90 }, { isEditing: false });
    expect(screen.getByText('14:30-16:00')).toBeInTheDocument();
  });

  it('keeps the time visible as a single meta chip when the date is hidden', () => {
    const { container } = renderTaskItem({ ...timed, dueTime: '09:00' }, { isEditing: false, hideDueDate: true });
    expect(container.querySelector('.task-item-due-date')).toBeNull();
    expect(container.querySelector('.task-item-time')).toHaveTextContent('09:00');
    expect(container.querySelector('.task-item-schedule .ui-meta-chip')).toBeInTheDocument();
  });

  it('shows a duration segment when no start time is set', () => {
    const { container } = renderTaskItem({ ...timed, durationMinutes: 90 }, { isEditing: false });
    expect(container.querySelector('.task-item-duration')).toHaveTextContent('1h 30m');
  });

  it('shows a deadline chip with an alarm icon using the shared meta chip style', () => {
    const { container } = renderTaskItem(
      { ...timed, deadlineDate: '2026-08-20', deadlineTime: '18:00' },
      { isEditing: false },
    );
    const chip = container.querySelector('.task-item-deadline');
    expect(chip).toBeInTheDocument();
    expect(chip?.querySelector('.ui-meta-chip')).toBeInTheDocument();
    expect(chip?.querySelector('svg')).toBeInTheDocument();
    expect(chip).toHaveTextContent('18:00');
  });

  it('shows a priority chip for priorities 1 to 3 and omits it for priority 4', () => {
    const { container, rerender } = renderTaskItem({ ...timed, priority: 1 }, { isEditing: false });
    const priority = container.querySelector('.task-item-priority');
    expect(priority).toHaveTextContent('!1');
    expect(priority?.querySelector('.ui-meta-chip')).toHaveClass('text-danger-text');

    rerender(
      <PlannerDragProvider>
        <SortableContext items={[timed.id]}>
          <TaskItem task={{ ...timed, priority: 4 }} isEditing={false} />
        </SortableContext>
      </PlannerDragProvider>,
    );
    expect(container.querySelector('.task-item-priority')).toBeNull();
  });

  it('renders task row items in canonical order: title, date/hour, repeat, deadline, priority, collection, tags', () => {
    const { container } = renderTaskItem(
      {
        ...timed,
        priority: 1,
        dueTime: '17:30',
        recurrenceRule: { type: 'daily', interval: 1 },
        deadlineDate: '2026-08-23',
        deadlineTime: '23:59',
        labels: [{ id: 'l1', name: 'urgent', color: '#c9483b' }],
      },
      {
        isEditing: false,
        collectionBadge: <CollectionChip name="pets" color="#eab308" />,
      },
    );

    const area = container.querySelector('.task-item-title-area')!;
    expect([...area.children].map((el) => el.className.split(' ')[0])).toEqual([
      'task-item-title-text',
      'task-item-meta',
    ]);
    const meta = area.querySelector('.task-item-meta')!;
    const classes = [...meta.children].map((el) => el.className.split(' ')[0]);
    expect(classes).toEqual([
      'task-item-schedule',
      'task-item-repeat',
      'task-item-deadline',
      'task-item-priority',
      'task-item-collection',
      'task-item-labels',
    ]);
  });

  it('renders no time chips for a plain task', () => {
    const { container } = renderTaskItem(timed, { isEditing: false });
    expect(container.querySelector('.task-item-time')).toBeNull();
    expect(container.querySelector('.task-item-deadline')).toBeNull();
    expect(container.querySelector('.task-item-duration')).toBeNull();
  });
});

describe('TaskItem - debug mode', () => {
  const task: Task = { ...baseTask, id: 'abcdef12-3456', title: 'Buy milk', orderValue: 5, createdAt: '2026-10-02T09:00:00.000Z' };

  beforeEach(() => useDebugStore.setState({ enabled: false }));

  it('hides the debug card by default', () => {
    renderTaskItem(task, { isEditing: false });
    expect(screen.queryByTestId('debug-card')).not.toBeInTheDocument();
  });

  it('shows id, order and created date when debug mode is on', () => {
    useDebugStore.setState({ enabled: true });
    renderTaskItem(task, { isEditing: false });
    const card = screen.getByTestId('debug-card');
    expect(card).toHaveTextContent('ID: abcdef12');
    expect(card).toHaveTextContent('Order: 5');
    expect(card).toHaveTextContent(/Created: 2026-10-0[12]-\d\d-\d\d-\d\d/);
  });

  it('shows level and parent of a subtask', () => {
    useDebugStore.setState({ enabled: true });
    renderTaskItem({ ...task, parentTaskId: 'parent99-0000', indent: 1 }, { isEditing: false });
    const card = screen.getByTestId('debug-card');
    expect(card).toHaveTextContent('Level: 1');
    expect(card).toHaveTextContent('Parent: parent99');
  });

  it('shows level 0 and no parent for a root task', () => {
    useDebugStore.setState({ enabled: true });
    renderTaskItem(task, { isEditing: false });
    const card = screen.getByTestId('debug-card');
    expect(card).toHaveTextContent('Level: 0');
    expect(card).toHaveTextContent('Parent: -');
  });
});
