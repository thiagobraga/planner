import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();

let mockOn: ReturnType<typeof vi.fn>;
let mockOff: ReturnType<typeof vi.fn>;

vi.mock('../../utils/socket', () => ({
  getSocket: () => ({ on: mockOn, off: mockOff }),
}));

function jsonResponse(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as Response;
}

// The listener state lives at module scope (one REST call and one socket
// subscription for the whole app), so each test needs a fresh module
// instance to start from a clean slate.
async function importHook() {
  const mod = await import('../useVersionCheck');
  return mod.useVersionCheck;
}

function firePush(payload: { version: string }): void {
  const handler = mockOn.mock.calls.find((c) => c[0] === 'version')?.[1] as (p: { version: string }) => void;
  handler(payload);
}

beforeEach(() => {
  mockOn = vi.fn();
  mockOff = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  vi.resetModules();
});

describe('useVersionCheck', () => {
  it('reports no update when a version push matches the REST baseline', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ current: 'v1', latest: 'v1' }));
    const useVersionCheck = await importHook();

    const { result } = renderHook(() => useVersionCheck());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current).toBe(false);

    act(() => firePush({ version: 'v1' }));

    expect(result.current).toBe(false);
  });

  it('reports an update when a version push differs from the baseline', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ current: 'v1', latest: 'v1' }));
    const useVersionCheck = await importHook();

    const { result } = renderHook(() => useVersionCheck());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current).toBe(false);

    act(() => firePush({ version: 'v2' }));

    expect(result.current).toBe(true);
  });

  it('still reports an update from a socket push if the REST baseline call fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const useVersionCheck = await importHook();

    const { result } = renderHook(() => useVersionCheck());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current).toBe(false);

    act(() => firePush({ version: 'v2' }));

    expect(result.current).toBe(true);
  });

  it('reports an update immediately when the REST baseline is already stale', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ current: 'v1', latest: 'v2' }));
    const useVersionCheck = await importHook();

    const { result } = renderHook(() => useVersionCheck());

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('shares state across concurrent mounts - one REST call and one socket listener for several consumers', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ current: 'v1', latest: 'v1' }));
    const useVersionCheck = await importHook();

    const { result: r1 } = renderHook(() => useVersionCheck());
    const { result: r2 } = renderHook(() => useVersionCheck());
    const { result: r3 } = renderHook(() => useVersionCheck());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(mockOn.mock.calls.filter((c) => c[0] === 'version')).toHaveLength(1);

    act(() => firePush({ version: 'v2' }));

    expect(r1.current).toBe(true);
    expect(r2.current).toBe(true);
    expect(r3.current).toBe(true);
  });

  it('stops listening once an update has been found', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ current: 'v1', latest: 'v1' }));
    const useVersionCheck = await importHook();

    renderHook(() => useVersionCheck());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => firePush({ version: 'v2' }));

    expect(mockOff).toHaveBeenCalledWith('version', expect.any(Function));
  });

  it('unsubscribes on unmount and resubscribes on remount when no update was found', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ current: 'v1', latest: 'v1' }));
    const useVersionCheck = await importHook();

    const first = renderHook(() => useVersionCheck());
    await waitFor(() => expect(mockOn).toHaveBeenCalledWith('version', expect.any(Function)));

    first.unmount();
    expect(mockOff).toHaveBeenCalledWith('version', expect.any(Function));

    mockOn.mockClear();
    renderHook(() => useVersionCheck());
    expect(mockOn).toHaveBeenCalledWith('version', expect.any(Function));
  });
});
