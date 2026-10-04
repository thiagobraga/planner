export interface TaskTimeRow {
  due_time: string | null;
  deadline_date: string | Date | null;
  deadline_time: string | null;
  deadline_timezone: string | null;
  duration_minutes: number | null;
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
