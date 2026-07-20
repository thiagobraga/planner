import 'fake-indexeddb/auto';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../socket', () => ({
  getSyncStatus: () => 'connected',
}));

/**
 * Structural moves through the offline queue.
 *
 * A move is the mutation most exposed to being queued: it is the one gesture
 * that names other rows by id, so a move queued behind an offline *create*
 * refers to a task the server has never heard of. These cover that ordering and
 * the id rewriting that resolves it.
 */
describe('offline queue: structural moves', () => {
  beforeEach(async () => {
    vi.resetModules();
    const { getQueuedMutations, removeMutation } = await import('../offlineQueue');
    for (const m of await getQueuedMutations()) await removeMutation(m.id);
  });

  it('persists a queued move so it survives a reload', async () => {
    const { enqueueMutation } = await import('../offlineQueue');

    await enqueueMutation({
      method: 'PATCH',
      path: '/tasks/task-1/move',
      ownerUserId: 'user-1',
        body: JSON.stringify({
        parentTaskId: null,
        scope: { kind: 'collection', collectionId: 'c-1' },
        position: 2,
      }),
    });

    // Re-import to stand in for a reload: a fresh module instance reading the
    // same IndexedDB must still find the move waiting.
    vi.resetModules();
    const { getQueuedMutations } = await import('../offlineQueue');
    const queued = await getQueuedMutations();

    expect(queued).toHaveLength(1);
    expect(queued[0]!.path).toBe('/tasks/task-1/move');
    expect(JSON.parse(queued[0]!.body!).position).toBe(2);
  });

  it('replays a create before the move that depends on it', async () => {
    const { enqueueMutation, getQueuedMutations } = await import('../offlineQueue');

    await enqueueMutation({
      method: 'POST',
      path: '/tasks',
      ownerUserId: 'user-1',
        body: JSON.stringify({ title: 'Made offline' }),
      clientEntityId: 'temp-1',
    });
    await enqueueMutation({
      method: 'PATCH',
      path: '/tasks/temp-1/move',
      ownerUserId: 'user-1',
        body: JSON.stringify({ parentTaskId: null, position: 0 }),
    });

    // FIFO is what guarantees the task exists by the time the move replays.
    expect((await getQueuedMutations()).map((m) => m.path)).toEqual([
      '/tasks',
      '/tasks/temp-1/move',
    ]);
  });

  it('keeps a create ahead of its move even when both land in the same millisecond', async () => {
    const { enqueueMutation, getQueuedMutations } = await import('../offlineQueue');

    // Freeze the clock: without a tiebreaker these two share a createdAt and
    // fall back to random key order, replaying the move first.
    const frozen = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    try {
      await enqueueMutation({
        method: 'POST',
        path: '/tasks',
        ownerUserId: 'user-1',
        body: '{}',
        clientEntityId: 'temp-1',
      });
      await enqueueMutation({ method: 'PATCH', path: '/tasks/temp-1/move', ownerUserId: 'user-1',
        body: '{}' });
    } finally {
      frozen.mockRestore();
    }

    expect((await getQueuedMutations()).map((m) => m.path)).toEqual([
      '/tasks',
      '/tasks/temp-1/move',
    ]);
  });

  it('rewrites a queued move addressed to a task created offline', async () => {
    const { enqueueMutation, remapQueuedId, getQueuedMutations } = await import('../offlineQueue');

    await enqueueMutation({
      method: 'PATCH',
      path: '/tasks/temp-1/move',
      ownerUserId: 'user-1',
        body: JSON.stringify({ parentTaskId: null, position: 0 }),
    });

    await remapQueuedId('temp-1', 'server-99');

    const queued = await getQueuedMutations();
    expect(queued[0]!.path).toBe('/tasks/server-99/move');
  });

  it('rewrites a move whose new parent was itself created offline', async () => {
    const { enqueueMutation, remapQueuedId, getQueuedMutations } = await import('../offlineQueue');

    await enqueueMutation({
      method: 'PATCH',
      path: '/tasks/task-1/move',
      ownerUserId: 'user-1',
        body: JSON.stringify({ parentTaskId: 'temp-parent', position: 0 }),
    });

    await remapQueuedId('temp-parent', 'server-parent');

    const queued = await getQueuedMutations();
    expect(JSON.parse(queued[0]!.body!).parentTaskId).toBe('server-parent');
    // The move's own subject was already real and must not be touched.
    expect(queued[0]!.path).toBe('/tasks/task-1/move');
  });

  it('keeps a habit move queued alongside task moves in the order made', async () => {
    const { enqueueMutation, getQueuedMutations } = await import('../offlineQueue');

    await enqueueMutation({ method: 'PATCH', path: '/tasks/t-1/move', ownerUserId: 'user-1',
        body: '{}' });
    await enqueueMutation({ method: 'PATCH', path: '/habits/h-1/move', ownerUserId: 'user-1',
        body: '{}' });
    await enqueueMutation({ method: 'PATCH', path: '/habit-groups/g-1/move', ownerUserId: 'user-1',
        body: '{}' });

    expect((await getQueuedMutations()).map((m) => m.path)).toEqual([
      '/tasks/t-1/move',
      '/habits/h-1/move',
      '/habit-groups/g-1/move',
    ]);
  });
});
