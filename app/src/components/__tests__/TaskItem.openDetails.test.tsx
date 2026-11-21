import { act, fireEvent, render, screen } from '@testing-library/react';
import { SortableContext } from '@dnd-kit/sortable';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskItem } from '../TaskItem';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
import { OPEN_DELAY_MS, useTaskDetailStore } from '../../stores/taskDetailStore';
import { useCheckboxStore } from '../../stores/checkboxStore';
import type { Task } from '../../types/task';

const open = vi.fn();

function renderRow(props: Partial<React.ComponentProps<typeof TaskItem>> = {}) {
  const task: Task = { id: 't1', title: 'Write the thing', priority: 4, isCompleted: false, orderValue: 0, type: 'task', dueDate: '2026-11-20' };
  return render(
    <PlannerDragProvider>
      <SortableContext items={[task.id]}>
        <TaskItem task={task} {...props} />
      </SortableContext>
    </PlannerDragProvider>,
  );
}

const row = () => screen.getByRole('button', { name: /^Write the thing/ });
const settle = () => act(() => { vi.advanceTimersByTime(OPEN_DELAY_MS + 10); });

describe('TaskItem: opening details', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    open.mockClear();
    useTaskDetailStore.setState({ taskId: null, navigator: { open, close: vi.fn() }, origin: null, leaveGuard: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => useCheckboxStore.setState({ enabled: false }));
  });

  it('opens on a plain click on the title area', () => {
    renderRow();
    fireEvent.click(screen.getByText('Write the thing'));
    settle();
    expect(open).toHaveBeenCalledWith('t1', false);
  });

  it('opens immediately when the panel already shows another item', () => {
    useTaskDetailStore.setState({ taskId: 'other' });
    renderRow();
    fireEvent.click(row());
    expect(open).toHaveBeenCalledWith('t1', true);
  });

  it('does not open on the completion control', () => {
    const onToggle = vi.fn();
    renderRow({ onToggle });
    fireEvent.click(screen.getByRole('button', { name: /complete/i }));
    settle();
    expect(onToggle).toHaveBeenCalledWith('t1');
    expect(open).not.toHaveBeenCalled();
  });

  it('does not open on the square checkbox either', () => {
    useCheckboxStore.setState({ enabled: true });
    const onToggle = vi.fn();
    renderRow({ onToggle });
    fireEvent.click(screen.getByRole('checkbox'));
    settle();
    expect(onToggle).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('keeps Ctrl/Cmd-click as multi-select', () => {
    renderRow();
    fireEvent.click(row(), { ctrlKey: true });
    fireEvent.click(row(), { metaKey: true });
    settle();
    expect(open).not.toHaveBeenCalled();
  });

  it('keeps double-click as inline rename without opening', () => {
    const onStartEdit = vi.fn();
    renderRow({ onStartEdit });
    fireEvent.click(row(), { detail: 1 });
    fireEvent.click(row(), { detail: 2 });
    fireEvent.doubleClick(row());
    settle();
    expect(onStartEdit).toHaveBeenCalledWith('t1');
    expect(open).not.toHaveBeenCalled();
  });

  it('does not open while text is selected', () => {
    renderRow();
    const range = document.createRange();
    range.selectNodeContents(screen.getByText('Write the thing'));
    window.getSelection()!.addRange(range);
    fireEvent.click(row());
    settle();
    window.getSelection()!.removeAllRanges();
    expect(open).not.toHaveBeenCalled();
  });

  it('does not open from a right click', () => {
    renderRow({ onRightClick: vi.fn() });
    fireEvent.contextMenu(row());
    settle();
    expect(open).not.toHaveBeenCalled();
  });

  it('opens with o on the focused row and moves focus into the panel', () => {
    const onAddBelow = vi.fn();
    renderRow({ onAddBelow });
    row().focus();
    fireEvent.keyDown(row(), { key: 'o' });
    expect(open).toHaveBeenCalledWith('t1', false);
    expect(useTaskDetailStore.getState().origin).toBe(row());
    fireEvent.keyDown(row(), { key: 'Enter' });
    expect(onAddBelow).toHaveBeenCalledWith('t1');
  });

  it('cancels a pending click open when a row shortcut runs first', () => {
    const onIndent = vi.fn();
    renderRow({ onIndent });
    fireEvent.click(row());
    fireEvent.keyDown(row(), { key: 'Tab' });
    settle();
    expect(onIndent).toHaveBeenCalledWith('t1', 1);
    expect(open).not.toHaveBeenCalled();

    fireEvent.click(row());
    fireEvent.keyDown(row(), { key: ']' });
    settle();
    expect(onIndent).toHaveBeenCalledWith('t1', -1);
    expect(open).not.toHaveBeenCalled();
  });

  it('cancels a pending click open when the context menu opens', () => {
    const onRightClick = vi.fn();
    renderRow({ onRightClick });
    fireEvent.click(row());
    fireEvent.contextMenu(row());
    settle();
    expect(onRightClick).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
