/** The date/time facets a user edits together: planned day and time, hard deadline, expected length. */
export interface TaskSchedule {
  dueDate: string | null;
  dueTime: string | null;
  deadlineDate: string | null;
  deadlineTime: string | null;
  durationMinutes: number | null;
}
