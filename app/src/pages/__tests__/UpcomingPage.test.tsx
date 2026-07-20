import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UpcomingPage } from '../UpcomingPage';

vi.mock('../../components/TaskList', () => ({
  TaskList: ({
    tasks,
    onTaskToggle,
    onIndent,
  }: {
    tasks: { id: string; title: string }[];
    onTaskToggle: (id: string) => void;
    onIndent: (id: string, dir: 1 | -1) => void;
  }) => (
    <div data-testid="task-list">
      {tasks.map((t) => (
        <div key={t.id} data-testid={`task-${t.id}`}>
          <span>{t.title}</span>
          <button data-testid={`toggle-${t.id}`} onClick={() => onTaskToggle(t.id)}>
            toggle
          </button>
          <button data-testid={`indent-${t.id}`} onClick={() => onIndent(t.id, 1)}>
            indent
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../../utils/phrases', () => ({
  getPhrase: () => 'See what is coming up in the next week',
}));

describe('UpcomingPage', () => {
  it('renders header with phrase', () => {
    render(<UpcomingPage />);

    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByText('See what is coming up in the next week')).toBeInTheDocument();
  });

  it('renders 7 day sections', () => {
    render(<UpcomingPage />);

    const dayLabels = screen.getAllByText(/^[A-Z]{3} \d+ [A-Z]{3}$/);
    expect(dayLabels).toHaveLength(7);
  });

  it('renders seed task data', () => {
    render(<UpcomingPage />);

    expect(screen.getByText('Team sync')).toBeInTheDocument();
    expect(screen.getByText('Deploy v0.2')).toBeInTheDocument();
    expect(screen.getByText('Write changelog')).toBeInTheDocument();
  });

  it('shows placeholder for days without tasks', () => {
    render(<UpcomingPage />);

    const placeholders = screen.getAllByText('-');
    expect(placeholders.length).toBeGreaterThanOrEqual(4);
  });

  it('toggles task completion', () => {
    render(<UpcomingPage />);

    const toggleBtns = screen.getAllByTestId(/^toggle-/);
    fireEvent.click(toggleBtns[0]);
  });

  it('indents a task', () => {
    render(<UpcomingPage />);

    const indentBtns = screen.getAllByTestId(/^indent-/);
    fireEvent.click(indentBtns[0]);
  });
});
