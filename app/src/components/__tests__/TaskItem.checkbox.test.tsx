import { render, screen, fireEvent, act } from '@testing-library/react';
import { SortableContext } from '@dnd-kit/sortable';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskItem, type Task } from '../TaskItem';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
import { useCheckboxStore } from '../../stores/checkboxStore';

const task: Task = { id: 't1', title: 'Buy milk', priority: 4, isCompleted: false, orderValue: 0, type: 'task' };

function renderRow(onToggle = vi.fn(), t: Task = task) {
  render(
    <PlannerDragProvider>
      <SortableContext items={[t.id]}>
        <TaskItem task={t} onToggle={onToggle} />
      </SortableContext>
    </PlannerDragProvider>,
  );
  return onToggle;
}

describe('TaskItem checkbox setting', () => {
  afterEach(() => act(() => useCheckboxStore.setState({ enabled: false })));

  it('keeps the dot toggle by default', () => {
    renderRow();
    expect(screen.getByRole('button', { name: 'Complete: Buy milk', pressed: false })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('renders a checkbox that toggles the task when enabled', () => {
    act(() => useCheckboxStore.setState({ enabled: true }));
    const onToggle = renderRow();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith('t1');
  });

  it('shows the checkbox checked for a completed task', () => {
    act(() => useCheckboxStore.setState({ enabled: true }));
    renderRow(vi.fn(), { ...task, isCompleted: true });
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
