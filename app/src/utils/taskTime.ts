export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function formatTimeWindow(start: string, end: string | null | undefined): string {
  return end ? `${start}-${end}` : start;
}

import type { RecurrenceRule, TaskSchedule } from '../types/task';

interface ApiScheduleFields {
  dueTime?: string | null;
  endTime?: string | null;
  deadlineDate?: string | null;
  deadlineTime?: string | null;
  durationMinutes?: number | null;
  recurrenceRule?: RecurrenceRule | null;
}

export function scheduleFieldsFromApi(t: ApiScheduleFields): Required<ApiScheduleFields> {
  return {
    dueTime: t.dueTime ?? null,
    endTime: t.endTime ?? null,
    deadlineDate: t.deadlineDate ? t.deadlineDate.slice(0, 10) : null,
    deadlineTime: t.deadlineTime ?? null,
    durationMinutes: t.durationMinutes ?? null,
    recurrenceRule: t.recurrenceRule ?? null,
  };
}

/** HH:MM plus minutes, wrapping past midnight. */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** The task as it will look once the server stores `schedule`; used to show a save before it lands. */
export function applySchedule<T extends { dueDate?: string }>(task: T, schedule: TaskSchedule): T {
  return {
    ...task,
    ...schedule,
    dueDate: schedule.dueDate ?? undefined,
    endTime: schedule.dueTime && schedule.durationMinutes ? addMinutes(schedule.dueTime, schedule.durationMinutes) : null,
  };
}

/** Times are wall-clock; the browser's zone is sent alongside so the server knows which wall. */
export function withTimeZones<T extends { dueTime: string | null; deadlineTime: string | null }>(schedule: T) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    ...schedule,
    dueTimezone: schedule.dueTime ? zone : null,
    deadlineTimezone: schedule.deadlineTime ? zone : null,
  };
}
