import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { describe, it, expect, vi } from 'vitest';
import { TaskItem, type Task } from '../TaskItem';

function renderTaskItem(task: Task, props: Partial<React.ComponentProps<typeof TaskItem>> = {}) {
  return render(
    <DndContext>
      <SortableContext items={[task.id]}>
        <TaskItem task={task} isEditing {...props} />
      </SortableContext>
    </DndContext>,
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

describe('TaskItem — task/note conversion', () => {
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

  it('renders a plain non-interactive dash bullet for notes, no checkbox', () => {
    renderTaskItem({ ...baseTask, type: 'note', title: 'A note' }, { isEditing: false });

    expect(screen.queryByRole('button', { name: /complete|reopen/i })).not.toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('renders a checkbox toggle button for tasks', () => {
    renderTaskItem({ ...baseTask, title: 'A task' }, { isEditing: false });

    expect(screen.getByRole('button', { name: /complete|reopen/i })).toBeInTheDocument();
  });
});
