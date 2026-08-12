import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlannerDragProvider } from '../../../contexts/PlannerDragContext';
import { StatusTaskList } from '../StatusTaskList';

describe('StatusTaskList', () => {
  it('renders board statuses as list section headers with matching tasks', () => {
    render(
      <PlannerDragProvider>
        <StatusTaskList
          groups={[
            {
              id: 'backlog',
              title: 'Backlog',
              color: '#adb9c1',
              tasks: [{
                id: 'task-1', title: 'Design board columns', priority: 4,
                collectionId: 'collection-1', statusId: 'backlog', isCompleted: false,
                orderValue: 1000, type: 'task',
              }],
            },
            { id: 'done', title: 'Completed', color: '#8ca46a', tasks: [] },
          ]}
          taskListProps={{ collectionId: 'collection-1' }}
        />
      </PlannerDragProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Backlog' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Completed' })).toBeInTheDocument();
    expect(screen.getByText('Design board columns')).toBeInTheDocument();
  });
});
