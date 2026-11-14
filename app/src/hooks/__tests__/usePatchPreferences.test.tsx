import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { Preferences } from '../../types/api';

const apiUpdatePreferences = vi.fn();
vi.mock('../../api/client', () => ({ apiUpdatePreferences: (patch: unknown) => apiUpdatePreferences(patch) }));

const { usePatchPreferences } = await import('../usePatchPreferences');

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

describe('usePatchPreferences', () => {
  it('sends quick changes in order and keeps the newest one', async () => {
    const client = new QueryClient();
    client.setQueryData(['preferences'], { fullWidth: false } as Preferences);
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => usePatchPreferences(), { wrapper });
    const first = deferred<Preferences>();
    const second = deferred<Preferences>();
    apiUpdatePreferences.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    let pending: Promise<unknown>[] = [];
    act(() => {
      pending = [result.current({ dailyView: { style: 'notebook', range: 'w1' } }), result.current({ dailyView: { style: 'notebook', range: 'd2' } })];
    });
    expect(apiUpdatePreferences).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve({ dailyView: { style: 'notebook', range: 'w1' } } as Preferences);
      await pending[0];
    });
    await waitFor(() => expect(apiUpdatePreferences).toHaveBeenCalledTimes(2));
    expect(client.getQueryData<Preferences>(['preferences'])?.dailyView?.range).toBe('d2');

    await act(async () => {
      second.resolve({ dailyView: { style: 'notebook', range: 'd2' } } as Preferences);
      await pending[1];
    });
    expect(client.getQueryData<Preferences>(['preferences'])?.dailyView?.range).toBe('d2');
  });
});
