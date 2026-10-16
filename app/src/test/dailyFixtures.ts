import type {ApiTask} from '../types/api';
import type { ApiDailyView } from '../types/daily';

function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A one-day /daily response: `today` becomes that day's tasks, `overdue` the overdue list. */
export function dailyView({ overdue = [], today = [] }: { overdue?: ApiTask[]; today?: ApiTask[] }, todayKey = localKey(new Date())): ApiDailyView {
  return { from: todayKey, to: todayKey, today: todayKey, overdue, days: [{ date: todayKey, tasks: today }] };
}
