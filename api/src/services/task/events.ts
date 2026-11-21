import { buildEvent, publishEvent } from '../syncService.js';
import type { SyncEventType } from '../syncService.js';
import type { SyncEventInput } from '../../types/mutation.js';

// Fire-and-forget: the row is already committed, so a failed broadcast must
// not fail the request.
function emit(input: SyncEventInput): void {
  publishEvent(buildEvent(input)).catch((err) => console.error('[sync] publish failed', err));
}

export function taskEvent(
  eventType: SyncEventType,
  userId: string,
  task: { id: string; collectionId: string },
  payload: unknown = task,
): SyncEventInput {
  return { entityType: 'task', eventType, entityId: task.id, userId, collectionId: task.collectionId, payload };
}

export function publishTaskEvent(...args: Parameters<typeof taskEvent>): void {
  emit(taskEvent(...args));
}

export function taskDeletedEvent(userId: string, taskId: string, collectionId: string): SyncEventInput {
  return { entityType: 'task', eventType: 'deleted', entityId: taskId, userId, collectionId };
}

export function publishSourceCollectionChange(userId: string, taskId: string, collectionId: string): void {
  emit({
    entityType: 'task',
    eventType: 'updated',
    entityId: taskId,
    userId,
    collectionId,
    audience: 'current-collection-members',
    actor: undefined,
  });
}
