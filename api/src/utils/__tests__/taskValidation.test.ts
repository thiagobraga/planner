import { describe, it, expect } from "vitest";
import { validateCreateTask, validateUpdateTask, validateReorderPosition } from "../taskValidation.js";
import { AppError } from "../AppError.js";

function expectValidationError(fn: () => void, field: string, msg: string): void {
  let error: AppError | undefined;
  try { fn(); } catch (e) { error = e as AppError; }
  expect(error).toBeDefined();
  expect(error!.code).toBe("VALIDATION_ERROR");
  expect(error!.details).toBeDefined();
  const detail = (error!.details as Array<{ field: string; message: string }>).find(
    (d) => d.field === field,
  );
  expect(detail).toBeDefined();
  expect(detail!.message).toContain(msg);
}

describe("validateCreateTask", () => {
  it("passes for valid task input", () => {
    expect(() => validateCreateTask({ title: "Valid task" })).not.toThrow();
  });

  it("passes with optional fields", () => {
    expect(() =>
      validateCreateTask({ title: "Task", priority: 2, type: "note", dueDate: "2026-07-21" }),
    ).not.toThrow();
  });

  it("passes with type event", () => {
    expect(() => validateCreateTask({ title: "Team standup", type: "event" })).not.toThrow();
  });

  it("rejects missing title", () => {
    expectValidationError(() => validateCreateTask({}), "title", "required");
  });

  it("rejects non-string title", () => {
    expectValidationError(() => validateCreateTask({ title: 123 } as never), "title", "required");
  });

  it("rejects empty title", () => {
    expectValidationError(() => validateCreateTask({ title: "   " }), "title", "empty");
  });

  it("rejects title over 500 chars", () => {
    expectValidationError(() => validateCreateTask({ title: "x".repeat(501) }), "title", "500");
  });

  it("rejects priority below 1", () => {
    expectValidationError(() => validateCreateTask({ title: "t", priority: 0 }), "priority", "1 and 4");
  });

  it("rejects priority above 4", () => {
    expectValidationError(() => validateCreateTask({ title: "t", priority: 5 }), "priority", "1 and 4");
  });

  it("rejects non-integer priority", () => {
    expectValidationError(() => validateCreateTask({ title: "t", priority: 1.5 }), "priority", "1 and 4");
  });

  it("rejects invalid type", () => {
    expectValidationError(() => validateCreateTask({ title: "t", type: "bug" }), "type", "task");
  });

  it("rejects malformed dueDate", () => {
    expectValidationError(() => validateCreateTask({ title: "t", dueDate: "not-a-date" }), "dueDate", "ISO date");
  });
});

describe("validateUpdateTask", () => {
  it("passes for empty body (no fields to update)", () => {
    expect(() => validateUpdateTask({})).not.toThrow();
  });

  it("passes for valid partial update", () => {
    expect(() => validateUpdateTask({ title: "Updated", priority: 1 })).not.toThrow();
  });

  it("rejects empty title on update", () => {
    expectValidationError(() => validateUpdateTask({ title: "" }), "title", "empty");
  });

  it("rejects title over 500 chars on update", () => {
    expectValidationError(() => validateUpdateTask({ title: "x".repeat(501) }), "title", "500");
  });

  it("rejects invalid priority on update", () => {
    expectValidationError(() => validateUpdateTask({ priority: 99 }), "priority", "1 and 4");
  });

  it("rejects non-string title on update", () => {
    expectValidationError(() => validateUpdateTask({ title: 123 } as never), "title", "string");
  });

  it("rejects invalid type on update", () => {
    expectValidationError(() => validateUpdateTask({ type: "bug" }), "type", "task");
  });

  it("passes with type event on update", () => {
    expect(() => validateUpdateTask({ type: "event" })).not.toThrow();
  });

  it("rejects malformed dueDate on update", () => {
    expectValidationError(() => validateUpdateTask({ dueDate: "not-a-date" }), "dueDate", "ISO date");
  });
});

describe("time fields", () => {
  it("accepts HH:MM times, ISO deadline date and positive duration", () => {
    const input = {
      dueDate: "2026-08-14",
      dueTime: "14:30",
      deadlineDate: "2026-08-20",
      deadlineTime: "09:00",
      durationMinutes: 90,
    };
    expect(() => validateCreateTask({ title: "t", ...input })).not.toThrow();
    expect(() => validateUpdateTask(input)).not.toThrow();
  });

  it("accepts null to clear each field", () => {
    expect(() =>
      validateUpdateTask({ dueTime: null, deadlineDate: null, deadlineTime: null, durationMinutes: null }),
    ).not.toThrow();
  });

  it("rejects malformed dueTime", () => {
    expectValidationError(() => validateUpdateTask({ dueTime: "25:00" }), "dueTime", "HH:MM");
    expectValidationError(() => validateCreateTask({ title: "t", dueTime: "2pm" }), "dueTime", "HH:MM");
  });

  it("rejects malformed deadlineTime", () => {
    expectValidationError(() => validateUpdateTask({ deadlineTime: "9:5" }), "deadlineTime", "HH:MM");
  });

  it("rejects malformed deadlineDate", () => {
    expectValidationError(() => validateUpdateTask({ deadlineDate: "tomorrow" }), "deadlineDate", "ISO date");
  });

  it("rejects non-positive, fractional or over-a-day duration", () => {
    for (const durationMinutes of [0, -5, 1.5, 1441, "30"]) {
      expectValidationError(() => validateUpdateTask({ durationMinutes }), "durationMinutes", "between 1 and 1440");
    }
  });
});

describe("validateReorderPosition", () => {
  it("passes for valid position", () => {
    expect(() => validateReorderPosition(0)).not.toThrow();
    expect(() => validateReorderPosition(5)).not.toThrow();
  });

  it("rejects negative position", () => {
    expectValidationError(() => validateReorderPosition(-1), "position", "non-negative");
  });

  it("rejects non-integer position", () => {
    expectValidationError(() => validateReorderPosition(1.5), "position", "non-negative");
  });

  it("rejects non-number position", () => {
    expectValidationError(() => validateReorderPosition("abc"), "position", "non-negative");
    expectValidationError(() => validateReorderPosition(null), "position", "non-negative");
    expectValidationError(() => validateReorderPosition(undefined), "position", "non-negative");
  });
});
