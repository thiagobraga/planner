import type { TaskTimeFields, TaskTimeRow } from "../types/task.js";

// TIMETZ comes back as "HH:MM:SS+TZ"; tasks store wall-clock times, so the API speaks HH:MM.
function toClock(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}

function addMinutes(clock: string, minutes: number): string {
  const [hours, mins] = clock.split(":").map(Number);
  const total = (hours * 60 + mins + minutes) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function formatTimeFields(row: TaskTimeRow): TaskTimeFields {
  const startTime = toClock(row.due_time);
  return {
    dueTime: startTime,
    deadlineDate: row.deadline_date,
    deadlineTime: toClock(row.deadline_time),
    deadlineTimezone: row.deadline_timezone,
    durationMinutes: row.duration_minutes,
    startTime,
    endTime: startTime && row.duration_minutes ? addMinutes(startTime, row.duration_minutes) : null,
  };
}
