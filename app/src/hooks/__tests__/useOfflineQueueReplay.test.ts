import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { QueuedMutation } from '../../utils/offlineQueue';

let mockOn: ReturnType<typeof vi.fn>;
let mockOff: ReturnType<typeof vi.fn>;
let queuedMutations: QueuedMutation[];

const mockGetQueuedMutations = vi.fn(async () => queuedMutations);
const mockRemoveMutation = vi.fn(async (_id: string) => {});
const mockRequest = vi.fn(async (_path: string, _init?: RequestInit) => ({}));

vi.mock('../../utils/socket', () => ({
  getSocket: () => ({ on: mockOn, off: mockOff }),
}));

vi.mock('../../utils/offlineQueue', () => ({
  getQueuedMutations: (...args: []) => mockGetQueuedMutations(...args),
  removeMutation: (id: string) => mockRemoveMutation(id),
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
});
