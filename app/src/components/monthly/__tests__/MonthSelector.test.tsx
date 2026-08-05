import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/I18nContext';
import { MonthSelector } from '../MonthSelector';

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.removeItem('planner_locale');
});

describe('MonthSelector', () => {
  it('renders Brazilian Portuguese month abbreviations without periods', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 5));
    window.localStorage.setItem('planner_locale', 'pt-BR');

    const { container } = render(
      <I18nProvider>
        <MonthSelector year={2026} month={7} onChange={vi.fn()} />
      </I18nProvider>,
    );

    const selectedMonth = screen.getByRole('button', { current: 'date' });
    expect(selectedMonth).toHaveClass('month-strip-card--current');
    expect(container.querySelectorAll('.month-strip-card--current')).toHaveLength(1);
    expect(within(selectedMonth).getByText('AGO')).toBeInTheDocument();
    expect(screen.queryByText('AGO.')).not.toBeInTheDocument();
    expect(selectedMonth).toHaveClass('flex-col', 'items-center', 'justify-center');
    expect(within(selectedMonth).getByText('2026')).toHaveClass('text-ink-light', 'font-medium');
    const monthTrack = container.querySelector<HTMLElement>('.month-strip-track');
    expect(monthTrack).toHaveStyle({ gridTemplateColumns: 'repeat(25, 60px)' });
    expect(monthTrack?.querySelectorAll('.month-strip-card')).toHaveLength(25);

    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));

    expect(monthTrack).toHaveStyle({ transform: 'translateX(-84px)' });
    expect(monthTrack?.querySelectorAll('.month-strip-card')).toHaveLength(25);
  });
});
