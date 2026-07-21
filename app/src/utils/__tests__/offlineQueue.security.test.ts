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

describe('offline queue security isolation', () => {
  beforeEach(async () => {
    mockConnected = true;
    setNavigatorOnLine(true);
    vi.resetModules();
    const { getQueuedMutations, removeMutation } = await import('../offlineQueue');
    for (const m of await getQueuedMutations()) await removeMutation(m.id);
  });

  it('rejects enqueueMutation without an ownerUserId', async () => {
    const { enqueueMutation } = await import('../offlineQueue');

    await expect(
      enqueueMutation({
        method: 'POST',
        path: '/tasks',
        body: JSON.stringify({ title: 'test' }),
        ownerUserId: '',
      }),
    ).rejects.toThrow('Cannot enqueue mutation without an authenticated owner');
  });

  it('getQueuedMutationsForUser returns only records owned by that user', async () => {
    const { enqueueMutation, getQueuedMutationsForUser, getQueuedMutations } = await import('../offlineQueue');

    await enqueueMutation({ method: 'POST', path: '/tasks', ownerUserId: 'user-a', body: JSON.stringify({ title: 'A' }) });
    await enqueueMutation({ method: 'POST', path: '/tasks', ownerUserId: 'user-a', body: JSON.stringify({ title: 'A2' }) });
    await enqueueMutation({ method: 'POST', path: '/tasks', ownerUserId: 'user-b', body: JSON.stringify({ title: 'B' }) });
    await enqueueMutation({ method: 'POST', path: '/tasks', ownerUserId: 'user-c', body: JSON.stringify({ title: 'C' }) });

    const userA = await getQueuedMutationsForUser('user-a');
    expect(userA).toHaveLength(2);
    expect(userA.every((m) => m.ownerUserId === 'user-a')).toBe(true);

    const userB = await getQueuedMutationsForUser('user-b');
    expect(userB).toHaveLength(1);
    expect(userB[0].ownerUserId).toBe('user-b');

    const userC = await getQueuedMutationsForUser('user-c');
    expect(userC).toHaveLength(1);
    expect(userC[0].ownerUserId).toBe('user-c');

    const all = await getQueuedMutations();
    expect(all).toHaveLength(4);
  });

  it('clearUserMutations removes only records for the given user', async () => {
    const { enqueueMutation, clearUserMutations, getQueuedMutations } = await import('../offlineQueue');

    await enqueueMutation({ method: 'POST', path: '/tasks', ownerUserId: 'user-a', body: '{}' });
    await enqueueMutation({ method: 'POST', path: '/tasks', ownerUserId: 'user-b', body: '{}' });

    await clearUserMutations('user-a');

    const remaining = await getQueuedMutations();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].ownerUserId).toBe('user-b');
  });

  it('user B cannot see user A records', async () => {
    const { enqueueMutation, getQueuedMutationsForUser } = await import('../offlineQueue');

    await enqueueMutation({ method: 'POST', path: '/tasks', ownerUserId: 'alice', body: '{"title":"alice-task"}' });

    const aliceRecords = await getQueuedMutationsForUser('alice');
    expect(aliceRecords).toHaveLength(1);

    const bobRecords = await getQueuedMutationsForUser('bob');
    expect(bobRecords).toHaveLength(0);
  });

  it('clearUserMutations clears the user queue (as during logout)', async () => {
    const { enqueueMutation, clearUserMutations, getQueuedMutations } = await import('../offlineQueue');

    await enqueueMutation({ method: 'POST', path: '/tasks', ownerUserId: 'user-z', body: '{}' });

    expect((await getQueuedMutations()).every((m) => m.ownerUserId === 'user-z')).toBe(true);

    await clearUserMutations('user-z');

    expect(await getQueuedMutations()).toHaveLength(0);
  });

  it('remapQueuedId handles records from multiple owners correctly', async () => {
    const { enqueueMutation, remapQueuedId, getQueuedMutationsForUser } = await import('../offlineQueue');

    await enqueueMutation({ method: 'PATCH', path: '/tasks/client-id/move', ownerUserId: 'user-a', body: '{}' });
    await enqueueMutation({ method: 'PATCH', path: '/tasks/client-id/move', ownerUserId: 'user-b', body: '{}' });

    await remapQueuedId('client-id', 'server-42');

    const userAPaths = (await getQueuedMutationsForUser('user-a')).map((m) => m.path);
    const userBPaths = (await getQueuedMutationsForUser('user-b')).map((m) => m.path);
    expect(userAPaths).toContain('/tasks/server-42/move');
    expect(userBPaths).toContain('/tasks/server-42/move');
  });

  it('clearAllMutations removes every record regardless of owner', async () => {
    const { enqueueMutation, clearAllMutations, getQueuedMutations } = await import('../offlineQueue');

    await enqueueMutation({ method: 'POST', path: '/tasks', ownerUserId: 'user-x', body: '{}' });
    await enqueueMutation({ method: 'POST', path: '/tasks', ownerUserId: 'user-y', body: '{}' });

    await clearAllMutations();

    expect(await getQueuedMutations()).toHaveLength(0);
  });
});

describe('offline queue legacy migration', () => {
  beforeEach(async () => {
    const { getQueuedMutations, removeMutation } = await import('../offlineQueue');
    for (const m of await getQueuedMutations()) await removeMutation(m.id);
  });

  it('all fresh records are created with ownerUserId', async () => {
    const { enqueueMutation, getQueuedMutations } = await import('../offlineQueue');

    await enqueueMutation({ method: 'POST', path: '/tasks', ownerUserId: 'user-1', body: '{}' });
    await enqueueMutation({ method: 'POST', path: '/tasks', ownerUserId: 'user-2', body: '{}' });

    const all = await getQueuedMutations();
    expect(all).toHaveLength(2);
    expect(all.every((m) => m.ownerUserId === 'user-1' || m.ownerUserId === 'user-2')).toBe(true);
    expect(all.some((m) => m.ownerUserId === 'user-1')).toBe(true);
    expect(all.some((m) => m.ownerUserId === 'user-2')).toBe(true);
  });

  it('Database v2 store has ownerUserId index', async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('planner-offline-queue', 2);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const storeNames = db.objectStoreNames;
    expect(storeNames.contains('mutations')).toBe(true);
    const tx = db.transaction('mutations', 'readonly');
    const store = tx.objectStore('mutations');
    expect(store.indexNames.contains('ownerUserId')).toBe(true);
    db.close();
  });
});
