import { render, act, cleanup, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { SyncEvent } from '../../contracts/sync';
import { AppShell } from '../AppShell';

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
  getSocketId: () => 'local-session',
}));

vi.mock('../nav/TopBar', () => ({ TopBar: () => null }));
vi.mock('../QuickAdd', () => ({ QuickAdd: () => null }));
vi.mock('../SearchOverlay', () => ({ SearchOverlay: () => null }));
vi.mock('../detail/TaskDetailHost', () => ({ TaskDetailHost: () => null }));
vi.mock('../AgentNotice', () => ({ AgentNotice: () => null }));
vi.mock('../../contexts/PlannerDragContext', () => ({
  PlannerDragProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../../hooks/useVersionCheck', () => ({ useVersionCheck: () => false }));
vi.mock('../../hooks/useFullWidth', () => ({
  useFullWidth: () => ({ toggleFullWidth: vi.fn() }),
}));
vi.mock('../../utils/fontLoader', () => ({ ensureFontLoaded: vi.fn() }));
vi.mock('../../api/client', () => ({
  fetchPreferences: vi.fn(() => new Promise(() => {})),
  apiCreateTask: vi.fn(),
}));

// Mirrors the AppShell callback for sync events handled at the shell level.
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

const queryKeys = [
  ['collections'],
  ['collection', 'collection-1'],
  ['collection', 'collection-2'],
  ['inbox'],
  ['today'],
  ['upcoming'],
  ['preferences'],
  ['document', 'task-abc'],
  ['document', 'other-task'],
] as const;

describe('AppShell: sync event invalidation', () => {
  let client: QueryClient;

  beforeEach(() => {
    capturedSyncHandler = null;
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    for (const key of queryKeys) client.setQueryData(key, { cached: true });
    client.setQueryData(['preferences'], {
      font: 'lora',
      background: 'beige',
      showDots: true,
    });
  });

  afterEach(() => {
    cleanup();
    client.clear();
  });

  function renderShell() {
    render(createElement(QueryClientProvider, { client },
      createElement(MemoryRouter, { initialEntries: ['/inbox'] },
        createElement(AppShell))));
    expect(capturedSyncHandler).toBeTypeOf('function');
  }

  async function emit(overrides: Partial<SyncEvent> = {}) {
    await act(async () => {
      capturedSyncHandler!(makeEvent(overrides));
    });
  }

  function expectInvalidated(expected: readonly (readonly string[])[]) {
    for (const key of queryKeys) {
      expect(client.getQueryState(key)?.isInvalidated, JSON.stringify(key))
        .toBe(expected.some((candidate) => JSON.stringify(candidate) === JSON.stringify(key)));
    }
  }

  it.each(['created', 'completed', 'uncompleted'] as const)(
    'leaves shell caches unchanged for task %s events',
    async (eventType) => {
      renderShell();
      await emit({ eventType });
      expectInvalidated([]);
    },
  );

  it('invalidates the collection index and every cached collection view', async () => {
    renderShell();
    await emit({ entityType: 'collection' });
    expectInvalidated([['collections'], ['collection', 'collection-1'], ['collection', 'collection-2']]);
  });

  it.each(['status', 'label'] as const)(
    'invalidates task-facing caches for %s events without invalidating the collection index',
    async (entityType) => {
      renderShell();
      await emit({ entityType });
      expectInvalidated([
        ['collection', 'collection-1'], ['collection', 'collection-2'],
        ['inbox'], ['today'], ['upcoming'],
      ]);
    },
  );

  it('replaces cached preferences with the sync payload and applies it to the shell', async () => {
    renderShell();
    const payload = { font: 'hubballi', showDots: false, background: 'white' };
    await emit({ entityType: 'preferences', eventType: 'updated', payload });
    expect(client.getQueryData(['preferences'])).toEqual(payload);
    await waitFor(() => expect(document.body).toHaveClass('font-hubballi'));
    expect(document.documentElement).toHaveAttribute('data-theme', 'white');
    expectInvalidated([['inbox'], ['collection', 'collection-1'], ['collection', 'collection-2']]);
  });

  it('invalidates preferences without a payload while retaining cached data', async () => {
    renderShell();
    const previous = client.getQueryData(['preferences']);
    await emit({ entityType: 'preferences', eventType: 'updated' });
    expect(client.getQueryData(['preferences'])).toEqual(previous);
    expectInvalidated([
      ['preferences'], ['inbox'], ['collection', 'collection-1'], ['collection', 'collection-2'],
    ]);
  });

  it('invalidates only the updated task document', async () => {
    renderShell();
    await emit({ eventType: 'updated' });
    expectInvalidated([['document', 'task-abc']]);
  });

  it('removes only the deleted task document', async () => {
    renderShell();
    await emit({ eventType: 'deleted' });
    expect(client.getQueryState(['document', 'task-abc'])).toBeUndefined();
    expect(client.getQueryData(['document', 'other-task'])).toEqual({ cached: true });
    for (const key of queryKeys.filter((key) => key[1] !== 'task-abc')) {
      expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    }
  });
});
