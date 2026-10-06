import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardColumn } from '../BoardColumn';
import { PlannerDragProvider } from '../../../contexts/PlannerDragContext';

describe('BoardColumn', () => {
  it('replaces the empty drop target with a bottom inline task editor', async () => {
    const column = { id: 'status:todo' as const, value: 'todo', title: 'Todo', color: '#adb9c1', tasks: [] };
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlannerDragProvider>
        <BoardColumn
          collectionId="collection-1"
          groupBy="status"
          column={column}
          allTasks={[]}
          onCreate={onCreate}
        />
      </PlannerDragProvider>,
    );

    expect(container.querySelector('[data-column-id="status:todo"]')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Todo' })).toBeInTheDocument();
    expect(screen.queryByText('Drop work here')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Task title' }), { target: { value: 'Plan review' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('Plan review', column));
  });

  it('opts the inline task editor out of browser autofill', () => {
    const column = { id: 'status:todo' as const, value: 'todo', title: 'Todo', color: '#adb9c1', tasks: [] };
    render(
      <PlannerDragProvider>
        <BoardColumn collectionId="collection-1" groupBy="status" column={column} allTasks={[]} onCreate={vi.fn()} />
      </PlannerDragProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(screen.getByRole('textbox', { name: 'Task title' })).toHaveAttribute('autocomplete', 'off');
  });

  it('renders journal rows without card chrome in Kanban lists', () => {
    const column = {
      id: 'status:todo' as const,
      value: 'todo',
      title: 'Todo',
      color: '#adb9c1',
      tasks: [{
        id: 'task-1',
        title: 'Journal row',
        priority: 4,
        collectionId: 'collection-1',
        statusId: 'todo',
        isCompleted: false,
        orderValue: 0,
        depth: 0,
        type: 'task' as const,
      }],
    };
    const { container } = render(
      <PlannerDragProvider>
        <BoardColumn
          collectionId="collection-1"
          groupBy="status"
          column={column}
          allTasks={column.tasks}
          presentation="kanban-list"
        />
      </PlannerDragProvider>,
    );

    expect(container.querySelector('.board-column-lists')).toBeInTheDocument();
    expect(screen.getByText('Journal row')).toBeInTheDocument();
    expect(container.querySelector('.board-card')).not.toBeInTheDocument();
  });

  it('does not render a color dot before the column title', () => {
    const column = {
      id: 'status:todo' as const,
      value: 'todo',
      title: 'Todo',
      color: '#adb9c1',
      tasks: [],
    };
    const { container } = render(
      <PlannerDragProvider>
        <BoardColumn
          collectionId="collection-1"
          groupBy="status"
          column={column}
          allTasks={[]}
        />
      </PlannerDragProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Todo' })).toBeInTheDocument();
    expect(container.querySelector('.board-column-dot')).not.toBeInTheDocument();
  });
});
