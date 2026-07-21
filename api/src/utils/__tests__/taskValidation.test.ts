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
