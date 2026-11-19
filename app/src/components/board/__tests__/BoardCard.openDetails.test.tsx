import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardCard } from '../BoardCard';
import { PlannerDragProvider } from '../../../contexts/PlannerDragContext';
import { OPEN_DELAY_MS, useTaskDetailStore } from '../../../stores/taskDetailStore';

const open = vi.fn();
const settle = () => act(() => { vi.advanceTimersByTime(OPEN_DELAY_MS + 10); });

function renderCard(onToggle = vi.fn(), onTaskContextMenu = vi.fn()) {
  render(
    <PlannerDragProvider>
      <BoardCard
        task={{ id: 'card-1', title: 'Ship board', priority: 1, collectionId: 'c', isCompleted: false, orderValue: 0, type: 'task' }}
        subtasks={[{ id: 'child-1', title: 'Write tests', priority: 4, collectionId: 'c', parentTaskId: 'card-1', isCompleted: false, orderValue: 0, type: 'task' }]}
        onToggle={onToggle}
        onTaskContextMenu={onTaskContextMenu}
      />
    </PlannerDragProvider>,
  );
  return { onToggle, onTaskContextMenu };
}

describe('BoardCard: opening details', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    open.mockClear();
    useTaskDetailStore.setState({ taskId: null, navigator: { open, close: vi.fn() }, origin: null, leaveGuard: null });
  });

  afterEach(() => vi.useRealTimers());

  it('opens the card on a plain click and the child on a click on its title', () => {
    renderCard();
    fireEvent.click(screen.getByText('Ship board'));
    settle();
    expect(open).toHaveBeenLastCalledWith('card-1', false);

    useTaskDetailStore.setState({ taskId: 'card-1' });
    fireEvent.click(screen.getByText('Write tests'));
    expect(open).toHaveBeenLastCalledWith('child-1', true);
  });

  it('completes without opening from the card and the child checkboxes', () => {
    const { onToggle } = renderCard();
    fireEvent.click(screen.getAllByLabelText('Complete task')[0]);
    fireEvent.click(screen.getAllByLabelText('Complete task')[1]);
    settle();
    expect(onToggle).toHaveBeenCalledWith('card-1', true);
    expect(onToggle).toHaveBeenCalledWith('child-1', true);
    expect(open).not.toHaveBeenCalled();
  });

  it('keeps the menu button and modified clicks from opening', () => {
    const { onTaskContextMenu } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'More options for Ship board' }));
    fireEvent.click(screen.getByText('Ship board'), { ctrlKey: true });
    settle();
    expect(onTaskContextMenu).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('opens with o on the focused card', () => {
    renderCard();
    const card = screen.getByText('Ship board').closest('article')!;
    fireEvent.keyDown(card, { key: 'o' });
    expect(open).toHaveBeenCalledWith('card-1', false);
  });
});
