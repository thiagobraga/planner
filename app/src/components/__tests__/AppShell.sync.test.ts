import { renderHook, act } from '@testing-library/react';
import { useCallback } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { SyncEvent } from '../../hooks/useSync';

// Capture the registered sync handler so tests can fire it manually
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

// Mirrors the AppShell callback for sync events handled at the shell level.
function useAppShellSync({
  invalidateCollections,
  invalidateInbox,
  invalidatePreferences,
  setPreferences,
}: {
  invalidateCollections: () => void;
  invalidateInbox: () => void;
  invalidatePreferences: () => void;
  setPreferences: (payload: unknown) => void;
}) {
  useSync(useCallback((event: SyncEvent) => {
    if (event.entityType === 'collection') {
      invalidateCollections();
    } else if (event.entityType === 'preferences') {
      if (event.payload && typeof event.payload === 'object') {
        setPreferences(event.payload);
      } else {
        invalidatePreferences();
      }
      invalidateInbox();
      invalidateCollections();
    }
  }, [invalidateCollections, invalidateInbox, invalidatePreferences, setPreferences]));
}

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

describe('AppShell: sync event invalidation', () => {
  let mockInvalidate: ReturnType<typeof vi.fn>;
  let mockInvalidateInbox: ReturnType<typeof vi.fn>;
  let mockInvalidatePreferences: ReturnType<typeof vi.fn>;
  let mockSetPreferences: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    capturedSyncHandler = null;
    mockInvalidate = vi.fn();
    mockInvalidateInbox = vi.fn();
    mockInvalidatePreferences = vi.fn();
    mockSetPreferences = vi.fn();
  });

  it('does not invalidate when a task sync event fires', () => {
    renderHook(() => useAppShellSync({
      invalidateCollections: mockInvalidate,
      invalidateInbox: mockInvalidateInbox,
      invalidatePreferences: mockInvalidatePreferences,
      setPreferences: mockSetPreferences,
    }));
    act(() => { capturedSyncHandler?.(makeEvent()); });
    expect(mockInvalidate).not.toHaveBeenCalled();
    expect(mockInvalidatePreferences).not.toHaveBeenCalled();
    expect(mockSetPreferences).not.toHaveBeenCalled();
  });

  it('does not invalidate for all task event types', () => {
    renderHook(() => useAppShellSync({
      invalidateCollections: mockInvalidate,
      invalidateInbox: mockInvalidateInbox,
      invalidatePreferences: mockInvalidatePreferences,
      setPreferences: mockSetPreferences,
    }));
    const types: SyncEvent['eventType'][] = ['created', 'updated', 'deleted', 'completed', 'uncompleted'];
    for (const eventType of types) {
      act(() => { capturedSyncHandler?.(makeEvent({ eventType })); });
    }
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it('invalidates for collection entity types', () => {
    renderHook(() => useAppShellSync({
      invalidateCollections: mockInvalidate,
      invalidateInbox: mockInvalidateInbox,
      invalidatePreferences: mockInvalidatePreferences,
      setPreferences: mockSetPreferences,
    }));
    act(() => {
      capturedSyncHandler?.(makeEvent({ entityType: 'collection' }));
    });
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it('sets preferences from preferences sync payload', () => {
    renderHook(() => useAppShellSync({
      invalidateCollections: mockInvalidate,
      invalidateInbox: mockInvalidateInbox,
      invalidatePreferences: mockInvalidatePreferences,
      setPreferences: mockSetPreferences,
    }));
    const payload = { font: 'lora', showDots: false, background: 'white' };
    act(() => {
      capturedSyncHandler?.(makeEvent({ entityType: 'preferences', eventType: 'updated', entityId: 'user-1', payload }));
    });
    expect(mockSetPreferences).toHaveBeenCalledWith(payload);
    expect(mockInvalidateInbox).toHaveBeenCalledTimes(1);
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
    expect(mockInvalidatePreferences).not.toHaveBeenCalled();
  });

  it('invalidates preferences when preferences sync has no payload', () => {
    renderHook(() => useAppShellSync({
      invalidateCollections: mockInvalidate,
      invalidateInbox: mockInvalidateInbox,
      invalidatePreferences: mockInvalidatePreferences,
      setPreferences: mockSetPreferences,
    }));
    act(() => {
      capturedSyncHandler?.(makeEvent({ entityType: 'preferences', eventType: 'updated', entityId: 'user-1' }));
    });
    expect(mockInvalidatePreferences).toHaveBeenCalledTimes(1);
    expect(mockInvalidateInbox).toHaveBeenCalledTimes(1);
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
    expect(mockSetPreferences).not.toHaveBeenCalled();
  });
});
