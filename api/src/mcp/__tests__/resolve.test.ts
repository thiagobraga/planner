import { describe, it, expect } from "vitest";
import { resolveDue, todayFor, assertUuid, ToolInputError } from "../resolve.js";

// 23:30 UTC on a Tuesday: still Tuesday in London, already Wednesday in Tokyo,
// still Tuesday afternoon in Sao Paulo.
const NOW = new Date("2026-10-06T23:30:00Z");

describe("resolveDue", () => {
  it("passes ISO dates through untouched", () => {
    expect(resolveDue("2026-12-24", "UTC", NOW)).toEqual({ dueDate: "2026-12-24", dueTime: null, recurrenceRule: null });
  });

  it("resolves relative phrases against the user's own today", () => {
    expect(resolveDue("today", "America/Sao_Paulo", NOW).dueDate).toBe("2026-10-06");
    expect(resolveDue("today", "Asia/Tokyo", NOW).dueDate).toBe("2026-10-07");
    expect(resolveDue("tomorrow", "Asia/Tokyo", NOW).dueDate).toBe("2026-10-08");
  });

  it("keeps a time of day and recurrence", () => {
    expect(resolveDue("next friday 3pm", "UTC", NOW)).toEqual({
      dueDate: "2026-10-16",
      dueTime: "15:00",
      recurrenceRule: null,
    });
    expect(resolveDue("every monday", "UTC", NOW)).toEqual({
      dueDate: "2026-10-12",
      dueTime: null,
      recurrenceRule: { type: "weekly", interval: 1, weekdays: [1] },
    });
  });

  it("explains what it accepts when it cannot parse", () => {
    expect(() => resolveDue("whenever", "UTC", NOW)).toThrow(ToolInputError);
    expect(() => resolveDue("whenever", "UTC", NOW)).toThrow(/next friday 3pm/);
  });
});

describe("helpers", () => {
  it("todayFor uses the user's timezone", () => {
    expect(todayFor("Asia/Tokyo", NOW)).toBe("2026-10-07");
    expect(todayFor("UTC", NOW)).toBe("2026-10-06");
  });

  it("assertUuid rejects things that are not ids", () => {
    expect(() => assertUuid("Buy milk")).toThrow(ToolInputError);
    expect(() => assertUuid("0b6f4c4e-6c1b-4d55-9a8e-0f7b2a7d1c11")).not.toThrow();
  });
});
