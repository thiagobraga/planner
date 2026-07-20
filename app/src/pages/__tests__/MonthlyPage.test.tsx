import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonthlyPage } from '../MonthlyPage';

const mockOnMonthChange = vi.fn();

vi.mock('../../components/monthly/MonthlyRows', () => ({
  MonthlyRows: ({
    year,
    month,
    onMonthChange,
  }: {
    year: number;
    month: number;
    onMonthChange: (y: number, m: number) => void;
  }) => (
    <div data-testid="monthly-rows">
      <span data-testid="year">{year}</span>
      <span data-testid="month">{month}</span>
      <button data-testid="prev-month" onClick={() => onMonthChange(year, month - 1)}>
        Prev
      </button>
      <button data-testid="next-month" onClick={() => onMonthChange(year, month + 1)}>
        Next
      </button>
    </div>
  ),
}));

vi.mock('../../utils/phrases', () => ({
  getPhrase: () => 'See the full month at a glance',
}));

describe('MonthlyPage', () => {
  it('renders header with phrase', () => {
    render(<MonthlyPage />);

    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('See the full month at a glance')).toBeInTheDocument();
  });

  it('renders MonthlyRows component', () => {
    render(<MonthlyPage />);

    expect(screen.getByTestId('monthly-rows')).toBeInTheDocument();
  });

  it('renders Today button', () => {
    render(<MonthlyPage />);

    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
  });

  it('passes current year and month to MonthlyRows', () => {
    render(<MonthlyPage />);

    const now = new Date();
    expect(screen.getByTestId('year')).toHaveTextContent(String(now.getFullYear()));
    expect(screen.getByTestId('month')).toHaveTextContent(String(now.getMonth()));
  });
});
