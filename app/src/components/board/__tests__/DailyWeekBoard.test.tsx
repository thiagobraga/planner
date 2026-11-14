import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DailyWeekBoard } from '../DailyWeekBoard';
import { I18nProvider } from '../../../i18n/I18nContext';
import { PlannerDragProvider } from '../../../contexts/PlannerDragContext';

const rect = (left: number, width: number) => ({ left, width, right: left + width, top: 0, bottom: 0, height: 0, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;

describe('DailyWeekBoard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('scrolls the board so the today column sits at the left edge on load', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.dataset.testid === 'daily-week-board') return rect(0, 400);
      if (this.dataset.today === 'true') return rect(900, 220);
      return rect(0, 0);
    });

    render(
      <I18nProvider>
        <PlannerDragProvider>
          <DailyWeekBoard
            tasks={[]}
            from="2026-09-27"
            to="2026-10-03"
            todayKey="2026-10-02"
            dateFormat="MMM DD ddd"
            onToggle={vi.fn()}
            onCreate={vi.fn()}
            presentation="kanban"
          />
        </PlannerDragProvider>
      </I18nProvider>,
    );

    // 900 (column left) - 0 (board left)
    expect(screen.getByTestId('daily-week-board').scrollLeft).toBe(900);
    spy.mockRestore();
  });
});
