import type { formatTask } from "../services/viewService.js";

export type DailyTask = ReturnType<typeof formatTask>;

export interface ViewPreferencesRow {
  time_zone: string;
  hide_completed_tasks: boolean;
  show_notes: boolean;
}

export interface ViewStatusRow {
  id: string;
  collection_id: string;
  name: string;
  color: string;
  completion_status_id: string | null;
  order_value: number;
  next_status_mode: "default" | "custom" | "disabled";
  next_status_id: string | null;
  accept_status_id: string | null;
  reject_status_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoardOrderRow {
  task_id: string;
  scope_type: "status" | "priority";
  position: number;
}

export interface ViewOptions {
  /** A board grouped by status shows its completion column even when completed tasks are hidden. */
  includeCompleted?: boolean;
}

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
