import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      path: '/socket.io',
      autoConnect: false,
    });

    if (import.meta.env.DEV) {
      socket.on('connect', () => console.log('[sync] connected', socket?.id));
      socket.on('disconnect', (reason) => console.log('[sync] disconnected', reason));
      socket.on('connect_error', (err) => console.error('[sync] connect_error', err.message));
      socket.on('sync', (event) => console.log('[sync] event', event.entityType, event.eventType, event.entityId));
    }
  }
  return socket;
}

export function connectSocket(token: string): void {
  const s = getSocket();
  s.auth = { token };
  s.connect();
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
  }
}

export function getSyncStatus(): 'connected' | 'disconnected' {
  return socket?.connected ? 'connected' : 'disconnected';
}
