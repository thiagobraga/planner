import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const mockSocket = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  auth: null as { token: string } | null,
  connected: false,
};

const mockIo = vi.fn(() => mockSocket);

vi.mock('socket.io-client', () => ({
  io: mockIo,
}));

const mockNotifyUnauthorized = vi.fn();
vi.mock('../authEvents', () => ({
  notifyUnauthorized: () => mockNotifyUnauthorized(),
}));

// `mockSocket.on` records every listener so tests can invoke the one
// registered for a given event name, the way the real socket would.
function trigger(event: string, ...args: unknown[]) {
  for (const call of mockSocket.on.mock.calls) {
    if (call[0] === event) {
      (call[1] as (...a: unknown[]) => void)(...args);
    }
  }
}

// Every test re-imports the module (vi.resetModules below), so its DOM
// listeners are captured here instead of really being attached - otherwise the
// listeners left behind by earlier module instances would answer these events
// too, on top of the ones under test.
const domListeners: Array<[string, EventListener]> = [];

function fireDom(event: string) {
  for (const [name, handler] of domListeners) {
    if (name === event) handler(new Event(event));
  }
}

describe('socket utilities', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    domListeners.length = 0;
    vi.spyOn(window, 'addEventListener').mockImplementation((name, handler) => {
      domListeners.push([name, handler as EventListener]);
    });
    vi.spyOn(document, 'addEventListener').mockImplementation((name, handler) => {
      domListeners.push([name, handler as EventListener]);
    });
    mockIo.mockClear();
    mockSocket.connected = false;
    mockSocket.auth = null;
    mockSocket.connect.mockClear();
    mockSocket.disconnect.mockClear();
    mockSocket.on.mockClear();
    mockNotifyUnauthorized.mockClear();

    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSocket', () => {
    it('creates a socket instance on first call', async () => {
      const { getSocket } = await import('../socket');
      const socket = getSocket();
      expect(mockIo).toHaveBeenCalledTimes(1);
      expect(socket).toBe(mockSocket);
    });

    it('returns the same socket instance on subsequent calls', async () => {
      const { getSocket } = await import('../socket');
      const socket1 = getSocket();
      const socket2 = getSocket();
      expect(socket1).toBe(socket2);
    });

    it('configures socket with correct path, autoConnect false, and credentials', async () => {
      const { getSocket } = await import('../socket');
      getSocket();
      expect(mockIo).toHaveBeenCalledWith('/', {
        path: '/socket.io',
        autoConnect: false,
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 10_000,
      });
    });

    it('registers debug listeners in DEV mode', async () => {
      const originalDev = import.meta.env.DEV;
      import.meta.env.DEV = true;

      vi.resetModules();
      const { getSocket } = await import('../socket');
      getSocket();

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('sync', expect.any(Function));

      import.meta.env.DEV = originalDev;
    });
  });

  describe('connectSocket', () => {
    it('connects the socket', async () => {
      const { getSocket, connectSocket } = await import('../socket');
      const socket = getSocket();
      connectSocket();
      expect(socket.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnectSocket', () => {
    it('disconnects the socket if it exists', async () => {
      const { getSocket, connectSocket, disconnectSocket } = await import('../socket');
      getSocket();
      connectSocket();
      disconnectSocket();
      expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSyncStatus', () => {
    it('returns disconnected when socket is not connected', async () => {
      const { getSocket, getSyncStatus } = await import('../socket');
      getSocket();
      mockSocket.connected = false;
      expect(getSyncStatus()).toBe('disconnected');
    });

    it('returns connected when socket is connected', async () => {
      const { getSocket, getSyncStatus } = await import('../socket');
      getSocket();
      mockSocket.connected = true;
      expect(getSyncStatus()).toBe('connected');
    });

    it('returns disconnected when socket is not initialized', async () => {
      const { getSyncStatus } = await import('../socket');
      expect(getSyncStatus()).toBe('disconnected');
    });
  });

  describe('connect_error handling', () => {
    it('disconnects and reports a dead session on an UNAUTHORIZED connect_error', async () => {
      const { getSocket } = await import('../socket');
      getSocket();

      trigger('connect_error', new Error('UNAUTHORIZED'));

      expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
      expect(mockNotifyUnauthorized).toHaveBeenCalledTimes(1);
    });

    it('leaves reconnection alone for a plain network error, so it keeps retrying', async () => {
      const { getSocket } = await import('../socket');
      getSocket();

      trigger('connect_error', new Error('xhr poll error'));

      expect(mockSocket.disconnect).not.toHaveBeenCalled();
      expect(mockNotifyUnauthorized).not.toHaveBeenCalled();
    });
  });

  // socket.io-client never retries a disconnect the server initiated, and the
  // API closes sockets that way on every session revalidation sweep - without
  // these paths the tab stays "Offline" until it is reloaded by hand.
  describe('recovery from a server-initiated disconnect', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('reconnects after a backoff delay', async () => {
      const { connectSocket } = await import('../socket');
      connectSocket();
      mockSocket.connect.mockClear();

      trigger('disconnect', 'io server disconnect');
      expect(mockSocket.connect).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1_000);
      expect(mockSocket.connect).toHaveBeenCalledTimes(1);
    });

    it('backs off exponentially across repeated server disconnects', async () => {
      const { connectSocket } = await import('../socket');
      connectSocket();
      mockSocket.connect.mockClear();

      trigger('disconnect', 'io server disconnect');
      await vi.advanceTimersByTimeAsync(1_000);
      expect(mockSocket.connect).toHaveBeenCalledTimes(1);

      trigger('disconnect', 'io server disconnect');
      await vi.advanceTimersByTimeAsync(1_000);
      expect(mockSocket.connect).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(mockSocket.connect).toHaveBeenCalledTimes(2);
    });

    it('resets the backoff once a connection succeeds', async () => {
      const { connectSocket } = await import('../socket');
      connectSocket();
      mockSocket.connect.mockClear();

      trigger('disconnect', 'io server disconnect');
      await vi.advanceTimersByTimeAsync(1_000);
      trigger('connect');

      trigger('disconnect', 'io server disconnect');
      await vi.advanceTimersByTimeAsync(1_000);
      expect(mockSocket.connect).toHaveBeenCalledTimes(2);
    });

    it('leaves other disconnect reasons to socket.io own retry loop', async () => {
      const { connectSocket } = await import('../socket');
      connectSocket();
      mockSocket.connect.mockClear();

      trigger('disconnect', 'transport close');
      await vi.advanceTimersByTimeAsync(60_000);

      expect(mockSocket.connect).not.toHaveBeenCalled();
    });

    it('does not resurrect a socket the app closed on logout', async () => {
      const { connectSocket, disconnectSocket } = await import('../socket');
      connectSocket();
      disconnectSocket();
      mockSocket.connect.mockClear();

      trigger('disconnect', 'io server disconnect');
      await vi.advanceTimersByTimeAsync(60_000);

      expect(mockSocket.connect).not.toHaveBeenCalled();
    });

    it('stops retrying once the session is reported dead', async () => {
      const { connectSocket } = await import('../socket');
      connectSocket();
      mockSocket.connect.mockClear();

      trigger('disconnect', 'io server disconnect');
      trigger('connect_error', new Error('UNAUTHORIZED'));
      await vi.advanceTimersByTimeAsync(60_000);

      expect(mockSocket.connect).not.toHaveBeenCalled();
      expect(mockNotifyUnauthorized).toHaveBeenCalledTimes(1);
    });
  });

  // Background tabs get their timers throttled, so a pending backoff can be
  // minutes stale by the time the user is looking at the screen again.
  describe('recovery on wake signals', () => {
    it('reconnects immediately when connectivity returns', async () => {
      const { connectSocket } = await import('../socket');
      connectSocket();
      mockSocket.connect.mockClear();
      mockSocket.connected = false;

      fireDom('online');

      expect(mockSocket.connect).toHaveBeenCalledTimes(1);
    });

    it('reconnects immediately when the tab is foregrounded', async () => {
      const { connectSocket } = await import('../socket');
      connectSocket();
      mockSocket.connect.mockClear();
      mockSocket.connected = false;

      fireDom('visibilitychange');

      expect(mockSocket.connect).toHaveBeenCalledTimes(1);
    });

    it('reconnects a page restored from the back/forward cache', async () => {
      const { connectSocket } = await import('../socket');
      connectSocket();
      mockSocket.connect.mockClear();
      mockSocket.connected = false;

      fireDom('pageshow');

      expect(mockSocket.connect).toHaveBeenCalledTimes(1);
    });

    it('leaves an already connected socket alone', async () => {
      const { connectSocket } = await import('../socket');
      connectSocket();
      mockSocket.connect.mockClear();
      mockSocket.connected = true;

      fireDom('online');

      expect(mockSocket.connect).not.toHaveBeenCalled();
    });

    it('ignores wake signals while logged out', async () => {
      const { getSocket } = await import('../socket');
      getSocket();
      mockSocket.connect.mockClear();
      mockSocket.connected = false;

      fireDom('online');

      expect(mockSocket.connect).not.toHaveBeenCalled();
    });
  });
});
