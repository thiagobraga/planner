import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DailyList } from '../DailyList';
import { I18nProvider } from '../../../i18n/I18nContext';
import { PlannerDragProvider } from '../../../contexts/PlannerDragContext';
import type { DailyListProps, DaySection } from '../../../types/daily';

const section = (key: string): DaySection => ({
  key,
  label: key,
  tasks: key < '2026-10-11' ? [{ id: key, title: key, priority: 4, isCompleted: false, orderValue: 0, type: 'task' } as DaySection['tasks'][number]] : [],
});

function renderList(overrides: Partial<DailyListProps>) {
  const props: DailyListProps = {
    futureSections: [],
    currentSections: [],
    todayKey: '2026-10-11',
    isPreview: false,
    todaySectionRef: { current: null },
    inputRef: { current: null },
    input: '',
    onInputChange: vi.fn(),
    onAddToday: vi.fn(),
    onAddTodayKeyDown: vi.fn(),
    futureInputs: {},
    onFutureInputChange: vi.fn(),
    onAddFuture: vi.fn(),
    onTaskToggle: vi.fn(),
    taskListProps: {} as DailyListProps['taskListProps'],
    ...overrides,
  };
  return render(<I18nProvider><PlannerDragProvider><DailyList {...props} /></PlannerDragProvider></I18nProvider>);
}

describe('DailyList', () => {
  it('shows today first, then upcoming days soonest first, then one Migrate group for past days', () => {
    const { container } = renderList({
      futureSections: [section('2026-10-12'), section('2026-10-13')],
      currentSections: [section('2026-10-11'), section('2026-10-10'), section('2026-09-26')],
    });
    const order = Array.from(container.querySelectorAll('[data-day-date]')).map((el) => el.getAttribute('data-day-date'));
    expect(order).toEqual(['2026-10-11', '2026-10-12', '2026-10-13', 'migrate']);
  });
});
