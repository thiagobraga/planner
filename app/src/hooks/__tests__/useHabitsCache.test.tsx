import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHabitsCache } from '../useHabitsCache';
import type { SyncEvent } from '../../contracts/sync';

let syncHandler: ((event: SyncEvent) => void) | null = null;
vi.mock('../useSync', () => ({ useSync: (handler: (event: SyncEvent) => void) => { syncHandler = handler; } }));

const event = (n: number): SyncEvent => ({
  id: `e${n}`, entityType: 'habit_completion', eventType: 'created', entityId: `h${n}`, userId: 'u1', emittedAt: '2026-11-20T00:00:00Z',
});

describe('useHabitsCache', () => {
  afterEach(() => vi.useRealTimers());

  it('refetches habits once for a burst of remote changes', async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    renderHook(() => useHabitsCache(), { wrapper });

    vi.useFakeTimers();
    act(() => {
      for (let n = 0; n < 10; n++) syncHandler!(event(n));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['habits'] });
  });

  it('ignores events for other entities', async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    renderHook(() => useHabitsCache(), { wrapper });
    vi.useFakeTimers();
    act(() => syncHandler!({ ...event(1), entityType: 'task' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
