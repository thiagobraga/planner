import type { QueryClient } from '@tanstack/react-query';
import type { CommentSyncPayload } from '../contracts/comment';
import type { SyncEvent } from '../contracts/sync';

export function commentsQueryKey(taskId: string) {
  return ['comments', taskId] as const;
}

/** A comment event names its task; refetch that thread, or all threads if it does not. */
export function invalidateCommentQueries(qc: QueryClient, event: SyncEvent): Promise<void> {
  const taskId = (event.payload as Partial<CommentSyncPayload> | undefined)?.taskId;
  return qc.invalidateQueries({ queryKey: typeof taskId === 'string' ? commentsQueryKey(taskId) : ['comments'] });
}
