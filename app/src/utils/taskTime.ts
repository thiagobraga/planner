export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function formatTimeWindow(start: string, end: string | null | undefined): string {
  return end ? `${start}-${end}` : start;
}

interface ApiScheduleFields {
  dueTime?: string | null;
  endTime?: string | null;
  deadlineDate?: string | null;
  deadlineTime?: string | null;
  durationMinutes?: number | null;
}

export function scheduleFieldsFromApi(t: ApiScheduleFields): Required<ApiScheduleFields> {
  return {
    dueTime: t.dueTime ?? null,
    endTime: t.endTime ?? null,
    deadlineDate: t.deadlineDate ? t.deadlineDate.slice(0, 10) : null,
    deadlineTime: t.deadlineTime ?? null,
    durationMinutes: t.durationMinutes ?? null,
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
