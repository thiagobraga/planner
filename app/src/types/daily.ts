import type { ApiTask } from '../api/client';

export interface DailyRangeView {
  from: string;
  to: string;
  today: string;
  overdue: ApiTask[];
  days: { date: string; tasks: ApiTask[] }[];
}
