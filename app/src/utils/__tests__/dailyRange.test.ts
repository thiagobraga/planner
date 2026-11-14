import { describe, it, expect } from 'vitest';
import { DAILY_LAYOUTS, DEFAULT_DAILY_SLUG, legacyDailySlug, slugToLayout } from '../dailyRange';

describe('daily slugs', () => {
  it('maps each available layout to its own slug', () => {
    expect(DAILY_LAYOUTS).toEqual(['list', 'columns']);
    for (const layout of DAILY_LAYOUTS) expect(slugToLayout(layout)).toBe(layout);
    expect(DEFAULT_DAILY_SLUG).toBe('list');
  });

  it('rejects unknown and unreleased slugs', () => {
    expect(slugToLayout('weekly')).toBeNull();
    expect(slugToLayout('table')).toBeNull();
    expect(slugToLayout(undefined)).toBeNull();
  });

  it('translates the old view slugs into the new model', () => {
    expect(legacyDailySlug('kanban')).toEqual({ layout: 'columns', style: 'notebook' });
    expect(legacyDailySlug('cards')).toEqual({ layout: 'columns', style: 'cards' });
    expect(legacyDailySlug('monthly')).toEqual({ layout: 'list', range: 'month' });
    expect(legacyDailySlug('list')).toBeNull();
  });
});
