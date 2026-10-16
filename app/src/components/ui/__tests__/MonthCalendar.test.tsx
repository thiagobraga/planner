import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MonthCalendar } from '../MonthCalendar';

describe('MonthCalendar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const day = (iso: string) => document.querySelector<HTMLButtonElement>(`[data-date="${iso}"]`)!;

  it('opens on the selected month, rings today and fills the selection', () => {
    render(<MonthCalendar value="2026-10-17" onSelect={vi.fn()} weekStart="sunday" />);

    expect(screen.getByText('October 2026')).toBeInTheDocument();
    expect(day('2026-10-15')).toHaveAttribute('aria-current', 'date');
    expect(day('2026-10-17')).toHaveAttribute('aria-pressed', 'true');
    expect(day('2026-10-15')).toHaveAttribute('aria-pressed', 'false');
  });

  it('offsets the first day by the week start', () => {
    const { container, rerender } = render(<MonthCalendar value={null} onSelect={vi.fn()} weekStart="sunday" />);
    // 2026-10-01 is a Thursday
    expect(container.querySelectorAll('[data-calendar-blank]')).toHaveLength(4);

    rerender(<MonthCalendar value={null} onSelect={vi.fn()} weekStart="monday" />);
    expect(container.querySelectorAll('[data-calendar-blank]')).toHaveLength(3);
  });

  it('pages between months and reports the picked day', () => {
    const onSelect = vi.fn();
    render(<MonthCalendar value={null} onSelect={onSelect} weekStart="monday" />);

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('November 2026')).toBeInTheDocument();
    fireEvent.click(day('2026-11-03'));
    expect(onSelect).toHaveBeenCalledWith('2026-11-03');

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('September 2026')).toBeInTheDocument();
  });

  it('disables days after maxDate', () => {
    render(<MonthCalendar value={null} onSelect={vi.fn()} weekStart="monday" maxDate="2026-10-15" />);
    expect(day('2026-10-15')).toBeEnabled();
    expect(day('2026-10-16')).toBeDisabled();
  });
});
