import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { SyncEvent } from '../useSync';

let mockOn: ReturnType<typeof vi.fn>;
let mockOff: ReturnType<typeof vi.fn>;

vi.mock('../../utils/socket', () => ({
  getSocket: () => ({ on: mockOn, off: mockOff, connected: true }),
}));

import { useSync } from '../useSync';

describe('useSync', () => {
  beforeEach(() => {
    mockOn = vi.fn();
    mockOff = vi.fn();
  });

  it('subscribes handler to sync event on mount', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    expect(mockOn).toHaveBeenCalledWith('sync', handler);
  });

  it('unsubscribes handler on unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useSync(handler));
    unmount();
    expect(mockOff).toHaveBeenCalledWith('sync', handler);
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
    const entityTypes: SyncEvent['entityType'][] = ['task', 'project', 'section', 'label', 'comment', 'reminder'];
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

    rerender({ handler: handler2 });
    expect(mockOff).toHaveBeenCalledWith('sync', handler1);
    expect(mockOn).toHaveBeenCalledWith('sync', handler2);
  });
});
