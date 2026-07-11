import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { SyncEvent } from '../../hooks/useSync';

let capturedSyncHandler: ((event: SyncEvent) => void) | null = null;

vi.mock('../../utils/socket', () => ({
  getSocket: () => ({
    on: vi.fn((event: string, handler: (e: SyncEvent) => void) => {
      if (event === 'sync') capturedSyncHandler = handler;
    }),
    off: vi.fn(),
    connected: true,
  }),
}));

import { useSync } from '../../hooks/useSync';

function makeEvent(overrides: Partial<SyncEvent> = {}): SyncEvent {
  return {
    id: '1',
    entityType: 'task',
    eventType: 'created',
    entityId: 'task-abc',
    userId: 'user-1',
    emittedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('SyncEvent: entity type filtering', () => {
  beforeEach(() => {
    capturedSyncHandler = null;
  });

  it('delivers task events to handler', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const event = makeEvent({ entityType: 'task' });
    act(() => { capturedSyncHandler?.(event); });
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('delivers project events to handler', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const event = makeEvent({ entityType: 'project' });
    act(() => { capturedSyncHandler?.(event); });
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('delivers section events to handler', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const event = makeEvent({ entityType: 'section' });
    act(() => { capturedSyncHandler?.(event); });
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('delivers label events to handler', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const event = makeEvent({ entityType: 'label' });
    act(() => { capturedSyncHandler?.(event); });
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('delivers comment events to handler', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const event = makeEvent({ entityType: 'comment' });
    act(() => { capturedSyncHandler?.(event); });
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('delivers reminder events to handler', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const event = makeEvent({ entityType: 'reminder' });
    act(() => { capturedSyncHandler?.(event); });
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('delivers preferences events to handler', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const event = makeEvent({ entityType: 'preferences' });
    act(() => { capturedSyncHandler?.(event); });
    expect(handler).toHaveBeenCalledWith(event);
  });
});

describe('SyncEvent: event type coverage', () => {
  beforeEach(() => {
    capturedSyncHandler = null;
  });

  const eventTypes: SyncEvent['eventType'][] = ['created', 'updated', 'deleted', 'completed', 'uncompleted'];

  it.each(eventTypes)('delivers %s event', (eventType) => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const event = makeEvent({ eventType });
    act(() => { capturedSyncHandler?.(event); });
    expect(handler).toHaveBeenCalledWith(event);
    expect(handler.mock.calls[0][0].eventType).toBe(eventType);
  });
});

describe('Cross-tab sync: bidirectional simulation', () => {
  beforeEach(() => {
    capturedSyncHandler = null;
  });

  it('Tab 1 create → Tab 2 receives event', () => {
    const tab1Handler = vi.fn();
    const tab2Handler = vi.fn();

    renderHook(() => useSync(tab1Handler));
    const tab1HandlerFn = capturedSyncHandler!;

    capturedSyncHandler = null;
    renderHook(() => useSync(tab2Handler));
    const tab2HandlerFn = capturedSyncHandler!;

    const createEvent = makeEvent({
      entityType: 'task',
      eventType: 'created',
      entityId: 'new-task',
    });

    act(() => { tab2HandlerFn(createEvent); });

    expect(tab2Handler).toHaveBeenCalledWith(createEvent);
    expect(tab2Handler.mock.calls[0][0].eventType).toBe('created');
  });

  it('Tab 2 create → Tab 1 receives event', () => {
    const tab1Handler = vi.fn();
    const tab2Handler = vi.fn();

    renderHook(() => useSync(tab1Handler));
    const tab1HandlerFn = capturedSyncHandler!;

    capturedSyncHandler = null;
    renderHook(() => useSync(tab2Handler));
    const tab2HandlerFn = capturedSyncHandler!;

    const createEvent = makeEvent({
      entityType: 'task',
      eventType: 'created',
      entityId: 'new-task-from-tab2',
    });

    act(() => { tab1HandlerFn(createEvent); });

    expect(tab1Handler).toHaveBeenCalledWith(createEvent);
  });

  it('Tab 1 delete → Tab 2 receives event', () => {
    const tab2Handler = vi.fn();
    renderHook(() => useSync(tab2Handler));
    const tab2HandlerFn = capturedSyncHandler!;

    const deleteEvent = makeEvent({
      entityType: 'task',
      eventType: 'deleted',
      entityId: 'to-delete',
    });

    act(() => { tab2HandlerFn(deleteEvent); });

    expect(tab2Handler).toHaveBeenCalledWith(deleteEvent);
  });

  it('Tab 1 complete → Tab 2 receives event', () => {
    const tab2Handler = vi.fn();
    renderHook(() => useSync(tab2Handler));
    const tab2HandlerFn = capturedSyncHandler!;

    const completeEvent = makeEvent({
      entityType: 'task',
      eventType: 'completed',
      entityId: 'to-complete',
    });

    act(() => { tab2HandlerFn(completeEvent); });

    expect(tab2Handler).toHaveBeenCalledWith(completeEvent);
  });

  it('Tab 1 reopen → Tab 2 receives event', () => {
    const tab2Handler = vi.fn();
    renderHook(() => useSync(tab2Handler));
    const tab2HandlerFn = capturedSyncHandler!;

    const reopenEvent = makeEvent({
      entityType: 'task',
      eventType: 'uncompleted',
      entityId: 'to-reopen',
    });

    act(() => { tab2HandlerFn(reopenEvent); });

    expect(tab2Handler).toHaveBeenCalledWith(reopenEvent);
  });

  it('Tab 1 edit → Tab 2 receives event', () => {
    const tab2Handler = vi.fn();
    renderHook(() => useSync(tab2Handler));
    const tab2HandlerFn = capturedSyncHandler!;

    const editEvent = makeEvent({
      entityType: 'task',
      eventType: 'updated',
      entityId: 'to-edit',
      payload: { title: 'Updated Title' },
    });

    act(() => { tab2HandlerFn(editEvent); });

    expect(tab2Handler).toHaveBeenCalledWith(editEvent);
    expect(editEvent.payload).toEqual({ title: 'Updated Title' });
  });
});

describe('Cross-tab sync: failure scenarios', () => {
  beforeEach(() => {
    capturedSyncHandler = null;
  });

  it('handler receives event with missing optional fields', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const event: SyncEvent = {
      id: '1',
      entityType: 'task',
      eventType: 'created',
      entityId: 'task-1',
      userId: 'user-1',
      emittedAt: new Date().toISOString(),
    };
    act(() => { capturedSyncHandler?.(event); });
    expect(handler).toHaveBeenCalledWith(event);
    expect(event.projectId).toBeUndefined();
    expect(event.payload).toBeUndefined();
  });

  it('handler receives event with projectId', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const event = makeEvent({ projectId: 'project-1' });
    act(() => { capturedSyncHandler?.(event); });
    expect(handler).toHaveBeenCalledWith(event);
    expect(event.projectId).toBe('project-1');
  });

  it('handler receives event with payload', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const payload = { title: 'Test', isCompleted: false };
    const event = makeEvent({ payload });
    act(() => { capturedSyncHandler?.(event); });
    expect(handler).toHaveBeenCalledWith(event);
    expect(event.payload).toEqual(payload);
  });

  it('multiple rapid events are all delivered', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));

    const events = [
      makeEvent({ id: '1', entityId: 'task-1', eventType: 'created' }),
      makeEvent({ id: '2', entityId: 'task-2', eventType: 'created' }),
      makeEvent({ id: '3', entityId: 'task-1', eventType: 'updated' }),
      makeEvent({ id: '4', entityId: 'task-1', eventType: 'completed' }),
      makeEvent({ id: '5', entityId: 'task-2', eventType: 'deleted' }),
    ];

    act(() => {
      for (const event of events) {
        capturedSyncHandler?.(event);
      }
    });

    expect(handler).toHaveBeenCalledTimes(5);
    expect(handler).toHaveBeenNthCalledWith(1, events[0]);
    expect(handler).toHaveBeenNthCalledWith(2, events[1]);
    expect(handler).toHaveBeenNthCalledWith(3, events[2]);
    expect(handler).toHaveBeenNthCalledWith(4, events[3]);
    expect(handler).toHaveBeenNthCalledWith(5, events[4]);
  });

  it('event with valid ISO timestamp is delivered', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    const timestamp = '2026-05-17T10:30:00.000Z';
    const event = makeEvent({ emittedAt: timestamp });
    act(() => { capturedSyncHandler?.(event); });
    expect(handler).toHaveBeenCalledWith(event);
    expect(event.emittedAt).toBe(timestamp);
    expect(new Date(event.emittedAt).toString()).not.toBe('Invalid Date');
  });
});
