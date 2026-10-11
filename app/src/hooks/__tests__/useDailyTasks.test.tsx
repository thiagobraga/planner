import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDailyTasks } from '../useDailyTasks';

const mockFetchDaily = vi.hoisted(() => vi.fn());
vi.mock('../../api/client', () => ({ fetchDaily: mockFetchDaily }));

function view(from: string, to: string) {
  return { from, to, today: '2026-10-07', overdue: [], days: [] };
}

function setup(range: { from: string; to: string }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(({ from, to }) => useDailyTasks(from, to), { wrapper, initialProps: range });
  return { client, ...hook };
}

describe('useDailyTasks', () => {
  beforeEach(() => {
    mockFetchDaily.mockReset();
    mockFetchDaily.mockImplementation((from: string, to: string) => Promise.resolve(view(from, to)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches the range once and caches it under [daily, from, to]', async () => {
    const { client, result } = setup({ from: '2026-10-05', to: '2026-10-11' });

    await waitFor(() => expect(result.current.data?.from).toBe('2026-10-05'));

    expect(mockFetchDaily).toHaveBeenCalledTimes(1);
    expect(mockFetchDaily).toHaveBeenCalledWith('2026-10-05', '2026-10-11');
    expect(client.getQueryData(['daily', '2026-10-05', '2026-10-11'])).toBeDefined();
  });

  it('fetches only the new range when the range changes', async () => {
    const { result, rerender } = setup({ from: '2026-10-05', to: '2026-10-11' });
    await waitFor(() => expect(result.current.data).toBeDefined());

    rerender({ from: '2026-10-12', to: '2026-10-18' });

    await waitFor(() => expect(result.current.data?.from).toBe('2026-10-12'));
    expect(mockFetchDaily).toHaveBeenCalledTimes(2);
    expect(mockFetchDaily).toHaveBeenLastCalledWith('2026-10-12', '2026-10-18');
  });

  it('turns a burst of refreshes into one refetch', async () => {
    const { result } = setup({ from: '2026-10-05', to: '2026-10-11' });
    await waitFor(() => expect(result.current.data).toBeDefined());
    mockFetchDaily.mockClear();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => {
      result.current.refresh();
      result.current.refresh();
      result.current.refresh();
    });
    expect(mockFetchDaily).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(mockFetchDaily).toHaveBeenCalledTimes(1);
  });

  it('drops a pending refresh on unmount', async () => {
    const { result, unmount } = setup({ from: '2026-10-05', to: '2026-10-11' });
    await waitFor(() => expect(result.current.data).toBeDefined());
    mockFetchDaily.mockClear();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => result.current.refresh());
    unmount();
    await vi.advanceTimersByTimeAsync(500);

    expect(mockFetchDaily).not.toHaveBeenCalled();
  });
});
