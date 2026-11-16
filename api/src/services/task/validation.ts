import { AppError } from '../../utils/AppError.js';
import type { MoveTaskInput } from '../../types/task.js';

export const MAX_DEPTH = 5;
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validationError(field: string, message: string): AppError {
  return new AppError({
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    statusCode: 400,
    details: [{ field, message }],
  });
}

export function validateMoveInput(input: MoveTaskInput): void {
  if (!input || typeof input !== 'object') {
    throw validationError('body', 'Move input is required');
  }
  if (input.parentTaskId !== null && typeof input.parentTaskId !== 'string') {
    throw validationError('parentTaskId', 'Parent task id must be a string or null');
  }
  if (input.collectionId !== undefined && typeof input.collectionId !== 'string') {
    throw validationError('collectionId', 'Collection id must be a string');
  }
  if (
    input.sectionId !== undefined &&
    input.sectionId !== null &&
    typeof input.sectionId !== 'string'
  ) {
    throw validationError('sectionId', 'Section id must be a string or null');
  }
  if (
    input.dueDate !== undefined &&
    input.dueDate !== null &&
    !ISO_DATE.test(input.dueDate)
  ) {
    throw validationError('dueDate', 'Due date must be an ISO date (YYYY-MM-DD)');
  }
  if (input.statusId !== undefined && input.statusId !== null && typeof input.statusId !== 'string') {
    throw validationError('statusId', 'Status id must be a string or null');
  }
  if (
    input.priority !== undefined &&
    (!Number.isInteger(input.priority) || input.priority < 1 || input.priority > 4)
  ) {
    throw validationError('priority', 'Priority must be an integer between 1 and 4');
  }
  if (!Number.isInteger(input.position) || input.position < 0) {
    throw validationError('position', 'Position must be a non-negative integer');
  }
  if (input.afterTaskId !== undefined && input.afterTaskId !== null && typeof input.afterTaskId !== 'string') {
    throw validationError('afterTaskId', 'After task id must be a string or null');
  }

  const scope = input.scope;
  if (!scope || typeof scope !== 'object') {
    throw validationError('scope', 'Ordering scope is required');
  }
  if (scope.kind === 'collection') {
    if (typeof scope.collectionId !== 'string') {
      throw validationError('scope.collectionId', 'Collection scope requires a collection id');
    }
  } else if (scope.kind === 'day') {
    if (!ISO_DATE.test(scope.dueDate ?? '')) {
      throw validationError('scope.dueDate', 'Day scope requires an ISO date (YYYY-MM-DD)');
    }
  } else if (scope.kind === 'section') {
    if (typeof scope.sectionId !== 'string') {
      throw validationError('scope.sectionId', 'Section scope requires a section id');
    }
  } else if (scope.kind === 'status') {
    if (typeof scope.collectionId !== 'string') {
      throw validationError('scope.collectionId', 'Status scope requires a collection id');
    }
    if (scope.statusId !== null && typeof scope.statusId !== 'string') {
      throw validationError('scope.statusId', 'Status scope requires a status id or null');
    }
  } else if (scope.kind === 'priority') {
    if (typeof scope.collectionId !== 'string') {
      throw validationError('scope.collectionId', 'Priority scope requires a collection id');
    }
    if (!Number.isInteger(scope.priority) || scope.priority < 1 || scope.priority > 4) {
      throw validationError('scope.priority', 'Priority scope requires an integer between 1 and 4');
    }
  } else {
    throw validationError(
      'scope.kind',
      "Ordering scope must be 'collection', 'day', 'section', 'status' or 'priority'",
    );
  }
}

// A time of day only means something on a date: reject a time whose date is (or would become) empty.
export function validateTimeNeedsDate(
  fields: { dueTime?: string | null; deadlineTime?: string | null },
  dueDate: unknown,
  deadlineDate: unknown,
): void {
  const details: Array<{ field: string; message: string }> = [];
  if (fields.dueTime && !dueDate) {
    details.push({ field: 'dueTime', message: 'A due time requires a due date' });
  }
  if (fields.deadlineTime && !deadlineDate) {
    details.push({ field: 'deadlineTime', message: 'A deadline time requires a deadline date' });
  }
  if (details.length > 0) {
    throw new AppError({ code: 'VALIDATION_ERROR', message: 'Validation failed', statusCode: 400, details });
  }
}

export function validateTaskScalarFields(input: {
  title?: string;
  priority?: number;
  type?: string;
  requireTitle?: boolean;
}): void {
  if (input.requireTitle || input.title !== undefined) {
    if (!input.title || input.title.length === 0 || input.title.length > 500) {
      throw validationError('title', 'Title must be between 1 and 500 characters');
    }
  }
  if (input.priority !== undefined) {
    if (!Number.isInteger(input.priority) || input.priority < 1 || input.priority > 4) {
      throw validationError('priority', 'Priority must be an integer between 1 and 4');
    }
  }
  if (input.type !== undefined && input.type !== 'task' && input.type !== 'note' && input.type !== 'event') {
    throw validationError('type', "type must be 'task', 'note', or 'event'");
  }
}
