import { render, screen, fireEvent } from '@testing-library/react';
import { SortableContext } from '@dnd-kit/sortable';
import { describe, it, expect, vi } from 'vitest';
import { TaskItem, type Task } from '../TaskItem';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';

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

    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.setSelectionRange(1, 1);
    fireEvent.keyDown(input, { key: ' ' });

    expect(onConvertType).toHaveBeenCalledWith('t1', 'note');
    expect(input.value).toBe('Buy milk');
  });

  it.each(['[', ']', '*'])(
    'converts a note with existing text when space follows a leading "%s"',
    (marker) => {
      const onConvertType = vi.fn();
      renderTaskItem({ ...baseTask, type: 'note', title: `${marker}Buy milk` }, { onConvertType });

      const input = screen.getByRole('textbox') as HTMLInputElement;
      input.setSelectionRange(1, 1);
      fireEvent.keyDown(input, { key: ' ' });

      expect(onConvertType).toHaveBeenCalledWith('t1', 'task');
      expect(input.value).toBe('Buy milk');
    },
  );

  it('leaves the marker alone when it is not the start of the line', () => {
    const onConvertType = vi.fn();
    renderTaskItem({ ...baseTask, title: 'Buy - milk' }, { onConvertType });

    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.setSelectionRange(5, 5);
    fireEvent.keyDown(input, { key: ' ' });

    expect(onConvertType).not.toHaveBeenCalled();
    expect(input.value).toBe('Buy - milk');
  });

  it('does not strip a leading "-" that would convert a note into itself', () => {
    const onConvertType = vi.fn();
    renderTaskItem({ ...baseTask, type: 'note', title: '-Buy milk' }, { onConvertType });

    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.setSelectionRange(1, 1);
    fireEvent.keyDown(input, { key: ' ' });

    expect(onConvertType).not.toHaveBeenCalled();
    expect(input.value).toBe('-Buy milk');
  });

  it('ignores the prefix while part of the line is selected', () => {
    const onConvertType = vi.fn();
    renderTaskItem({ ...baseTask, title: '-Buy milk' }, { onConvertType });

    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.setSelectionRange(1, 4);
    fireEvent.keyDown(input, { key: ' ' });

    expect(onConvertType).not.toHaveBeenCalled();
    expect(input.value).toBe('-Buy milk');
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

    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.setSelectionRange(1, 1);
    fireEvent.keyDown(input, { key: ' ' });

    expect(onConvertType).toHaveBeenCalledWith('t1', 'event');
    expect(input.value).toBe('Team standup');
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

      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '-' } });

      expect(onConvertType).toHaveBeenCalledWith('t1', 'note');
      expect(input.value).toBe('');
    });

    it('converts to event and strips a leading "( " typed via a virtual keyboard', () => {
      const onConvertType = vi.fn();
      renderTaskItem(baseTask, { onConvertType });

      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '( Team standup' } });

      expect(onConvertType).toHaveBeenCalledWith('t1', 'event');
      expect(input.value).toBe('Team standup');
    });

    it('does not convert when the marker is not at the start of the value', () => {
      const onConvertType = vi.fn();
      renderTaskItem(baseTask, { onConvertType });

      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Buy (milk' } });

      expect(onConvertType).not.toHaveBeenCalled();
      expect(input.value).toBe('Buy (milk');
    });

    it('does not re-convert an already-matching type', () => {
      const onConvertType = vi.fn();
      renderTaskItem({ ...baseTask, type: 'event' }, { onConvertType });

      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '( still an event' } });

      expect(onConvertType).not.toHaveBeenCalled();
      expect(input.value).toBe('( still an event');
    });
  });
});
