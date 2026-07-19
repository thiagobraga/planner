import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HabitCalendar } from '../habits/HabitCalendar';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
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

describe('HabitCalendar: inline rename', () => {
  const sections: HabitSections = {
    ungrouped: [habit('water', 'Drink water')],
    groups: [],
  };

  function renderCalendar(props: Partial<Parameters<typeof HabitCalendar>[0]> = {}) {
    return render(
      <PlannerDragProvider>
        <HabitCalendar
          sections={sections}
          today={new Date(2026, 6, 18)}
          year={2026}
          month={6}
          onMonthChange={vi.fn()}
          onToggleDay={vi.fn()}
          {...props}
        />
      </PlannerDragProvider>,
    );
  }

  it('starts editing a card heading on double-click', () => {
    const onStartEdit = vi.fn();
    renderCalendar({ onStartEdit });

    fireEvent.doubleClick(screen.getByText('Drink water'));

    expect(onStartEdit).toHaveBeenCalledWith({ kind: 'habit', id: 'water' });
  });

  it('commits the new name on Enter', () => {
    const onCommitEdit = vi.fn();
    renderCalendar({ editing: { kind: 'habit', id: 'water' }, onCommitEdit });

    const input = screen.getByPlaceholderText('Habit name');
    fireEvent.change(input, { target: { value: 'Hydrate' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommitEdit).toHaveBeenCalledWith({ kind: 'habit', id: 'water' }, 'Hydrate');
  });

  it('cancels on Escape without committing', () => {
    const onCommitEdit = vi.fn();
    const onCancelEdit = vi.fn();
    renderCalendar({ editing: { kind: 'habit', id: 'water' }, onCommitEdit, onCancelEdit });

    fireEvent.keyDown(screen.getByPlaceholderText('Habit name'), { key: 'Escape' });

    expect(onCancelEdit).toHaveBeenCalledWith({ kind: 'habit', id: 'water' });
    expect(onCommitEdit).not.toHaveBeenCalled();
  });

  it('keeps day cells out of the card drag so tracking still works', () => {
    const onToggleDay = vi.fn();
    const { container } = renderCalendar({ onToggleDay });

    const cell = container.querySelector('.habit-month-grid-cell:not([disabled])');
    expect(cell).toHaveAttribute('data-no-drag');
  });
});
