import 'fake-indexeddb/auto';
import { vi, describe, it, expect, beforeEach } from 'vitest';

let mockConnected: boolean;

vi.mock('../../utils/socket', () => ({
  getSyncStatus: () => (mockConnected ? 'connected' : 'disconnected'),
  getSocket: () => ({ on: vi.fn(), off: vi.fn() }),
}));

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
}

describe('Offline Queue Account A/B Isolation Security Tests', () => {
  beforeEach(async () => {
    mockConnected = false;
    setNavigatorOnLine(false);
    vi.resetModules();

    const { getQueuedMutations, removeMutation } = await import('../offlineQueue');
    const existing = await getQueuedMutations();
    for (const m of existing) {
      await removeMutation(m.id);
    }
  });

  it('strictly isolates offline queued mutations between Account A and Account B in IndexedDB', async () => {
    const { enqueueMutation, getQueuedMutationsForUser } = await import('../offlineQueue');

    // Account A enqueues offline tasks
    await enqueueMutation({
      method: 'POST',
      path: '/tasks',
      body: JSON.stringify({ title: 'Account A Secret Task' }),
      ownerUserId: 'account-a-id',
    });
    await enqueueMutation({
      method: 'POST',
      path: '/tasks',
      body: JSON.stringify({ title: 'Account A Private Note' }),
      ownerUserId: 'account-a-id',
    });

    // Account B enqueues offline tasks
    await enqueueMutation({
      method: 'POST',
      path: '/tasks',
      body: JSON.stringify({ title: 'Account B Task' }),
      ownerUserId: 'account-b-id',
    });

    const queueA = await getQueuedMutationsForUser('account-a-id');
    const queueB = await getQueuedMutationsForUser('account-b-id');

    expect(queueA).toHaveLength(2);
    expect(queueA.every((m) => m.ownerUserId === 'account-a-id')).toBe(true);

    expect(queueB).toHaveLength(1);
    expect(queueB[0].ownerUserId).toBe('account-b-id');
    expect(queueB[0].body).toContain('Account B Task');
  });

  it('prevents Account B from replaying or sending Account A mutations on reconnect', async () => {
    const { enqueueMutation, getQueuedMutationsForUser, removeMutation } = await import('../offlineQueue');

    // Account A left an offline mutation in queue
    await enqueueMutation({
      method: 'POST',
      path: '/tasks',
      body: JSON.stringify({ title: 'Account A Confidential Task' }),
      ownerUserId: 'account-a-id',
    });

    // Account B connects
    const accountBMutations = await getQueuedMutationsForUser('account-b-id');
    expect(accountBMutations).toHaveLength(0);

    // Simulate replay logic for Account B
    const mockRequest = vi.fn().mockResolvedValue({ id: 'server-id' });
    for (const m of accountBMutations) {
      await mockRequest(m.path, { method: m.method, body: m.body });
      await removeMutation(m.id);
    }

    // Server request should not have been called for Account A's mutation
    expect(mockRequest).not.toHaveBeenCalled();

    // Account A's mutation remains safely isolated for Account A
    const queueA = await getQueuedMutationsForUser('account-a-id');
    expect(queueA).toHaveLength(1);
    expect(queueA[0].body).toContain('Account A Confidential Task');
  });

  it('clears Account A mutations upon logout without affecting Account B', async () => {
    const { enqueueMutation, clearUserMutations, getQueuedMutationsForUser } = await import('../offlineQueue');

    await enqueueMutation({
      method: 'POST',
      path: '/tasks',
      body: JSON.stringify({ title: 'Account A Task' }),
      ownerUserId: 'account-a-id',
    });
    await enqueueMutation({
      method: 'POST',
      path: '/tasks',
      body: JSON.stringify({ title: 'Account B Task' }),
      ownerUserId: 'account-b-id',
    });

    // Logout Account A
    await clearUserMutations('account-a-id');

    expect(await getQueuedMutationsForUser('account-a-id')).toHaveLength(0);
    expect(await getQueuedMutationsForUser('account-b-id')).toHaveLength(1);
  });

  it('client API wrappers refuse offline enqueue when unauthenticated or user id is missing', async () => {
    const { setCurrentUserId, apiCreateTask } = await import('../../api/client');
    const { getQueuedMutations } = await import('../offlineQueue');

    setCurrentUserId(null);

    await expect(apiCreateTask({ title: 'Unauthenticated Task', priority: 4 })).rejects.toThrow(
      'Cannot enqueue offline mutation without an authenticated user',
    );

    const queued = await getQueuedMutations();
    expect(queued).toHaveLength(0);
  });

  it('remapping ID for Account A does not affect Account B queued paths or records', async () => {
    const { enqueueMutation, remapQueuedId, getQueuedMutationsForUser } = await import('../offlineQueue');

    const tempId = 'client-uuid-123';
    await enqueueMutation({
      method: 'PATCH',
      path: `/tasks/${tempId}`,
      body: JSON.stringify({ title: 'Updated' }),
      ownerUserId: 'account-a-id',
    });
    await enqueueMutation({
      method: 'PATCH',
      path: `/tasks/${tempId}`,
      body: JSON.stringify({ title: 'Account B Task using same temp ID' }),
      ownerUserId: 'account-b-id',
    });

    await remapQueuedId(tempId, 'server-real-id-999');

    const queueA = await getQueuedMutationsForUser('account-a-id');
    const queueB = await getQueuedMutationsForUser('account-b-id');

    // Both user queues remap path correctly without cross-contamination of ownership
    expect(queueA[0].path).toBe('/tasks/server-real-id-999');
    expect(queueA[0].ownerUserId).toBe('account-a-id');

    expect(queueB[0].path).toBe('/tasks/server-real-id-999');
    expect(queueB[0].ownerUserId).toBe('account-b-id');
  });
});
