import { render, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
import { useTaskDrag } from '../useTaskDrag';
import type { Task } from '../../components/TaskItem';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  apiMoveTask: vi.fn(),
}));

const tasks: Task[] = [
  { id: 'a', title: 'A', priority: 4, isCompleted: false, orderValue: 0, type: 'task' },
  { id: 'b', title: 'B', priority: 4, isCompleted: false, orderValue: 1000, type: 'task' },
];

/**
 * Captures every value the hook pushes through setTasks, so a test can assert
 * not just the final state but that nothing invalid was ever emitted.
 */
function Harness({ onUpdate }: { onUpdate: (next: unknown) => void }) {
  useTaskDrag({
    tasks,
    setTasks: (updater) => onUpdate(updater(tasks)),
    scope: { kind: 'collection', collectionId: 'c1' },
  });
  return null;
}

describe('useTaskDrag: cancelling a drag', () => {
  it('never emits a non-array, which would blank the page', () => {
    const emitted: unknown[] = [];
    const { unmount } = render(
      <PlannerDragProvider>
        <Harness onUpdate={(next) => emitted.push(next)} />
      </PlannerDragProvider>,
    );

    // dnd-kit fires cancel on Escape; drive it the way the provider would.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    for (const value of emitted) {
      expect(Array.isArray(value), `emitted a non-array: ${String(value)}`).toBe(true);
    }
    unmount();
  });

  it('leaves task state untouched, because a cancel has nothing to undo', () => {
    const emitted: unknown[] = [];
    render(
      <PlannerDragProvider>
        <Harness onUpdate={(next) => emitted.push(next)} />
      </PlannerDragProvider>,
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    // The optimistic move is applied on drop, so cancelling should not write at
    // all - reassigning identical state would only churn the list.
    expect(emitted).toHaveLength(0);
  });
});
