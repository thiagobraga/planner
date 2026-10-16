import { AppError } from "./AppError.js";

export interface TaskInput {
  title?: string;
  priority?: number;
  type?: string;
  description?: string | null;
  dueDate?: string | null;
  dueTime?: unknown;
  deadlineDate?: unknown;
  deadlineTime?: unknown;
  durationMinutes?: unknown;
  dueTimezone?: unknown;
  deadlineTimezone?: unknown;
  recurrenceRule?: unknown;
  position?: number;
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RECURRENCE_TYPES = ["daily", "weekly", "monthly", "yearly"];

function isIntIn(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function recurrenceRuleProblem(rule: unknown): string | null {
  if (typeof rule !== "object" || rule === null || Array.isArray(rule)) return "Recurrence rule must be an object";
  const r = rule as Record<string, unknown>;
  if (typeof r.type !== "string" || !RECURRENCE_TYPES.includes(r.type)) {
    return "Recurrence type must be daily, weekly, monthly or yearly";
  }
  if (!isIntIn(r.interval, 1, 999)) return "Recurrence interval must be an integer between 1 and 999";
  if (r.weekdays !== undefined) {
    const days = r.weekdays;
    if (!Array.isArray(days) || !days.every((d) => isIntIn(d, 0, 6)) || new Set(days).size !== days.length) {
      return "Recurrence weekdays must be unique integers from 0 (Sunday) to 6";
    }
  }
  if (r.dayOfMonth !== undefined && !isIntIn(r.dayOfMonth, 1, 31)) return "Recurrence dayOfMonth must be 1-31";
  if (r.month !== undefined && !isIntIn(r.month, 1, 12)) return "Recurrence month must be 1-12";
  if (r.fromCompletion !== undefined && typeof r.fromCompletion !== "boolean") {
    return "Recurrence fromCompletion must be a boolean";
  }
  if (r.until !== undefined && (typeof r.until !== "string" || !ISO_DATE.test(r.until))) {
    return "Recurrence until must be an ISO date (YYYY-MM-DD)";
  }
  return null;
}

function validateTimeFields(input: TaskInput, errors: Array<{ field: string; message: string }>): void {
  for (const field of ["dueTime", "deadlineTime"] as const) {
    const value = input[field];
    if (value !== undefined && value !== null && (typeof value !== "string" || !CLOCK.test(value))) {
      errors.push({ field, message: "Time must be HH:MM (24h)" });
    }
  }

  for (const field of ["dueTimezone", "deadlineTimezone"] as const) {
    const value = input[field];
    if (value !== undefined && value !== null && (typeof value !== "string" || value.length > 100)) {
      errors.push({ field, message: "Time zone must be a string of 100 characters or fewer" });
    }
  }

  const { deadlineDate, durationMinutes } = input;
  if (deadlineDate !== undefined && deadlineDate !== null && (typeof deadlineDate !== "string" || !ISO_DATE.test(deadlineDate))) {
    errors.push({ field: "deadlineDate", message: "Deadline date must be an ISO date (YYYY-MM-DD)" });
  }

  if (
    durationMinutes !== undefined &&
    durationMinutes !== null &&
    (typeof durationMinutes !== "number" || !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440)
  ) {
    errors.push({ field: "durationMinutes", message: "Duration must be an integer between 1 and 1440 minutes" });
  }

  if (input.recurrenceRule !== undefined && input.recurrenceRule !== null) {
    const problem = recurrenceRuleProblem(input.recurrenceRule);
    if (problem) errors.push({ field: "recurrenceRule", message: problem });
  }
}

export function validateCreateTask(input: TaskInput): void {
  const errors: Array<{ field: string; message: string }> = [];

  if (!input.title || typeof input.title !== "string") {
    errors.push({ field: "title", message: "Title is required and must be a string" });
  } else {
    const trimmed = input.title.trim();
    if (trimmed.length === 0) {
      errors.push({ field: "title", message: "Title must not be empty" });
    } else if (trimmed.length > 500) {
      errors.push({ field: "title", message: "Title must be 500 characters or fewer" });
    }
  }

  if (input.priority !== undefined) {
    if (!Number.isInteger(input.priority) || input.priority < 1 || input.priority > 4) {
      errors.push({ field: "priority", message: "Priority must be an integer between 1 and 4" });
    }
  }

  if (input.type !== undefined && input.type !== "task" && input.type !== "note" && input.type !== "event") {
    errors.push({ field: "type", message: "Type must be 'task', 'note', or 'event'" });
  }

  if (input.dueDate !== undefined && input.dueDate !== null) {
    if (typeof input.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
      errors.push({ field: "dueDate", message: "Due date must be an ISO date (YYYY-MM-DD)" });
    }
  }

  validateTimeFields(input, errors);

  if (errors.length > 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: errors,
    });
  }
}

export function validateUpdateTask(input: TaskInput): void {
  const errors: Array<{ field: string; message: string }> = [];

  if (input.title !== undefined) {
    if (typeof input.title !== "string") {
      errors.push({ field: "title", message: "Title must be a string" });
    } else {
      const trimmed = input.title.trim();
      if (trimmed.length === 0) {
        errors.push({ field: "title", message: "Title must not be empty" });
      } else if (trimmed.length > 500) {
        errors.push({ field: "title", message: "Title must be 500 characters or fewer" });
      }
    }
  }

  if (input.priority !== undefined) {
    if (!Number.isInteger(input.priority) || input.priority < 1 || input.priority > 4) {
      errors.push({ field: "priority", message: "Priority must be an integer between 1 and 4" });
    }
  }

  if (input.type !== undefined && input.type !== "task" && input.type !== "note" && input.type !== "event") {
    errors.push({ field: "type", message: "Type must be 'task', 'note', or 'event'" });
  }

  if (input.dueDate !== undefined && input.dueDate !== null) {
    if (typeof input.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
      errors.push({ field: "dueDate", message: "Due date must be an ISO date (YYYY-MM-DD)" });
    }
  }

  validateTimeFields(input, errors);

  if (errors.length > 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: errors,
    });
  }
}

export function validateReorderPosition(position: unknown): void {
  if (typeof position !== "number" || !Number.isInteger(position) || position < 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: [{ field: "position", message: "Position must be a non-negative integer" }],
    });
  }
}
