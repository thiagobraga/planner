import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();

function jsonResponse(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as Response;
}

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
}

function setDocumentHidden(value: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, value });
}

// The poller lives at module scope (one interval and one request for the whole
// app), so each test needs a fresh module instance to start from a clean slate.
async function importHook() {
  const mod = await import('../useVersionCheck');
  return mod.useVersionCheck;
}

beforeEach(() => {
  // shouldAdvanceTime keeps real time flowing for anything not explicitly
  // advanced (needed for waitFor's internal polling), while
  // vi.advanceTimersByTimeAsync below still fast-forwards our setInterval.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  setNavigatorOnLine(true);
  setDocumentHidden(false);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useVersionCheck', () => {
  it('reports no update while the version stays the same across polls', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ current: 'v1', latest: 'v1' }));
    const useVersionCheck = await importHook();

    const { result } = renderHook(() => useVersionCheck());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(result.current).toBe(false);
  });

  it('reports an update once a later poll sees a different version', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ current: 'v1', latest: 'v1' }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ current: 'v1', latest: 'v2' }));
    const useVersionCheck = await importHook();

    const { result } = renderHook(() => useVersionCheck());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(result.current).toBe(true);
  });

  it('ignores a failed poll instead of falsely flagging an update', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ current: 'v1', latest: 'v1' }));
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const useVersionCheck = await importHook();

    const { result } = renderHook(() => useVersionCheck());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(result.current).toBe(false);
  });

  it('issues one request for several mounted consumers', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ current: 'v1', latest: 'v1' }));
    const useVersionCheck = await importHook();

    renderHook(() => useVersionCheck());
    renderHook(() => useVersionCheck());
    renderHook(() => useVersionCheck());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not re-request when a consumer remounts right away', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ current: 'v1', latest: 'v1' }));
    const useVersionCheck = await importHook();

    const first = renderHook(() => useVersionCheck());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    first.unmount();

    renderHook(() => useVersionCheck());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('skips polling while the tab is hidden and catches up when it is shown', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ current: 'v1', latest: 'v1' }));
    setDocumentHidden(true);
    const useVersionCheck = await importHook();

    renderHook(() => useVersionCheck());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    setDocumentHidden(false);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('skips polling while offline and catches up when connectivity returns', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ current: 'v1', latest: 'v1' }));
    setNavigatorOnLine(false);
    const useVersionCheck = await importHook();

    renderHook(() => useVersionCheck());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    setNavigatorOnLine(true);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rate-limits polls triggered by rapid tab switching', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ current: 'v1', latest: 'v1' }));
    const useVersionCheck = await importHook();

    renderHook(() => useVersionCheck());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops polling once an update has been found', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ current: 'v1', latest: 'v2' }));
    const useVersionCheck = await importHook();

    const { result } = renderHook(() => useVersionCheck());

    await waitFor(() => expect(result.current).toBe(true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
