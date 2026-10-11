import type { TaskTimeRow } from "./task.js";

export type DailyTaskRow = TaskTimeRow & {
  id: string;
  user_id: string;
  collection_id: string;
  section_id: string | null;
  parent_task_id: string | null;
  assignee_user_id: string | null;
  title: string;
  description: string | null;
  priority: number;
  due_date: string | Date;
  due_timezone: string | null;
  recurrence_rule: object | null;
  is_completed: boolean;
  completed_at: string | null;
  effective_order_value: number;
  depth: number;
  type: string;
  status_id: string | null;
  created_at: string;
  updated_at: string;
};
