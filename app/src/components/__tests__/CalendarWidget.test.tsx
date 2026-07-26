import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarWidget } from '../CalendarWidget';

function weekdayLabels(container: HTMLElement) {
  return [...container.querySelectorAll('.daily-calendar__weekdays span')].map((node) => node.textContent);
}

describe('CalendarWidget', () => {
  it('calls onDateClick when a day is selected', () => {
    const onDateClick = vi.fn();
    const { container } = render(
      <CalendarWidget
        activeDate="2026-07-15"
        today="2026-07-26"
        locale="en"
        weekStart="sunday"
        onDateClick={onDateClick}
      />,
    );

    fireEvent.click(container.querySelector('[data-date="2026-07-15"]') as HTMLElement);

    expect(onDateClick).toHaveBeenCalledWith('2026-07-15');
  });

  it('moves between months with the previous and next controls', () => {
    render(
      <CalendarWidget
        activeDate="2026-07-15"
        today="2026-07-26"
        locale="en"
        weekStart="sunday"
        onDateClick={vi.fn()}
      />,
    );

    expect(screen.getByText('July 2026')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('August 2026')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('July 2026')).toBeInTheDocument();
  });

  it('reorders weekday labels when the week starts on Monday', () => {
    const { container, rerender } = render(
      <CalendarWidget
        activeDate="2026-07-15"
        today="2026-07-26"
        locale="en"
        weekStart="sunday"
        onDateClick={vi.fn()}
      />,
    );

    expect(weekdayLabels(container)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);

    rerender(
      <CalendarWidget
        activeDate="2026-07-15"
        today="2026-07-26"
        locale="en"
        weekStart="monday"
        onDateClick={vi.fn()}
      />,
    );

    expect(weekdayLabels(container)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });
});
