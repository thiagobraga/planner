import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskDetail } from '../TaskDetail';
import type { Task } from '../TaskItem';

const sampleTask: Task = {
  id: 'task-1',
  title: 'Test task',
  description: 'A description',
  priority: 2,
  dueDate: '2026-07-20',
  isCompleted: false,
  orderValue: 1,
  type: 'task',
};

describe('TaskDetail', () => {
  it('renders nothing when task is null', () => {
    const { container } = render(
      <TaskDetail task={null} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows all task fields when task is provided', () => {
    render(
      <TaskDetail task={sampleTask} onClose={vi.fn()} />
    );

    expect(screen.getByLabelText('Task title')).toHaveValue('Test task');
    expect(screen.getByLabelText('Task description')).toHaveValue('A description');
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-07-20');
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('editing title calls onUpdate on blur', () => {
    const onUpdate = vi.fn();
    render(
      <TaskDetail task={sampleTask} onClose={vi.fn()} onUpdate={onUpdate} />
    );

    const titleInput = screen.getByLabelText('Task title');
    fireEvent.change(titleInput, { target: { value: 'Updated title' } });
    fireEvent.blur(titleInput);

    expect(onUpdate).toHaveBeenCalledWith('task-1', { title: 'Updated title' });
  });

  it('editing description calls onUpdate on blur', () => {
    const onUpdate = vi.fn();
    render(
      <TaskDetail task={sampleTask} onClose={vi.fn()} onUpdate={onUpdate} />
    );

    const descInput = screen.getByLabelText('Task description');
    fireEvent.change(descInput, { target: { value: 'Updated description' } });
    fireEvent.blur(descInput);

    expect(onUpdate).toHaveBeenCalledWith('task-1', { description: 'Updated description' });
  });

  it('changing priority calls onUpdate immediately', () => {
    const onUpdate = vi.fn();
    render(
      <TaskDetail task={sampleTask} onClose={vi.fn()} onUpdate={onUpdate} />
    );

    fireEvent.click(screen.getByText('P1'));

    expect(onUpdate).toHaveBeenCalledWith('task-1', { priority: 1 });
  });

  it('delete first click shows confirm label', () => {
    render(
      <TaskDetail task={sampleTask} onClose={vi.fn()} />
    );

    const deleteBtn = screen.getByText('Delete');
    fireEvent.click(deleteBtn);

    expect(screen.getByText('Confirm delete')).toBeInTheDocument();
  });

  it('delete confirmation calls onDelete', () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(
      <TaskDetail task={sampleTask} onClose={onClose} onDelete={onDelete} />
    );

    const deleteBtn = screen.getByText('Delete');
    fireEvent.click(deleteBtn);
    fireEvent.click(screen.getByText('Confirm delete'));

    expect(onDelete).toHaveBeenCalledWith('task-1');
  });
});
