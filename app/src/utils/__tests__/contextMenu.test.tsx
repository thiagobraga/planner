import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardCard } from '../../components/board/BoardCard';
import { TaskItem } from '../../components/TaskItem';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
import type { Task } from '../../types/task';

describe('Shift + right click opens the browser menu', () => {
  it('leaves a shift right click on a board card to the browser', () => {
    const onTaskContextMenu = vi.fn();
    render(<PlannerDragProvider><BoardCard
      task={{ id: 'task-1', title: 'Ship board', priority: 1, collectionId: 'collection-1', isCompleted: false, orderValue: 0, type: 'task' }}
      subtasks={[]}
      onTaskContextMenu={onTaskContextMenu}
    /></PlannerDragProvider>);
    const card = screen.getByText('Ship board').closest('article')!;
    expect(fireEvent.contextMenu(card, { shiftKey: true })).toBe(true);
    expect(onTaskContextMenu).not.toHaveBeenCalled();
    expect(fireEvent.contextMenu(card)).toBe(false);
    expect(onTaskContextMenu).toHaveBeenCalledTimes(1);
  });

  it('leaves a shift right click on a task row to the browser', () => {
    const onRightClick = vi.fn();
    const task = { id: 't1', title: 'Row task', isCompleted: false, priority: 4, orderValue: 0, type: 'task', collectionId: 'c1' } as Task;
    render(<PlannerDragProvider><TaskItem task={task} onRightClick={onRightClick} /></PlannerDragProvider>);
    const row = screen.getByText('Row task');
    expect(fireEvent.contextMenu(row, { shiftKey: true })).toBe(true);
    expect(onRightClick).not.toHaveBeenCalled();
    expect(fireEvent.contextMenu(row)).toBe(false);
    expect(onRightClick).toHaveBeenCalledTimes(1);
  });
});
