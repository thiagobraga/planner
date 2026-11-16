export interface TaskTimeRow {
  due_time: string | null;
  deadline_date: string | Date | null;
  deadline_time: string | null;
  deadline_timezone: string | null;
  duration_minutes: number | null;
}

export interface ViewTaskRow extends TaskTimeRow {
  id: string;
  user_id: string;
  collection_id: string;
  section_id: string | null;
  parent_task_id: string | null;
  assignee_user_id: string | null;
  title: string;
  description: string | null;
  priority: number;
  due_date: string | Date | null;
  due_timezone: string | null;
  recurrence_rule: object | null;
  is_completed: boolean;
  completed_at: string | null;
  order_value: number;
  effective_order_value?: number;
  depth: number;
  type: string;
  status_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskTimeFields {
  dueTime: string | null;
  deadlineDate: string | Date | null;
  deadlineTime: string | null;
  deadlineTimezone: string | null;
  durationMinutes: number | null;
  startTime: string | null;
  endTime: string | null;
}
