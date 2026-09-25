import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardCard } from '../BoardCard';
import { PlannerDragProvider } from '../../../contexts/PlannerDragContext';

describe('BoardCard', () => {
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
