import { buildEvent, publishEvent } from '../syncService.js';
import type { SyncEventType } from '../syncService.js';

// Fire-and-forget: the row is already committed, so a failed broadcast must
// not fail the request.
function emit(input: Parameters<typeof buildEvent>[0]): void {
  publishEvent(buildEvent(input)).catch((err) => console.error('[sync] publish failed', err));
}

export function publishTaskEvent(
  eventType: SyncEventType,
  userId: string,
  task: { id: string; collectionId: string },
  payload: unknown = task,
): void {
  emit({ entityType: 'task', eventType, entityId: task.id, userId, collectionId: task.collectionId, payload });
}

export function publishTaskDeleted(userId: string, taskId: string, collectionId: string): void {
  emit({ entityType: 'task', eventType: 'deleted', entityId: taskId, userId, collectionId });
}
