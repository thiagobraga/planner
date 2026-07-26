import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useVersionCheck } from '../useVersionCheck';

const fetchMock = vi.fn();

function jsonResponse(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as Response;
}

beforeEach(() => {
  // shouldAdvanceTime keeps real time flowing for anything not explicitly
  // advanced (needed for waitFor's internal polling), while
  // vi.advanceTimersByTimeAsync below still fast-forwards our setInterval.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useVersionCheck', () => {
  it('reports no update while the version stays the same across polls', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ version: 'v1' }));

    const { result } = renderHook(() => useVersionCheck());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(result.current).toBe(false);
  });

  it('reports an update once a later poll sees a different version', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ version: 'v1' }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ version: 'v2' }));

    const { result } = renderHook(() => useVersionCheck());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(result.current).toBe(true);
  });

  it('ignores a failed poll instead of falsely flagging an update', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ version: 'v1' }));
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useVersionCheck());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(result.current).toBe(false);
  });
});
