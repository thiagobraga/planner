import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchMonthNotes } from '../../../api/client';
import { MonthlyRows } from '../MonthlyRows';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/client')>()),
  fetchMonthNotes: vi.fn(),
}));

vi.mock('../../../hooks/useSync', () => ({
  useSync: vi.fn(),
}));

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

const mockFetchMonthNotes = vi.mocked(fetchMonthNotes);

function renderRows(year: number, month: number, onMonthChange = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MonthlyRows year={year} month={month} onMonthChange={onMonthChange} />
    </QueryClientProvider>,
  );
}

describe('MonthlyRows', () => {
  beforeEach(() => {
    mockFetchMonthNotes.mockReset();
    mockFetchMonthNotes.mockResolvedValue({
      notesByDate: {},
      year: 2026,
      month: 7,
    });
  });

  it('renders without crashing', () => {
    renderRows(2026, 6);
    expect(screen.getByTestId('month-selector')).toBeInTheDocument();
  });

  it('renders month navigation (prev/next buttons)', () => {
    renderRows(2026, 6);
    expect(screen.getByTestId('prev-month')).toBeInTheDocument();
    expect(screen.getByTestId('next-month')).toBeInTheDocument();
  });

  it('calls onMonthChange when navigating prev', () => {
    const onMonthChange = vi.fn();
    renderRows(2026, 6, onMonthChange);
    fireEvent.click(screen.getByTestId('prev-month'));
    expect(onMonthChange).toHaveBeenCalledWith(2026, 5);
  });

  it('calls onMonthChange when navigating next', () => {
    const onMonthChange = vi.fn();
    renderRows(2026, 6, onMonthChange);
    fireEvent.click(screen.getByTestId('next-month'));
    expect(onMonthChange).toHaveBeenCalledWith(2026, 7);
  });

  it('renders days of month', () => {
    renderRows(2026, 6);
    for (let day = 1; day <= 31; day++) {
      expect(screen.getByText(String(day))).toBeInTheDocument();
    }
  });
});
