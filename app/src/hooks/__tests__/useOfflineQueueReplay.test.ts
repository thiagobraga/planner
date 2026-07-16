import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { QueuedMutation } from '../../utils/offlineQueue';

let mockOn: ReturnType<typeof vi.fn>;
let mockOff: ReturnType<typeof vi.fn>;
let queuedMutations: QueuedMutation[];

const mockGetQueuedMutations = vi.fn(async () => queuedMutations);
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
const mockRequest = vi.fn<(_path: string, _init?: RequestInit) => Promise<any>>(async () => ({}));

vi.mock('../../utils/socket', () => ({
  getSocket: () => ({ on: mockOn, off: mockOff }),
}));

vi.mock('../../utils/offlineQueue', () => ({
  getQueuedMutations: (...args: []) => mockGetQueuedMutations(...args),
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

const mutation: QueuedMutation = {
  id: 'q-1',
  method: 'POST',
  path: '/tasks',
  body: JSON.stringify({ title: 'buy milk' }),
  createdAt: 1000,
};

describe('useOfflineQueueReplay', () => {
  beforeEach(() => {
    mockOn = vi.fn();
    mockOff = vi.fn();
    queuedMutations = [];
    mockGetQueuedMutations.mockClear();
    mockRemoveMutation.mockClear();
    mockRemapQueuedId.mockClear();
    mockRequest.mockClear();
  });

  it('does not subscribe to the socket when disabled', () => {
    renderHook(() => useOfflineQueueReplay(false));
    expect(mockOn).not.toHaveBeenCalled();
  });

  it('subscribes to socket "connect" when enabled', () => {
    renderHook(() => useOfflineQueueReplay(true));
    expect(mockOn).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  it('replays a queued mutation through request() and removes it on success', async () => {
    queuedMutations = [mutation];
    renderHook(() => useOfflineQueueReplay(true));

    const connectHandler = getConnectHandler();
    await connectHandler?.();

    expect(mockRequest).toHaveBeenCalledWith(mutation.path, {
      method: mutation.method,
      body: mutation.body,
    });
    expect(mockRemoveMutation).toHaveBeenCalledWith(mutation.id);
  });

  it('replays mutations in FIFO order and stops at the first failure without removing it', async () => {
    const second: QueuedMutation = { ...mutation, id: 'q-2', path: '/tasks/2', createdAt: 2000 };
    queuedMutations = [mutation, second];

    mockRequest.mockImplementationOnce(async () => {
      throw new Error('network error');
    });

    renderHook(() => useOfflineQueueReplay(true));
    const connectHandler = getConnectHandler();
    await connectHandler?.();

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith(mutation.path, {
      method: mutation.method,
      body: mutation.body,
    });
    expect(mockRemoveMutation).not.toHaveBeenCalled();
  });

  it('cleans up the socket listener on unmount', () => {
    const { unmount } = renderHook(() => useOfflineQueueReplay(true));
    unmount();
    expect(mockOff).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  it('remaps a dependent complete mutation to the real server id and replays it, instead of stalling', async () => {
    const clientId = 'client-minted-uuid';
    const create: QueuedMutation = {
      id: 'q-create',
      method: 'POST',
      path: '/tasks',
      body: JSON.stringify({ title: 'buy milk' }),
      createdAt: 1000,
      clientEntityId: clientId,
    };
    const complete: QueuedMutation = {
      id: 'q-complete',
      method: 'POST',
      path: `/tasks/${clientId}/complete`,
      body: '',
      createdAt: 2000,
    };
    queuedMutations = [create, complete];

    mockRequest.mockImplementationOnce(async () => ({ id: 'server-id-1', title: 'buy milk' }));
    mockRequest.mockImplementationOnce(async () => ({}));

    renderHook(() => useOfflineQueueReplay(true));
    const connectHandler = getConnectHandler();
    await connectHandler?.();

    // Both mutations replayed successfully - the queue did not stall.
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest).toHaveBeenNthCalledWith(1, '/tasks', { method: 'POST', body: create.body });
    // The second call must target the real server id, not the client-minted one.
    expect(mockRequest).toHaveBeenNthCalledWith(2, '/tasks/server-id-1/complete', { method: 'POST' });

    expect(mockRemapQueuedId).toHaveBeenCalledWith(clientId, 'server-id-1');
    expect(mockRemoveMutation).toHaveBeenCalledWith('q-create');
    expect(mockRemoveMutation).toHaveBeenCalledWith('q-complete');
    expect(queuedMutations).toHaveLength(0);
  });

  it('remaps a dependent delete mutation to the real server id and replays it, instead of stalling', async () => {
    const clientId = 'client-minted-uuid-2';
    const create: QueuedMutation = {
      id: 'q-create-2',
      method: 'POST',
      path: '/tasks',
      body: JSON.stringify({ title: 'buy eggs' }),
      createdAt: 1000,
      clientEntityId: clientId,
    };
    const del: QueuedMutation = {
      id: 'q-delete',
      method: 'DELETE',
      path: `/tasks/${clientId}`,
      body: '',
      createdAt: 2000,
    };
    queuedMutations = [create, del];

    mockRequest.mockImplementationOnce(async () => ({ id: 'server-id-2', title: 'buy eggs' }));
    mockRequest.mockImplementationOnce(async () => undefined);

    renderHook(() => useOfflineQueueReplay(true));
    const connectHandler = getConnectHandler();
    await connectHandler?.();

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest).toHaveBeenNthCalledWith(2, '/tasks/server-id-2', { method: 'DELETE' });
    expect(mockRemapQueuedId).toHaveBeenCalledWith(clientId, 'server-id-2');
    expect(queuedMutations).toHaveLength(0);
  });

  it('does not remap when the create response id matches the client-minted id already', async () => {
    const clientId = 'client-minted-uuid-3';
    const create: QueuedMutation = {
      id: 'q-create-3',
      method: 'POST',
      path: '/tasks',
      body: '{}',
      createdAt: 1000,
      clientEntityId: clientId,
    };
    queuedMutations = [create];

    mockRequest.mockImplementationOnce(async () => ({ id: clientId }));

    renderHook(() => useOfflineQueueReplay(true));
    const connectHandler = getConnectHandler();
    await connectHandler?.();

    expect(mockRemapQueuedId).not.toHaveBeenCalled();
  });
});
