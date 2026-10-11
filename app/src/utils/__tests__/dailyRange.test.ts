import { describe, it, expect } from 'vitest';
import { dailyRange, slugToView, viewToSlug, DEFAULT_DAILY_SLUG } from '../dailyRange';

// Wednesday 2026-10-07
const ANCHOR = new Date(2026, 9, 7);

describe('dailyRange', () => {
  it('asks for today through the end of the selected week in list view', () => {
    expect(dailyRange('list', ANCHOR, 'sunday')).toEqual({ from: '2026-10-07', to: '2026-10-10' });
  });

  it('honors Monday week start in list view', () => {
    expect(dailyRange('list', ANCHOR, 'monday')).toEqual({ from: '2026-10-07', to: '2026-10-11' });
  });

  it.each(['kanban-list', 'kanban'] as const)('asks for the visible week in %s, Sunday first', (view) => {
    expect(dailyRange(view, ANCHOR, 'sunday')).toEqual({ from: '2026-10-04', to: '2026-10-10' });
  });

  it('starts the week on Monday when the preference says so', () => {
    expect(dailyRange('kanban', ANCHOR, 'monday')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
  });

  it('asks for one day at the end of the current week', () => {
    expect(dailyRange('list', new Date(2026, 9, 10), 'sunday')).toEqual({ from: '2026-10-10', to: '2026-10-10' });
  });

  it('asks for the whole visible month in the calendar', () => {
    expect(dailyRange('calendar', ANCHOR, 'sunday')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(dailyRange('calendar', new Date(2024, 1, 10), 'sunday')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });

  it('never exceeds the 42 days the API accepts', () => {
    for (const view of ['list', 'kanban-list', 'kanban', 'calendar'] as const) {
      const { from, to } = dailyRange(view, ANCHOR, 'sunday');
      const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
      expect(days).toBeLessThanOrEqual(42);
    }
  });
});

describe('daily view slugs', () => {
  it('maps each route segment to a board view and back', () => {
    expect(slugToView('list')).toBe('list');
    expect(slugToView('kanban')).toBe('kanban-list');
    expect(slugToView('cards')).toBe('kanban');
    expect(slugToView('monthly')).toBe('calendar');
    for (const slug of ['list', 'kanban', 'cards', 'monthly'] as const) {
      expect(viewToSlug(slugToView(slug))).toBe(slug);
    }
  });

  it('treats an unknown segment as no view', () => {
    expect(slugToView('weekly')).toBeNull();
    expect(slugToView(undefined)).toBeNull();
    expect(DEFAULT_DAILY_SLUG).toBe('list');
  });
});
