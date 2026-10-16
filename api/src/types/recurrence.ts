export interface RecurrenceRule {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // 1-999
  weekdays?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat (for weekly)
  dayOfMonth?: number; // 1-31 (for monthly)
  month?: number; // 1-12 (for yearly)
  fromCompletion?: boolean; // count the next occurrence from the completion day
  until?: string; // YYYY-MM-DD, last day an occurrence may fall on
}

export interface DueDate {
  date: string;
  time?: string; // HH:MM (24h)
  timezone?: string; // IANA timezone
  recurrence?: RecurrenceRule;
}
