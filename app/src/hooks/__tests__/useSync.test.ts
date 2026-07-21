import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { SyncEvent } from '../useSync';

let mockOn: ReturnType<typeof vi.fn>;
let mockOff: ReturnType<typeof vi.fn>;

let mockSocketId: string | undefined;

vi.mock('../../utils/socket', () => ({
  getSocket: () => ({ on: mockOn, off: mockOff, connected: true }),
  getSocketId: () => mockSocketId,
}));

import { useSync } from '../useSync';

describe('useSync', () => {
  beforeEach(() => {
    mockOn = vi.fn();
    mockOff = vi.fn();
    mockSocketId = 'socket-self';
  });

  /** An event as it arrives from the server. */
  const event = (over: Partial<SyncEvent> = {}): SyncEvent => ({
    id: 'e1',
    entityType: 'habit',
    eventType: 'updated',
    entityId: 'habit-1',
    userId: 'user-1',
    emittedAt: new Date().toISOString(),
    ...over,
  });

  it('ignores the echo of a change this session made', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const fire = mockOn.mock.calls[0][1] as (e: SyncEvent) => void;

    act(() => fire(event({ sourceId: 'socket-self' })));

    // Already applied optimistically and reconciled from the response; acting on
    // it would refetch over state that is already correct.
    expect(handler).not.toHaveBeenCalled();
  });

  it('handles the same change made by another session', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const fire = mockOn.mock.calls[0][1] as (e: SyncEvent) => void;

    act(() => fire(event({ sourceId: 'socket-other' })));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handles an unstamped event, which may be anyone\'s', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const fire = mockOn.mock.calls[0][1] as (e: SyncEvent) => void;

    act(() => fire(event()));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('subscribes handler to sync event on mount', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    expect(mockOn).toHaveBeenCalledWith('sync', expect.any(Function));
  });

  it('unsubscribes handler on unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useSync(handler));
    const registeredHandler = mockOn.mock.calls[0][1];
    unmount();
    expect(mockOff).toHaveBeenCalledWith('sync', registeredHandler);
  });

  it('receives created event', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const handlerFn = mockOn.mock.calls[0][1] as (e: SyncEvent) => void;
    const event: SyncEvent = {
      id: '1',
      entityType: 'task',
      eventType: 'created',
      entityId: 'task-1',
      userId: 'user-1',
      emittedAt: new Date().toISOString(),
    };
    act(() => { handlerFn(event); });
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('receives updated event', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const handlerFn = mockOn.mock.calls[0][1] as (e: SyncEvent) => void;
    const event: SyncEvent = {
      id: '2',
      entityType: 'task',
      eventType: 'updated',
      entityId: 'task-1',
      userId: 'user-1',
      emittedAt: new Date().toISOString(),
    };
    act(() => { handlerFn(event); });
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('receives completed event', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const handlerFn = mockOn.mock.calls[0][1] as (e: SyncEvent) => void;
    const event: SyncEvent = {
      id: '3',
      entityType: 'task',
      eventType: 'completed',
      entityId: 'task-1',
      userId: 'user-1',
      emittedAt: new Date().toISOString(),
    };
    act(() => { handlerFn(event); });
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('receives uncompleted event', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const handlerFn = mockOn.mock.calls[0][1] as (e: SyncEvent) => void;
    const event: SyncEvent = {
      id: '4',
      entityType: 'task',
      eventType: 'uncompleted',
      entityId: 'task-1',
      userId: 'user-1',
      emittedAt: new Date().toISOString(),
    };
    act(() => { handlerFn(event); });
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('receives deleted event', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const handlerFn = mockOn.mock.calls[0][1] as (e: SyncEvent) => void;
    const event: SyncEvent = {
      id: '5',
      entityType: 'task',
      eventType: 'deleted',
      entityId: 'task-1',
      userId: 'user-1',
      emittedAt: new Date().toISOString(),
    };
    act(() => { handlerFn(event); });
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('receives events for all entity types', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const handlerFn = mockOn.mock.calls[0][1] as (e: SyncEvent) => void;
    const entityTypes: SyncEvent['entityType'][] = ['task', 'collection', 'section', 'label', 'comment', 'reminder', 'preferences'];
    for (const entityType of entityTypes) {
      const event: SyncEvent = {
        id: `${entityType}-1`,
        entityType,
        eventType: 'created',
        entityId: `${entityType}-1`,
        userId: 'user-1',
        emittedAt: new Date().toISOString(),
      };
      act(() => { handlerFn(event); });
    }
    expect(handler).toHaveBeenCalledTimes(entityTypes.length);
  });

  it('re-subscribes when handler changes', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const { rerender } = renderHook(({ handler }) => useSync(handler), {
      initialProps: { handler: handler1 },
    });
    expect(mockOn).toHaveBeenCalledTimes(1);
    expect(mockOff).toHaveBeenCalledTimes(0);
    const firstRegisteredHandler = mockOn.mock.calls[0][1];

    rerender({ handler: handler2 });
    expect(mockOff).toHaveBeenCalledWith('sync', firstRegisteredHandler);
    expect(mockOn).toHaveBeenLastCalledWith('sync', expect.any(Function));
  });
});
