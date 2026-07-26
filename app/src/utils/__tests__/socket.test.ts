import { vi, describe, it, expect, beforeEach } from 'vitest';

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

describe('socket utilities', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockIo.mockClear();
    mockSocket.connected = false;
    mockSocket.auth = null;
    mockSocket.connect.mockClear();
    mockSocket.disconnect.mockClear();
    mockSocket.on.mockClear();
    mockNotifyUnauthorized.mockClear();

    vi.resetModules();
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
});
