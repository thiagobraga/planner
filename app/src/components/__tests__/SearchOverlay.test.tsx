import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchOverlay } from '../SearchOverlay';
import type { Task } from '../TaskItem';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: undefined,
    priority: 0,
    dueDate: undefined,
    recurrenceRule: null,
    isCompleted: false,
    orderValue: 0,
    type: 'task',
    ...overrides,
  };
}

describe('SearchOverlay', () => {
  const onClose = vi.fn();
  const onSelectTask = vi.fn();
  const tasks = [
    makeTask({ id: 't1', title: 'Buy groceries' }),
    makeTask({ id: 't2', title: 'Call mom' }),
    makeTask({ id: 't3', title: 'Write tests' }),
  ];
  const collections = [
    { id: 'c1', name: 'Work' },
    { id: 'c2', name: 'Personal' },
  ];
  const labels = [
    { id: 'l1', name: 'urgent' },
    { id: 'l2', name: 'home' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SearchOverlay isOpen={false} onClose={onClose} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with search input when open', () => {
    render(<SearchOverlay isOpen={true} onClose={onClose} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search tasks, collections, labels…')).toBeInTheDocument();
  });

  it('shows hint when query is less than 2 characters', () => {
    render(<SearchOverlay isOpen={true} onClose={onClose} tasks={tasks} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'a' } });
    expect(screen.getByText(/Type at least 2 characters/)).toBeInTheDocument();
  });

  it('shows results for 2+ character query', () => {
    render(
      <SearchOverlay
        isOpen={true}
        onClose={onClose}
        tasks={tasks}
        collections={collections}
        labels={labels}
      />
    );
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'gro' } });
    expect(screen.getByText('Buy groceries')).toBeInTheDocument();
    expect(screen.queryByText(/Type at least 2 characters/)).not.toBeInTheDocument();
  });

  it('shows "No results" when query has no match', () => {
    render(
      <SearchOverlay
        isOpen={true}
        onClose={onClose}
        tasks={tasks}
        collections={collections}
        labels={labels}
      />
    );
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByText(/No results for/)).toBeInTheDocument();
    expect(screen.getByText(/zzz/)).toBeInTheDocument();
  });

  it('searches across tasks, collections, and labels', () => {
    render(
      <SearchOverlay
        isOpen={true}
        onClose={onClose}
        tasks={tasks}
        collections={collections}
        labels={[
          { id: 'l1', name: 'urgent' },
          { id: 'l2', name: 'tests' },
        ]}
      />
    );
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'es' } });
    expect(screen.getByText('Write tests')).toBeInTheDocument();
    expect(screen.getByText('tests')).toBeInTheDocument();
  });

  it('ArrowDown and ArrowUp navigate results', () => {
    render(
      <SearchOverlay
        isOpen={true}
        onClose={onClose}
        tasks={tasks}
        onSelectTask={onSelectTask}
      />
    );
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'test' } });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelectTask).toHaveBeenCalledWith('t3');
  });

  it('Enter selects active result', () => {
    render(
      <SearchOverlay
        isOpen={true}
        onClose={onClose}
        tasks={tasks}
        onSelectTask={onSelectTask}
      />
    );
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'test' } });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelectTask).toHaveBeenCalledWith('t3');
  });

  it('Enter does nothing when there are no results', () => {
    render(
      <SearchOverlay
        isOpen={true}
        onClose={onClose}
        tasks={tasks}
        onSelectTask={onSelectTask}
      />
    );
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'zzz' } });

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelectTask).not.toHaveBeenCalled();
  });

  it('Escape calls onClose', () => {
    render(<SearchOverlay isOpen={true} onClose={onClose} />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking a result selects the task', () => {
    render(
      <SearchOverlay
        isOpen={true}
        onClose={onClose}
        tasks={tasks}
        onSelectTask={onSelectTask}
      />
    );
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'buy' } });

    fireEvent.click(screen.getByText('Buy groceries'));
    expect(onSelectTask).toHaveBeenCalledWith('t1');
  });

  it('clicking the overlay background calls onClose', () => {
    render(<SearchOverlay isOpen={true} onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalled();
  });
});
