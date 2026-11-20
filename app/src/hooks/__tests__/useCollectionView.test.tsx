import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCollectionView } from '../useCollectionView';
import { fetchCollectionView } from '../../api/client';
import type { SyncEvent } from '../../contracts/sync';

let syncHandler: ((event: SyncEvent) => void) | null = null;
vi.mock('../useSync', () => ({ useSync: (handler: (event: SyncEvent) => void) => { syncHandler = handler; } }));
vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchCollectionView: vi.fn().mockResolvedValue({ tasks: [], sections: [], statuses: [], boardOrder: {} }),
}));

const event = (n: number): SyncEvent => ({
  id: `e${n}`, entityType: 'task', eventType: 'created', entityId: `t${n}`, userId: 'u1', collectionId: 'c1', emittedAt: '2026-11-20T00:00:00Z',
});

describe('useCollectionView', () => {
  afterEach(() => vi.useRealTimers());

  it('refetches once for a burst of remote changes', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useCollectionView('c1', false), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    vi.mocked(fetchCollectionView).mockClear();

    vi.useFakeTimers();
    act(() => {
      for (let n = 0; n < 10; n++) syncHandler!(event(n));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(fetchCollectionView).toHaveBeenCalledTimes(1);
  });
});
