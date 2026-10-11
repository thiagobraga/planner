import type { formatTask } from "../services/viewService.js";

export type DailyTask = ReturnType<typeof formatTask>;

export interface DailyDay {
  date: string;
  tasks: DailyTask[];
}

export interface DailyView {
  from: string;
  to: string;
  /** The user's current date, in their own timezone. */
  today: string;
  /** Every task due before `today`, whatever the requested range. */
  overdue: DailyTask[];
  /** One entry per day of the range, empty days included. */
  days: DailyDay[];
}
