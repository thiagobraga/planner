import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HabitCalendar } from '../habits/HabitCalendar';
import type { HabitNode, HabitSections } from '../../utils/habitTree';

function habit(id: string, name: string, children: HabitNode[] = []): HabitNode {
  return {
    id,
    name,
    parentId: null,
    groupId: null,
    orderValue: 0,
    completions: new Set(),
    children,
  };
}

describe('HabitCalendar', () => {
  it('renders parent habits without separate sub-habit cards', () => {
    const child = { ...habit('child', 'Drink 1L'), parentId: 'water' };
    const sections: HabitSections = {
      ungrouped: [habit('water', 'Drink water', [child])],
      groups: [],
    };

    render(
      <HabitCalendar
        sections={sections}
        today={new Date(2026, 6, 18)}
        year={2026}
        month={6}
        onMonthChange={vi.fn()}
        onToggleDay={vi.fn()}
      />,
    );

    expect(screen.getByText('Drink water')).toBeInTheDocument();
    expect(screen.queryByText('Drink 1L')).not.toBeInTheDocument();
  });

  it('shows low-opacity day numbers for future dates in the selected month', () => {
    const sections: HabitSections = {
      ungrouped: [habit('water', 'Drink water')],
      groups: [],
    };

    const { container } = render(
      <HabitCalendar
        sections={sections}
        today={new Date(2026, 6, 18)}
        year={2026}
        month={6}
        onMonthChange={vi.fn()}
        onToggleDay={vi.fn()}
      />,
    );

    const futureCells = [...container.querySelectorAll('.habit-month-grid-cell-future')];
    expect(futureCells.map((cell) => cell.textContent)).toEqual(
      Array.from({ length: 13 }, (_, index) => String(index + 19)),
    );
    expect(futureCells.every((cell) => cell.classList.contains('opacity-35'))).toBe(true);
  });
});
