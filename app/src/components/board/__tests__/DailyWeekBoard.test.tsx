import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DailyWeekBoard } from '../DailyWeekBoard';
import { I18nProvider } from '../../../i18n/I18nContext';
import { PlannerDragProvider } from '../../../contexts/PlannerDragContext';

const rect = (left: number, width: number) => ({ left, width, right: left + width, top: 0, bottom: 0, height: 0, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;

describe('DailyWeekBoard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('scrolls the board so the today column is centered on load', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.dataset.testid === 'daily-week-board') return rect(0, 400);
      if (this.dataset.today === 'true') return rect(900, 220);
      return rect(0, 0);
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
    const today = new Date(2026, 9, 2);

    render(
      <I18nProvider>
        <PlannerDragProvider>
          <DailyWeekBoard
            tasks={[]}
            weekAnchor={today}
            today={today}
            todayKey="2026-10-02"
            weekStart="sunday"
            dateFormat="MMM DD ddd"
            onWeekChange={vi.fn()}
            onToggle={vi.fn()}
            onCreate={vi.fn()}
            presentation="kanban"
          />
        </PlannerDragProvider>
      </I18nProvider>,
    );

    // 900 (column left) - 0 (board left) - (400 - 220) / 2 = 810
    expect(screen.getByTestId('daily-week-board').scrollLeft).toBe(810);
    spy.mockRestore();
  });
});
