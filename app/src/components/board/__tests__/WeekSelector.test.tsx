import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WeekSelector } from '../WeekSelector';
import { I18nProvider } from '../../../i18n/I18nContext';

const today = new Date(2026, 9, 3);
const RANGE = /09\/27 to 10\/03\/2026/;

function setup(overrides: Partial<React.ComponentProps<typeof WeekSelector>> = {}) {
  const onWeekChange = vi.fn();
  render(
    <I18nProvider>
      <WeekSelector
        weekAnchor={today}
        today={today}
        weekStart="sunday"
        onWeekChange={onWeekChange}
        {...overrides}
      />
    </I18nProvider>,
  );
  return { onWeekChange };
}

describe('WeekSelector', () => {
  it('shows the week range and shifts a week with the arrows', () => {
    const { onWeekChange } = setup();
    expect(screen.getByRole('button', { name: RANGE })).toHaveClass('ui-button');
    expect(screen.getByRole('button', { name: 'Previous week' })).toHaveClass('ui-button');
    expect(screen.getByRole('button', { name: 'Next week' })).toHaveClass('ui-button');

    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(onWeekChange).toHaveBeenLastCalledWith(new Date(2026, 8, 26));

    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(onWeekChange).toHaveBeenLastCalledWith(new Date(2026, 9, 10));
  });

  it('opens a calendar from the range button and picks the week of a clicked day', () => {
    const { onWeekChange } = setup();
    const trigger = screen.getByRole('button', { name: RANGE });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Previous month' })).toHaveClass('ui-button');
    expect(within(dialog).getByRole('button', { name: 'Next month' })).toHaveClass('ui-button');
    expect(within(dialog).getByText('October 2026')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '15' }));
    expect(onWeekChange).toHaveBeenCalledWith(new Date(2026, 9, 15));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('marks every day of the selected week in the calendar', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: RANGE }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: '1' })).toHaveAttribute('data-in-week', 'true');
    expect(within(dialog).getByRole('button', { name: '3' })).toHaveAttribute('data-in-week', 'true');
    expect(within(dialog).getByRole('button', { name: '4' })).not.toHaveAttribute('data-in-week');
  });

  it('browses months inside the calendar without changing the week', () => {
    const { onWeekChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: RANGE }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next month' }));
    expect(within(dialog).getByText('November 2026')).toBeInTheDocument();
    expect(onWeekChange).not.toHaveBeenCalled();
  });

  it('closes on Escape and on outside click', () => {
    setup();
    const trigger = screen.getByRole('button', { name: RANGE });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
