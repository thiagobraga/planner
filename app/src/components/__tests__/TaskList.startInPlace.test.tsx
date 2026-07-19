import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TaskList } from '../TaskList';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
import type { Task } from '../TaskItem';

/**
 * Pressing a row must not rearrange anything.
 *
 * The list collapses a dragged parent's descendants so the single remaining row
 * can stand in for the whole subtree, but doing that the instant a drag
 * activates made a press-and-hold visibly reflow the list before the pointer
 * had moved at all. The collapse now waits for actual movement.
 */

const tasks: Task[] = [
  { id: 'parent', title: 'Parent', priority: 4, isCompleted: false, orderValue: 0, type: 'task' },
  {
    id: 'child-a',
    title: 'Child A',
    priority: 4,
    isCompleted: false,
    orderValue: 100,
    type: 'task',
    parentTaskId: 'parent',
  },
  {
    id: 'child-b',
    title: 'Child B',
    priority: 4,
    isCompleted: false,
    orderValue: 200,
    type: 'task',
    parentTaskId: 'parent',
  },
];

const renderList = (activeDragId: string | null) =>
  render(
    <PlannerDragProvider>
      <TaskList tasks={tasks} containerId="list" activeDragId={activeDragId} />
    </PlannerDragProvider>,
  );

describe('TaskList: a drag starts in place', () => {
  it('renders every row when nothing is being dragged', () => {
    renderList(null);

    expect(screen.getByText('Parent')).toBeTruthy();
    expect(screen.getByText('Child A')).toBeTruthy();
    expect(screen.getByText('Child B')).toBeTruthy();
  });

  it('keeps descendants in place while the pointer has not moved', () => {
    // A drag is active, but no movement has been reported, so the list must
    // look exactly as it did a moment ago.
    renderList('parent');

    expect(screen.getByText('Parent')).toBeTruthy();
    expect(screen.getByText('Child A')).toBeTruthy();
    expect(screen.getByText('Child B')).toBeTruthy();
  });

  it('shows no landing slot before the drag has moved', () => {
    const { container } = renderList('parent');

    expect(container.querySelectorAll('.task-list-slot').length).toBe(0);
  });

  it('does not tint the list as a drop target', () => {
    // The destination wash was removed: the slot alone marks where a drop goes.
    const { container } = renderList('parent');

    expect(container.querySelectorAll('.task-list--drop-target').length).toBe(0);
  });
});
