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

  describe('time, deadline and duration', () => {
    const timed: Task = { ...sampleTask, dueTime: '14:30', deadlineDate: '2026-07-25', deadlineTime: '18:00', durationMinutes: 90 };

    it('shows the current values', () => {
      render(<TaskDetail task={timed} onClose={vi.fn()} />);
      expect(screen.getByLabelText('Time')).toHaveValue('14:30');
      expect(screen.getByLabelText('Deadline')).toHaveValue('2026-07-25');
      expect(screen.getByLabelText('Deadline time')).toHaveValue('18:00');
      expect(screen.getByLabelText('Duration (min)')).toHaveValue(90);
    });

    it('updates the due time on blur', () => {
      const onUpdate = vi.fn();
      render(<TaskDetail task={sampleTask} onClose={vi.fn()} onUpdate={onUpdate} />);
      const input = screen.getByLabelText('Time');
      fireEvent.change(input, { target: { value: '08:45' } });
      fireEvent.blur(input);
      expect(onUpdate).toHaveBeenCalledWith('task-1', { dueTime: '08:45' });
    });

    it('updates the deadline on blur', () => {
      const onUpdate = vi.fn();
      render(<TaskDetail task={sampleTask} onClose={vi.fn()} onUpdate={onUpdate} />);
      const input = screen.getByLabelText('Deadline');
      fireEvent.change(input, { target: { value: '2026-07-30' } });
      fireEvent.blur(input);
      expect(onUpdate).toHaveBeenCalledWith('task-1', { deadlineDate: '2026-07-30' });
    });

    it('updates the duration on blur and clears it when emptied', () => {
      const onUpdate = vi.fn();
      render(<TaskDetail task={timed} onClose={vi.fn()} onUpdate={onUpdate} />);
      const input = screen.getByLabelText('Duration (min)');
      fireEvent.change(input, { target: { value: '45' } });
      fireEvent.blur(input);
      expect(onUpdate).toHaveBeenCalledWith('task-1', { durationMinutes: 45 });
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
      expect(onUpdate).toHaveBeenLastCalledWith('task-1', { durationMinutes: null });
    });
  });
});
