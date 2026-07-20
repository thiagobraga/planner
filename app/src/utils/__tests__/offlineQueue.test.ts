import 'fake-indexeddb/auto';
import { vi, describe, it, expect, beforeEach } from 'vitest';

let mockConnected: boolean;

vi.mock('../socket', () => ({
  getSyncStatus: () => (mockConnected ? 'connected' : 'disconnected'),
}));

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
}

describe('offlineQueue', () => {
  beforeEach(async () => {
    mockConnected = true;
    setNavigatorOnLine(true);
    vi.resetModules();
    // Wipe fake-indexeddb state between tests so records don't leak across
    // test cases (each test re-imports the module against a fresh DB name
    // is overkill; instead just drain any existing store).
    const { getQueuedMutations, removeMutation } = await import('../offlineQueue');
    const existing = await getQueuedMutations();
    for (const m of existing) {
      await removeMutation(m.id);
    }
  });

  describe('enqueueMutation', () => {
    it('creates a record with the correct shape and returns an id', async () => {
      const { enqueueMutation, getQueuedMutations } = await import('../offlineQueue');

      const id = await enqueueMutation({
        method: 'POST',
        path: '/tasks',
        ownerUserId: 'user-1',
        body: JSON.stringify({ title: 'buy milk' }),
      });

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);

      const all = await getQueuedMutations();
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({
        id,
        method: 'POST',
        path: '/tasks',
        ownerUserId: 'user-1',
        body: JSON.stringify({ title: 'buy milk' }),
      });
      expect(typeof all[0].createdAt).toBe('number');
    });
  });

  describe('getQueuedMutations', () => {
    it('returns entries sorted by createdAt ascending (FIFO)', async () => {
      const { enqueueMutation, getQueuedMutations } = await import('../offlineQueue');

      const originalNow = Date.now;
      let now = 1000;
      vi.spyOn(Date, 'now').mockImplementation(() => now);

      const idFirst = await enqueueMutation({ method: 'POST', path: '/tasks', ownerUserId: 'user-1',
        body: '{}' });
      now = 2000;
      const idSecond = await enqueueMutation({ method: 'PATCH', path: '/tasks/1', ownerUserId: 'user-1',
        body: '{}' });
      now = 3000;
      const idThird = await enqueueMutation({ method: 'DELETE', path: '/tasks/2', ownerUserId: 'user-1',
        body: '' });

      Date.now = originalNow;

      const all = await getQueuedMutations();
      expect(all.map((m) => m.id)).toEqual([idFirst, idSecond, idThird]);
    });
  });

  describe('removeMutation', () => {
    it('deletes a record', async () => {
      const { enqueueMutation, getQueuedMutations, removeMutation } = await import('../offlineQueue');

      const id = await enqueueMutation({ method: 'DELETE', path: '/tasks/1', ownerUserId: 'user-1',
        body: '' });
      expect(await getQueuedMutations()).toHaveLength(1);

      await removeMutation(id);

      expect(await getQueuedMutations()).toHaveLength(0);
    });
  });

  describe('remapQueuedId', () => {
    it('rewrites the old client id as a path segment in not-yet-replayed mutations', async () => {
      const { enqueueMutation, remapQueuedId, getQueuedMutations } = await import('../offlineQueue');

      const clientId = 'client-minted-uuid';
      await enqueueMutation({ method: 'POST', path: `/tasks/${clientId}/complete`, ownerUserId: 'user-1',
        body: '' });
      await enqueueMutation({ method: 'DELETE', path: `/tasks/${clientId}`, ownerUserId: 'user-1',
        body: '' });

      await remapQueuedId(clientId, 'server-id-1');

      const all = await getQueuedMutations();
      const paths = all.map((m) => m.path);
      expect(paths).toContain('/tasks/server-id-1/complete');
      expect(paths).toContain('/tasks/server-id-1');
    });

    it('rewrites parentTaskId in a JSON body that references the old client id', async () => {
      const { enqueueMutation, remapQueuedId, getQueuedMutations } = await import('../offlineQueue');

      const clientId = 'client-parent-uuid';
      await enqueueMutation({
        method: 'POST',
        path: '/tasks',
        ownerUserId: 'user-1',
        body: JSON.stringify({ title: 'subtask', parentTaskId: clientId }),
      });

      await remapQueuedId(clientId, 'server-parent-id');

      const all = await getQueuedMutations();
      expect(JSON.parse(all[0].body)).toMatchObject({ title: 'subtask', parentTaskId: 'server-parent-id' });
    });

    it('preserves createdAt (FIFO order) when rewriting entries', async () => {
      const { enqueueMutation, remapQueuedId, getQueuedMutations } = await import('../offlineQueue');

      const clientId = 'client-id-order';
      const originalNow = Date.now;
      let now = 5000;
      vi.spyOn(Date, 'now').mockImplementation(() => now);

      const firstId = await enqueueMutation({ method: 'POST', path: '/tasks', ownerUserId: 'user-1',
        body: '{}' });
      now = 6000;
      await enqueueMutation({ method: 'POST', path: `/tasks/${clientId}/complete`, ownerUserId: 'user-1',
        body: '' });

      Date.now = originalNow;

      await remapQueuedId(clientId, 'server-id-2');

      const all = await getQueuedMutations();
      expect(all.map((m) => m.id)).toEqual([firstId, all[1].id]);
      expect(all[0].createdAt).toBe(5000);
      expect(all[1].createdAt).toBe(6000);
    });

    it('leaves mutations unrelated to the old id untouched', async () => {
      const { enqueueMutation, remapQueuedId, getQueuedMutations } = await import('../offlineQueue');

      await enqueueMutation({ method: 'PATCH', path: '/tasks/unrelated-id', ownerUserId: 'user-1',
        body: JSON.stringify({ title: 'x' }) });

      await remapQueuedId('some-other-client-id', 'server-id-3');

      const all = await getQueuedMutations();
      expect(all[0].path).toBe('/tasks/unrelated-id');
      expect(JSON.parse(all[0].body)).toEqual({ title: 'x' });
    });
  });

  describe('enqueueMutation with clientEntityId', () => {
    it('persists clientEntityId when provided for a create-type mutation', async () => {
      const { enqueueMutation, getQueuedMutations } = await import('../offlineQueue');

      await enqueueMutation({ method: 'POST', path: '/tasks', ownerUserId: 'user-1',
        body: '{}', clientEntityId: 'client-abc' });

      const all = await getQueuedMutations();
      expect(all[0].clientEntityId).toBe('client-abc');
    });

    it('omits clientEntityId when not provided (non-create mutations)', async () => {
      const { enqueueMutation, getQueuedMutations } = await import('../offlineQueue');

      await enqueueMutation({ method: 'DELETE', path: '/tasks/1', ownerUserId: 'user-1',
        body: '' });

      const all = await getQueuedMutations();
      expect(all[0].clientEntityId).toBeUndefined();
    });
  });

  describe('isOnline', () => {
    it('is true when navigator.onLine is true and the socket is connected', async () => {
      const { isOnline } = await import('../offlineQueue');
      mockConnected = true;
      setNavigatorOnLine(true);
      expect(isOnline()).toBe(true);
    });

    it('is false when navigator.onLine is false, even if the socket is connected', async () => {
      const { isOnline } = await import('../offlineQueue');
      mockConnected = true;
      setNavigatorOnLine(false);
      expect(isOnline()).toBe(false);
    });

    it('is false when the socket is disconnected, even if navigator.onLine is true', async () => {
      const { isOnline } = await import('../offlineQueue');
      mockConnected = false;
      setNavigatorOnLine(true);
      expect(isOnline()).toBe(false);
    });
  });
});
