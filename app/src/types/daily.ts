import type { ApiTask } from '../api/client';

/** The view segment of /daily/<view>. */
export type DailySlug = 'list' | 'kanban' | 'cards' | 'monthly';

export interface DailyRange {
  from: string;
  to: string;
}

export interface ApiDailyView extends DailyRange {
  today: string;
  overdue: ApiTask[];
  days: { date: string; tasks: ApiTask[] }[];
}
