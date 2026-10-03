import { describe, it, expect } from "vitest";
import { formatTimeFields } from "../taskTime.js";

const empty = {
  due_time: null,
  deadline_date: null,
  deadline_time: null,
  deadline_timezone: null,
  duration_minutes: null,
};

describe("formatTimeFields", () => {
  it("returns nulls when no time data is set", () => {
    expect(formatTimeFields(empty)).toEqual({
      dueTime: null,
      deadlineDate: null,
      deadlineTime: null,
      deadlineTimezone: null,
      durationMinutes: null,
      startTime: null,
      endTime: null,
    });
  });

  it("trims TIMETZ values to HH:MM", () => {
    const fields = formatTimeFields({ ...empty, due_time: "14:30:00+00", deadline_time: "09:05:00-03" });
    expect(fields.dueTime).toBe("14:30");
    expect(fields.deadlineTime).toBe("09:05");
  });

  it("derives start and end from due time and duration", () => {
    const fields = formatTimeFields({ ...empty, due_time: "14:30:00+00", duration_minutes: 90 });
    expect(fields.startTime).toBe("14:30");
    expect(fields.endTime).toBe("16:00");
  });

  it("wraps the end time past midnight", () => {
    expect(formatTimeFields({ ...empty, due_time: "23:30:00+00", duration_minutes: 45 }).endTime).toBe("00:15");
  });

  it("leaves end time null without a start time", () => {
    const fields = formatTimeFields({ ...empty, duration_minutes: 30 });
    expect(fields.durationMinutes).toBe(30);
    expect(fields.startTime).toBeNull();
    expect(fields.endTime).toBeNull();
  });
});
