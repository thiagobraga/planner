import { AppError } from "./AppError.js";

export interface TaskInput {
  title?: string;
  priority?: number;
  type?: string;
  description?: string | null;
  dueDate?: string | null;
  position?: number;
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

  if (input.type !== undefined && input.type !== "task" && input.type !== "note") {
    errors.push({ field: "type", message: "Type must be 'task' or 'note'" });
  }

  if (input.dueDate !== undefined && input.dueDate !== null) {
    if (typeof input.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
      errors.push({ field: "dueDate", message: "Due date must be an ISO date (YYYY-MM-DD)" });
    }
  }

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

  if (input.type !== undefined && input.type !== "task" && input.type !== "note") {
    errors.push({ field: "type", message: "Type must be 'task' or 'note'" });
  }

  if (input.dueDate !== undefined && input.dueDate !== null) {
    if (typeof input.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
      errors.push({ field: "dueDate", message: "Due date must be an ISO date (YYYY-MM-DD)" });
    }
  }

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
