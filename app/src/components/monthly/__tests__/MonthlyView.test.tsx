import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonthlyView } from '../MonthlyView';
import type { Task } from '../../TaskItem';

vi.mock('../MonthSelector', () => ({
  MonthSelector: ({
    year,
    month,
    onChange,
    className,
  }: {
    year: number;
    month: number;
    onChange: (y: number, m: number) => void;
    className?: string;
  }) => (
    <div data-testid="month-selector" className={className}>
      <button data-testid="prev-month" onClick={() => onChange(year, month - 1)}>
        Prev
      </button>
      <span data-testid="current-month">{month + 1}/{year}</span>
      <button data-testid="next-month" onClick={() => onChange(year, month + 1)}>
        Next
      </button>
    </div>
  ),
}));

describe('MonthlyView', () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-15`;

  const sampleTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Buy groceries',
      priority: 3,
      isCompleted: false,
      orderValue: 1,
      indent: 0,
      dueDate: dateStr,
      type: 'task',
    },
    {
      id: 'note-1',
      title: 'Meeting notes',
      priority: 4,
      isCompleted: false,
      orderValue: 2,
      indent: 0,
      dueDate: dateStr,
      type: 'note',
    },
    {
      id: 'event-1',
      title: 'Conference call',
      priority: 2,
      isCompleted: false,
      orderValue: 3,
      indent: 0,
      dueDate: dateStr,
      type: 'event',
    },
    {
      id: 'task-no-date',
      title: 'Unscheduled task',
      priority: 4,
      isCompleted: false,
      orderValue: 4,
      indent: 0,
    },
  ];

  it('renders MonthSelector and ledger structure', () => {
    render(<MonthlyView tasks={[]} onToggle={vi.fn()} />);

    expect(screen.getByTestId('month-selector')).toBeInTheDocument();
    expect(screen.getByTestId('current-month')).toHaveTextContent(`${month + 1}/${year}`);
  });

  it('slots tasks into correct day row by dueDate', () => {
    render(<MonthlyView tasks={sampleTasks} onToggle={vi.fn()} />);

    expect(screen.getByText('Buy groceries')).toBeInTheDocument();
    expect(screen.getByText('Meeting notes')).toBeInTheDocument();
    expect(screen.getByText('Conference call')).toBeInTheDocument();
    // Task without dueDate is placed in the "No date" section
    expect(screen.getByText('Unscheduled task')).toBeInTheDocument();
  });

  it('renders task types with proper markers', () => {
    render(<MonthlyView tasks={sampleTasks} onToggle={vi.fn()} />);

    // Note marker '-'
    expect(screen.getByText('-')).toBeInTheDocument();
    // Event marker '○'
    expect(screen.getByText('○')).toBeInTheDocument();
    // Task has toggle buttons (for dated task and undated task)
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(2);
  });

  it('calls onToggle when task checkbox button is clicked', () => {
    const onToggle = vi.fn();
    render(<MonthlyView tasks={sampleTasks} onToggle={onToggle} />);

    const toggleBtn = screen.getByRole('button', { name: /Buy groceries/ });
    fireEvent.click(toggleBtn);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('task-1');
  });

  it('navigates months when MonthSelector buttons are clicked', () => {
    render(<MonthlyView tasks={sampleTasks} onToggle={vi.fn()} />);

    fireEvent.click(screen.getByTestId('prev-month'));
    const prevMonthExpected = month === 0 ? 12 : month;
    const prevYearExpected = month === 0 ? year - 1 : year;
    expect(screen.getByTestId('current-month')).toHaveTextContent(`${prevMonthExpected}/${prevYearExpected}`);

    // Tasks for the original month should not be rendered in the previous month
    expect(screen.queryByText('Buy groceries')).not.toBeInTheDocument();
  });

  it('hides No date section when all tasks have due dates', () => {
    const datedTasks = sampleTasks.filter((t) => t.dueDate);
    render(<MonthlyView tasks={datedTasks} onToggle={vi.fn()} />);

    expect(screen.queryByText('No date')).not.toBeInTheDocument();
  });

  it('shows No date section when tasks without due dates are provided', () => {
    render(<MonthlyView tasks={sampleTasks} onToggle={vi.fn()} />);

    expect(screen.getByText('No date')).toBeInTheDocument();
    expect(screen.getByText('Unscheduled task')).toBeInTheDocument();
  });
});
