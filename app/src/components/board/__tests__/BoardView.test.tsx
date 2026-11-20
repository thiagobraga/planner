import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BoardView } from '../BoardView';
import { PlannerDragProvider } from '../../../contexts/PlannerDragContext';

describe('BoardView', () => {
  it('renders ordered columns and the status add-column affordance', () => {
    render(
      <PlannerDragProvider>
        <BoardView
          collectionId="collection-1"
          groupBy="status"
          columns={[
            { id: 'status:backlog', value: 'backlog', title: 'Backlog', tasks: [] },
            { id: 'status:doing', value: 'doing', title: 'Doing', tasks: [] },
          ]}
          tasks={[]}
          canAddColumn
        />
      </PlannerDragProvider>,
    );

    expect(screen.getByTestId('board-view')).toBeInTheDocument();
    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual(['Backlog', 'Doing']);
    expect(screen.getByRole('button', { name: 'Add column' })).toBeInTheDocument();
  });

  it('shows each column\'s card count beside its name and sizes the grid to the columns', () => {
    const task = { id: 't1', title: 'Card', collectionId: 'collection-1', isCompleted: false, orderValue: 0, type: 'task' } as never;
    render(
      <PlannerDragProvider>
        <BoardView
          collectionId="collection-1"
          groupBy="status"
          columns={[
            { id: 'status:todo', value: 'todo', title: 'Todo', tasks: [task] },
            { id: 'status:done', value: 'done', title: 'Done', tasks: [] },
          ]}
          tasks={[task]}
        />
      </PlannerDragProvider>,
    );

    const todo = screen.getByRole('heading', { name: 'Todo' }).closest('header')!;
    expect(todo).toHaveTextContent(/^Todo1/);
    expect(screen.getByRole('heading', { name: 'Done' }).closest('header')).toHaveTextContent(/^Done0/);
    expect(screen.getByTestId('board-view').firstElementChild).toHaveStyle({ '--board-columns': '2' });
  });
});
