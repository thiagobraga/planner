import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DatePickerSpecimen } from '../monthly/DatePickerSpecimen';
import { MonthlyCalendarSpecimen } from '../monthly/MonthlyCalendarSpecimen';
import { weekdayColumnIndex } from '../../utils/date';

function labels(container: HTMLElement) {
  return [...container.querySelectorAll('[data-weekday-label]')].map((node) => node.textContent);
}

describe('Styleguide calendar week starts', () => {
  it('reorders the monthly calendar specimen and preserves its fixed Friday start', () => {
    const { container, rerender } = render(<MonthlyCalendarSpecimen weekStart="sunday" />);

    expect(labels(container)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(container.querySelectorAll('[data-calendar-blank]')).toHaveLength(5);

    rerender(<MonthlyCalendarSpecimen weekStart="monday" />);

    expect(labels(container)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(container.querySelectorAll('[data-calendar-blank]')).toHaveLength(4);
  });

  it('reorders the interactive calendar and recalculates the current month offset', () => {
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay();
    const { container, rerender } = render(<DatePickerSpecimen weekStart="sunday" />);

    expect(labels(container)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    expect(container.querySelectorAll('[data-calendar-blank]')).toHaveLength(
      weekdayColumnIndex(firstDay, 'sunday'),
    );

    rerender(<DatePickerSpecimen weekStart="monday" />);

    expect(labels(container)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(container.querySelectorAll('[data-calendar-blank]')).toHaveLength(
      weekdayColumnIndex(firstDay, 'monday'),
    );
  });
});
