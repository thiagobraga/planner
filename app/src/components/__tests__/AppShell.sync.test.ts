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

// Mirrors the AppShell callback: invalidate all queries on any task sync event
function useAppShellSync(invalidate: () => void) {
  useSync(useCallback((event: SyncEvent) => {
    if (event.entityType === 'task') invalidate();
  }, [invalidate]));
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

describe('AppShell: task sync event → invalidateQueries', () => {
  let mockInvalidate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    capturedSyncHandler = null;
    mockInvalidate = vi.fn();
  });

  it('calls invalidate when a task sync event fires', () => {
    renderHook(() => useAppShellSync(mockInvalidate));
    act(() => { capturedSyncHandler?.(makeEvent()); });
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it('calls invalidate for all task event types', () => {
    renderHook(() => useAppShellSync(mockInvalidate));
    const types: SyncEvent['eventType'][] = ['created', 'updated', 'deleted', 'completed', 'uncompleted'];
    for (const eventType of types) {
      act(() => { capturedSyncHandler?.(makeEvent({ eventType })); });
    }
    expect(mockInvalidate).toHaveBeenCalledTimes(types.length);
  });

  it('does not invalidate for non-task entity types', () => {
    renderHook(() => useAppShellSync(mockInvalidate));
    act(() => {
      capturedSyncHandler?.(makeEvent({ entityType: 'project' }));
      capturedSyncHandler?.(makeEvent({ entityType: 'label' }));
      capturedSyncHandler?.(makeEvent({ entityType: 'comment' }));
    });
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
