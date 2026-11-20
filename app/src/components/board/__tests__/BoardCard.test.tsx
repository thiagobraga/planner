import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardCard } from '../BoardCard';
import { useTaskDetailStore } from '../../../stores/taskDetailStore';
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

describe('BoardCard compact parent', () => {
  const sub = (id: string, patch: Record<string, unknown> = {}) =>
    ({ id, title: id, priority: 4, collectionId: 'collection-1', parentTaskId: 'task-1', isCompleted: false, orderValue: 0, type: 'task', ...patch }) as never;
  const kids = (n: number) => Array.from({ length: n }, (_, i) => sub(`kid-${i + 1}`));
  const parent = { id: 'task-1', title: 'Ship board', priority: 1, collectionId: 'collection-1', isCompleted: false, orderValue: 0, type: 'task' } as never;
  const renderCard = (props: Record<string, unknown>) => render(
    <PlannerDragProvider><BoardCard task={parent} subtasks={[]} {...props} /></PlannerDragProvider>,
  );

  beforeEach(() => {
    useTaskDetailStore.setState({ taskId: null, navigator: { open: vi.fn(), close: vi.fn() }, mode: 'full' });
  });

  it('previews at most five direct subtasks and offers Show all N above that', () => {
    renderCard({ subtasks: kids(6) });
    expect(screen.getAllByLabelText('Complete task')).toHaveLength(6);
    expect(screen.queryByText('kid-6')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all 6 subtasks' })).toBeInTheDocument();
  });

  it('shows no overflow button with exactly five subtasks', () => {
    renderCard({ subtasks: kids(5) });
    expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
  });

  it('opens the panel on Only tasks from Show all without opening the parent twice', () => {
    renderCard({ subtasks: kids(7) });
    fireEvent.click(screen.getByRole('button', { name: 'Show all 7 subtasks' }));
    expect(useTaskDetailStore.getState().mode).toBe('tasks');
    expect(useTaskDetailStore.getState().navigator?.open).toHaveBeenCalledTimes(1);
    expect(useTaskDetailStore.getState().navigator?.open).toHaveBeenCalledWith('task-1', false);
  });

  it('uses the progress it is given, so hidden and deeper tasks still count', () => {
    renderCard({ subtasks: kids(6), progress: { done: 3, total: 7 } });
    expect(screen.getByText('3 of 7')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '7');
  });

  it('marks a child that has its own subtasks with their count', () => {
    renderCard({ subtasks: [sub('kid-1'), sub('kid-2')], childCounts: new Map([['kid-2', 2]]) });
    expect(screen.getByText('2', { selector: '.board-card-checklist-meta' })).toBeInTheDocument();
  });

  it('marks the card whose details are open', () => {
    useTaskDetailStore.setState({ taskId: 'task-1' });
    const { container } = renderCard({});
    expect(container.querySelector('.board-card')).toHaveClass('is-selected');
  });
});
