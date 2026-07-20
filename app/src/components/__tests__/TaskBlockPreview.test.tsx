import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TaskBlockPreview } from '../TaskBlockPreview';
import type { Task } from '../TaskItem';

function makeTask(overrides: Partial<Task> & { id: string; title: string }): Task {
  return {
    description: '',
    priority: 4,
    isCompleted: false,
    orderValue: 0,
    type: 'task',
    ...overrides,
  };
}

describe('TaskBlockPreview', () => {
  it('renders nothing when rows is empty', () => {
    const { container } = render(<TaskBlockPreview rows={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a single task row', () => {
    const task = makeTask({ id: '1', title: 'Buy groceries' });
    render(<TaskBlockPreview rows={[{ task, depth: 0 }]} />);

    expect(screen.getByText('Buy groceries')).toBeInTheDocument();
    expect(screen.getByText('•')).toBeInTheDocument();
  });

  it('renders multiple task rows', () => {
    const tasks = [
      { task: makeTask({ id: '1', title: 'Parent task' }), depth: 0 },
      { task: makeTask({ id: '2', title: 'Child task' }), depth: 1 },
    ];
    render(<TaskBlockPreview rows={tasks} />);

    expect(screen.getByText('Parent task')).toBeInTheDocument();
    expect(screen.getByText('Child task')).toBeInTheDocument();
  });

  it('applies strikethrough for completed tasks', () => {
    const task = makeTask({ id: '1', title: 'Done task', isCompleted: true });
    render(<TaskBlockPreview rows={[{ task, depth: 0 }]} />);

    const titleEl = screen.getByText('Done task');
    expect(titleEl.className).toContain('line-through');
  });

  it('shows note indicator for note type', () => {
    const task = makeTask({ id: '1', title: 'A note', type: 'note' });
    render(<TaskBlockPreview rows={[{ task, depth: 0 }]} />);

    expect(screen.getByText('-')).toBeInTheDocument();
  });
});
