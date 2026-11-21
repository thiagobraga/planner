import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { SyncEvent } from '../../contracts/sync';
import { commentsQueryKey, invalidateCommentQueries } from '../commentSync';

function commentEvent(payload: unknown): SyncEvent {
  return {
    id: 'e1',
    entityType: 'comment',
    eventType: 'created',
    entityId: 'c1',
    userId: 'u1',
    collectionId: 'col1',
    payload,
    emittedAt: '2026-11-19T00:00:00.000Z',
  };
}

function seeded() {
  const qc = new QueryClient();
  qc.setQueryData(commentsQueryKey('t1'), []);
  qc.setQueryData(commentsQueryKey('t2'), []);
  return qc;
}

const invalidated = (qc: QueryClient, taskId: string) =>
  qc.getQueryState(commentsQueryKey(taskId))?.isInvalidated;

describe('invalidateCommentQueries', () => {
  it("refreshes only the commented task's thread", async () => {
    const qc = seeded();
    await invalidateCommentQueries(qc, commentEvent({ taskId: 't1' }));
    expect(invalidated(qc, 't1')).toBe(true);
    expect(invalidated(qc, 't2')).toBe(false);
  });

  it('refreshes every thread when the event names no task', async () => {
    const qc = seeded();
    await invalidateCommentQueries(qc, commentEvent(undefined));
    expect(invalidated(qc, 't1')).toBe(true);
    expect(invalidated(qc, 't2')).toBe(true);
  });
});
