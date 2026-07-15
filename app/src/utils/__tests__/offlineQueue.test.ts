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

      const idFirst = await enqueueMutation({ method: 'POST', path: '/tasks', body: '{}' });
      now = 2000;
      const idSecond = await enqueueMutation({ method: 'PATCH', path: '/tasks/1', body: '{}' });
      now = 3000;
      const idThird = await enqueueMutation({ method: 'DELETE', path: '/tasks/2', body: '' });

      Date.now = originalNow;

      const all = await getQueuedMutations();
      expect(all.map((m) => m.id)).toEqual([idFirst, idSecond, idThird]);
    });
  });

  describe('removeMutation', () => {
    it('deletes a record', async () => {
      const { enqueueMutation, getQueuedMutations, removeMutation } = await import('../offlineQueue');

      const id = await enqueueMutation({ method: 'DELETE', path: '/tasks/1', body: '' });
      expect(await getQueuedMutations()).toHaveLength(1);

      await removeMutation(id);

      expect(await getQueuedMutations()).toHaveLength(0);
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
