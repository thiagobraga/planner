import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardCard } from '../BoardCard';
import { PlannerDragProvider } from '../../../contexts/PlannerDragContext';

describe('BoardCard', () => {
  it('opens its task menu from the options button and keyboard', () => {
    const onTaskContextMenu = vi.fn();
    render(<PlannerDragProvider><BoardCard
      task={{ id: 'task-1', title: 'Ship board', priority: 1, collectionId: 'collection-1', isCompleted: false, orderValue: 0, type: 'task' }}
      subtasks={[]}
      onTaskContextMenu={onTaskContextMenu}
    /></PlannerDragProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'More options for Ship board' }));
    expect(onTaskContextMenu).toHaveBeenCalledWith('task-1', expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
    fireEvent.keyDown(screen.getByText('Ship board').closest('article')!, { key: 'ContextMenu' });
    expect(onTaskContextMenu).toHaveBeenCalledTimes(2);
  });
  it('renders labels and an interactive subtask checklist', () => {
    const onToggle = vi.fn();
    render(
      <PlannerDragProvider>
        <BoardCard
        task={{
          id: 'task-1', title: 'Ship board', priority: 1, collectionId: 'collection-1',
          isCompleted: false, orderValue: 0, type: 'task',
          labels: [{ id: 'label-1', name: 'feature', color: '#7dbfb2' }],
        }}
        subtasks={[
          { id: 'child-1', title: 'Write tests', priority: 4, collectionId: 'collection-1', parentTaskId: 'task-1', isCompleted: true, orderValue: 0, type: 'task' },
          { id: 'child-2', title: 'Run browser', priority: 4, collectionId: 'collection-1', parentTaskId: 'task-1', isCompleted: false, orderValue: 1, type: 'task' },
        ]}
          onToggle={onToggle}
        />
      </PlannerDragProvider>,
    );

    expect(screen.getByText('feature')).toBeInTheDocument();
    expect(screen.getByText('Write tests')).toBeInTheDocument();
    expect(screen.getByText('Run browser')).toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText('Complete task')[0]);
    expect(onToggle).toHaveBeenCalledWith('task-1', true);
  });
});

describe('BoardCard progress', () => {
  const sub = (id: string, patch: Record<string, unknown> = {}) =>
    ({ id, title: id, priority: 4, collectionId: 'collection-1', parentTaskId: 'task-1', isCompleted: false, orderValue: 0, type: 'task', ...patch }) as never;
  const renderCard = (subtasks: never[]) => render(
    <PlannerDragProvider>
      <BoardCard
        task={{ id: 'task-1', title: 'Ship board', priority: 1, collectionId: 'collection-1', isCompleted: false, orderValue: 0, type: 'task' }}
        subtasks={subtasks}
      />
    </PlannerDragProvider>,
  );

  it('shows a bar and "N of M" counting only direct tasks, not notes', () => {
    renderCard([sub('a', { isCompleted: true }), sub('b'), sub('c'), sub('n', { type: 'note' })]);
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(bar).toHaveAttribute('aria-valuemax', '3');
  });

  it('shows no progress without actionable subtasks', () => {
    renderCard([sub('n', { type: 'note' })]);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
