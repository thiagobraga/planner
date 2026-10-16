/** Mirrors api/src/types/recurrence.ts. */
export interface RecurrenceRule {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  /** 0=Sun ... 6=Sat, for weekly rules. */
  weekdays?: number[];
  dayOfMonth?: number;
  month?: number;
  /** Count the next occurrence from the completion day instead of the scheduled date. */
  fromCompletion?: boolean;
  /** YYYY-MM-DD, last day an occurrence may fall on. */
  until?: string;
}

/** The date/time facets a user edits together: planned day and time, hard deadline, expected length, repeat. */
export interface TaskSchedule {
  dueDate: string | null;
  dueTime: string | null;
  deadlineDate: string | null;
  deadlineTime: string | null;
  durationMinutes: number | null;
  recurrenceRule: RecurrenceRule | null;
}
