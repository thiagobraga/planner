/** How tasks are arranged on a page. Table and Calendar arrive in phase 2. */
export type ViewLayout = 'list' | 'columns' | 'table' | 'calendar';

/** How each task looks: text on paper, or a bordered card. */
export type ViewStyle = 'notebook' | 'cards';

/** Named ranges offered by List and Table. */
export type RangePreset = 'today' | 'tomorrow' | 'week' | 'next7' | 'upcoming' | 'month';

/** Numeric ranges offered by Columns and Calendar. `month` is shared with the presets. */
export type RangeSpan = 'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'd6' | 'w1' | 'w2' | 'w3';

export type ViewRange = RangePreset | RangeSpan;

export interface DailyViewSettings {
  style: ViewStyle;
  range: ViewRange;
}

export interface ResolvedRange {
  from: string;
  to: string;
  /** Days without tasks are left out (Upcoming). */
  hideEmptyDays: boolean;
}

export type CollectionGroupBy = 'status' | 'section' | 'priority';
export type InboxGroupBy = 'none' | 'priority' | 'collection';
