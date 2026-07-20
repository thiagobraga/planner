import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { QueuedMutation } from '../../utils/offlineQueue';

const TEST_USER = 'user-test-1';

let mockOn: ReturnType<typeof vi.fn>;
let mockOff: ReturnType<typeof vi.fn>;
let queuedMutations: QueuedMutation[];

const mockGetQueuedMutationsForUser = vi.fn(async (userId: string) => {
  return queuedMutations.filter((m) => m.ownerUserId === userId).sort((a, b) => a.createdAt - b.createdAt);
});
const mockRemoveMutation = vi.fn(async (id: string) => {
  queuedMutations = queuedMutations.filter((m) => m.id !== id);
});
const mockRemapQueuedId = vi.fn(async (oldId: string, newId: string) => {
  queuedMutations = queuedMutations.map((m) => ({
    ...m,
    path: m.path
      .split('/')
      .map((segment) => (segment === oldId ? newId : segment))
      .join('/'),
  }));
});
const mockRequest = vi.fn<(_path: string, _init?: RequestInit) => Promise<unknown>>(async () => ({}));

vi.mock('../../utils/socket', () => ({
  getSocket: () => ({ on: mockOn, off: mockOff }),
}));

vi.mock('../../utils/offlineQueue', () => ({
  getQueuedMutationsForUser: (...args: [string]) => mockGetQueuedMutationsForUser(...args),
  removeMutation: (id: string) => mockRemoveMutation(id),
  remapQueuedId: (oldId: string, newId: string) => mockRemapQueuedId(oldId, newId),
}));

vi.mock('../../api/client', () => ({
  request: (path: string, init?: RequestInit) => mockRequest(path, init),
}));

import { useOfflineQueueReplay } from '../useOfflineQueueReplay';

function getConnectHandler(): (() => Promise<void> | void) | undefined {
  return mockOn.mock.calls.find(([event]) => event === 'connect')?.[1];
}

function makeMutation(overrides: Partial<QueuedMutation> = {}): QueuedMutation {
  return {
    id: 'q-1',
    method: 'POST',
    path: '/tasks',
    body: JSON.stringify({ title: 'buy milk' }),
    createdAt: 1000,
    ownerUserId: TEST_USER,
    ...overrides,
  };
}

describe('useOfflineQueueReplay', () => {
  beforeEach(() => {
    mockOn = vi.fn();
    mockOff = vi.fn();
    queuedMutations = [];
    mockGetQueuedMutationsForUser.mockClear();
    mockRemoveMutation.mockClear();
    mockRemapQueuedId.mockClear();
    mockRequest.mockClear();
  });

  it('does not subscribe to the socket when userId is null', () => {
    renderHook(() => useOfflineQueueReplay(null));
    expect(mockOn).not.toHaveBeenCalled();
  });

  it('subscribes to socket "connect" when userId is provided', () => {
    renderHook(() => useOfflineQueueReplay(TEST_USER));
    expect(mockOn).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  it('replays a queued mutation through request() and removes it on success', async () => {
    queuedMutations = [makeMutation()];
    renderHook(() => useOfflineQueueReplay(TEST_USER));

    const connectHandler = getConnectHandler();
    await connectHandler?.();

    expect(mockRequest).toHaveBeenCalledWith('/tasks', {
      method: 'POST',
      body: makeMutation().body,
    });
    expect(mockRemoveMutation).toHaveBeenCalledWith('q-1');
  });

  it('only replays mutations owned by the given user', async () => {
    const userA = 'user-a';
    const userB = 'user-b';
    const mutA = makeMutation({ id: 'q-a', ownerUserId: userA, createdAt: 1000 });
    const mutB = makeMutation({ id: 'q-b', ownerUserId: userB, createdAt: 2000 });
    queuedMutations = [mutA, mutB];

    renderHook(() => useOfflineQueueReplay(userA));
    const connectHandler = getConnectHandler();
    await connectHandler?.();

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith(mutA.path, expect.any(Object));
    expect(mockRemoveMutation).toHaveBeenCalledWith('q-a');
  });

  it('replays mutations in FIFO order and stops at the first failure without removing it', async () => {
    const mut1 = makeMutation({ id: 'q-2', path: '/tasks/2', createdAt: 1000 });
    const mut2 = makeMutation({ id: 'q-3', path: '/tasks/3', createdAt: 2000 });
    queuedMutations = [mut1, mut2];

    mockRequest.mockImplementationOnce(async () => {
      throw new Error('network error');
    });

    renderHook(() => useOfflineQueueReplay(TEST_USER));
    const connectHandler = getConnectHandler();
    await connectHandler?.();

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith(mut1.path, {
      method: mut1.method,
      body: mut1.body,
    });
    expect(mockRemoveMutation).not.toHaveBeenCalled();
  });

  it('cleans up the socket listener on unmount', () => {
    const { unmount } = renderHook(() => useOfflineQueueReplay(TEST_USER));
    unmount();
    expect(mockOff).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  it('remaps a dependent complete mutation to the real server id and replays it', async () => {
    const clientId = 'client-minted-uuid';
    const create = makeMutation({
      id: 'q-create',
      path: '/tasks',
      createdAt: 1000,
      clientEntityId: clientId,
    });
    const complete = makeMutation({
      id: 'q-complete',
      method: 'POST',
      path: `/tasks/${clientId}/complete`,
      body: '',
      createdAt: 2000,
    });
    queuedMutations = [create, complete];

    mockRequest.mockImplementationOnce(async () => ({ id: 'server-id-1', title: 'buy milk' }));
    mockRequest.mockImplementationOnce(async () => ({}));

    renderHook(() => useOfflineQueueReplay(TEST_USER));
    const connectHandler = getConnectHandler();
    await connectHandler?.();

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest).toHaveBeenNthCalledWith(1, '/tasks', { method: 'POST', body: create.body });
    expect(mockRequest).toHaveBeenNthCalledWith(2, '/tasks/server-id-1/complete', { method: 'POST' });

    expect(mockRemapQueuedId).toHaveBeenCalledWith(clientId, 'server-id-1');
    expect(mockRemoveMutation).toHaveBeenCalledWith('q-create');
    expect(mockRemoveMutation).toHaveBeenCalledWith('q-complete');
    expect(queuedMutations).toHaveLength(0);
  });

  it('remaps a dependent delete mutation to the real server id and replays it', async () => {
    const clientId = 'client-minted-uuid-2';
    const create = makeMutation({
      id: 'q-create-2',
      path: '/tasks',
      createdAt: 1000,
      clientEntityId: clientId,
    });
    const del = makeMutation({
      id: 'q-delete',
      method: 'DELETE',
      path: `/tasks/${clientId}`,
      body: '',
      createdAt: 2000,
    });
    queuedMutations = [create, del];

    mockRequest.mockImplementationOnce(async () => ({ id: 'server-id-2', title: 'buy eggs' }));
    mockRequest.mockImplementationOnce(async () => undefined);

    renderHook(() => useOfflineQueueReplay(TEST_USER));
    const connectHandler = getConnectHandler();
    await connectHandler?.();

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest).toHaveBeenNthCalledWith(2, '/tasks/server-id-2', { method: 'DELETE' });
    expect(mockRemapQueuedId).toHaveBeenCalledWith(clientId, 'server-id-2');
    expect(queuedMutations).toHaveLength(0);
  });

  it('does not remap when the create response id matches the client-minted id already', async () => {
    const clientId = 'client-minted-uuid-3';
    const create = makeMutation({
      id: 'q-create-3',
      body: '{}',
      createdAt: 1000,
      clientEntityId: clientId,
    });
    queuedMutations = [create];

    mockRequest.mockImplementationOnce(async () => ({ id: clientId }));

    renderHook(() => useOfflineQueueReplay(TEST_USER));
    const connectHandler = getConnectHandler();
    await connectHandler?.();

    expect(mockRemapQueuedId).not.toHaveBeenCalled();
  });
});
