import type { DailyViewSettings, ViewLayout } from '../types/view';

/** Layouts Daily can show today, in menu order. Table and Calendar join in phase 2. */
export const DAILY_LAYOUTS: readonly ViewLayout[] = ['list', 'columns'];

export const DEFAULT_DAILY_SLUG: ViewLayout = 'list';

export function slugToLayout(slug: string | undefined): ViewLayout | null {
  return DAILY_LAYOUTS.find((layout) => layout === slug) ?? null;
}

export interface LegacyDailyView extends Partial<DailyViewSettings> {
  layout: ViewLayout;
}

const LEGACY: Record<string, LegacyDailyView> = {
  kanban: { layout: 'columns', style: 'notebook' },
  cards: { layout: 'columns', style: 'cards' },
  monthly: { layout: 'list', range: 'month' },
};

/** Old `/daily/<view>` URLs still open the view they used to show. */
export function legacyDailySlug(slug: string | undefined): LegacyDailyView | null {
  return slug && Object.hasOwn(LEGACY, slug) ? LEGACY[slug] : null;
}
