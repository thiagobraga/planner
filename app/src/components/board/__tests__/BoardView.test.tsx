import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BoardView } from '../BoardView';
import { PlannerDragProvider } from '../../../contexts/PlannerDragContext';

describe('BoardView', () => {
  it('renders ordered columns and the status add-column affordance', () => {
    render(
      <PlannerDragProvider>
        <BoardView
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
});
