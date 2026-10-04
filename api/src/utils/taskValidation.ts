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
  position?: number;
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
