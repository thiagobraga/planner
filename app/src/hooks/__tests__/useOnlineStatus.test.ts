import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

let mockOn: ReturnType<typeof vi.fn>;
let mockOff: ReturnType<typeof vi.fn>;
let mockConnected: boolean;

vi.mock('../../utils/socket', () => ({
  getSocket: () => ({ on: mockOn, off: mockOff, connected: mockConnected }),
  getSyncStatus: () => (mockConnected ? 'connected' : 'disconnected'),
}));

import { useOnlineStatus } from '../useOnlineStatus';

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
}

describe('useOnlineStatus', () => {
  beforeEach(() => {
    mockOn = vi.fn();
    mockOff = vi.fn();
    mockConnected = true;
    setNavigatorOnLine(true);
  });

  describe('pre-auth (isAuthenticated=false)', () => {
    it('reports online when navigator.onLine is true, regardless of socket state', () => {
      mockConnected = false;
      const { result } = renderHook(() => useOnlineStatus(false));
      expect(result.current).toBe(true);
    });

    it('reports offline when navigator.onLine is false', () => {
      setNavigatorOnLine(false);
      const { result } = renderHook(() => useOnlineStatus(false));
      expect(result.current).toBe(false);
    });

    it('ignores socket disconnect events', () => {
      const { result } = renderHook(() => useOnlineStatus(false));
      expect(result.current).toBe(true);

      const disconnectHandler = mockOn.mock.calls.find(([event]) => event === 'disconnect')?.[1];
      act(() => {
        mockConnected = false;
        disconnectHandler?.();
      });

      expect(result.current).toBe(true);
    });
  });

  describe('post-auth (isAuthenticated=true)', () => {
    it('reports online on mount when navigator.onLine is true and socket is connected', () => {
      const { result } = renderHook(() => useOnlineStatus(true));
      expect(result.current).toBe(true);
    });

    it('reports offline on mount when navigator.onLine is false', () => {
      setNavigatorOnLine(false);
      const { result } = renderHook(() => useOnlineStatus(true));
      expect(result.current).toBe(false);
    });

    it('reports offline on mount when the socket is not connected', () => {
      mockConnected = false;
      const { result } = renderHook(() => useOnlineStatus(true));
      expect(result.current).toBe(false);
    });

    it('subscribes to socket connect/disconnect events on mount', () => {
      renderHook(() => useOnlineStatus(true));
      expect(mockOn).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('transitions to offline when window fires "offline", even though the socket stays connected', () => {
      const { result } = renderHook(() => useOnlineStatus(true));
      expect(result.current).toBe(true);

      act(() => {
        setNavigatorOnLine(false);
        window.dispatchEvent(new Event('offline'));
      });

      expect(result.current).toBe(false);
    });

    it('transitions to offline when the socket disconnects, even though navigator.onLine stays true', () => {
      const { result } = renderHook(() => useOnlineStatus(true));
      expect(result.current).toBe(true);

      const disconnectHandler = mockOn.mock.calls.find(([event]) => event === 'disconnect')?.[1];
      act(() => {
        mockConnected = false;
        disconnectHandler?.();
      });

      expect(result.current).toBe(false);
    });

    it('only transitions back to online once both signals agree', () => {
      mockConnected = false;
      setNavigatorOnLine(false);
      const { result } = renderHook(() => useOnlineStatus(true));
      expect(result.current).toBe(false);

      const connectHandler = mockOn.mock.calls.find(([event]) => event === 'connect')?.[1];

      // Socket reconnects, but the browser still reports offline - must stay offline.
      act(() => {
        mockConnected = true;
        connectHandler?.();
      });
      expect(result.current).toBe(false);

      // Browser comes back online too - now both signals agree.
      act(() => {
        setNavigatorOnLine(true);
        window.dispatchEvent(new Event('online'));
      });
      expect(result.current).toBe(true);
    });
  });

  it('cleans up all listeners on unmount', () => {
    const { unmount } = renderHook(() => useOnlineStatus(true));
    unmount();

    expect(mockOff).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockOff).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });
});
