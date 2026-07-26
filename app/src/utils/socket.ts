import { io, Socket } from 'socket.io-client';
import { notifyUnauthorized } from './authEvents';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      path: '/socket.io',
      autoConnect: false,
      withCredentials: true,
    });

    // The server's `io.use` middleware (syncService.ts) only checks session
    // validity at connect time, so a session that dies while connected isn't
    // caught until the next reconnect attempt. socket.io-client can't tell an
    // auth rejection apart from a network hiccup and would otherwise retry
    // forever - stop it here and report the dead session the same way a 401
    // REST response would, instead of leaving the app stuck showing "Offline".
    socket.on('connect_error', (err) => {
      if (err.message === 'UNAUTHORIZED') {
        socket?.disconnect();
        notifyUnauthorized();
      }
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

export function connectSocket(): void {
  getSocket().connect();
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
  }
}

/**
 * This session's socket id, once connected.
 *
 * Sent with every mutation so the server can stamp the events it causes, and
 * compared against arriving events so a session ignores its own echo. Undefined
 * while disconnected, which is the safe direction: an unstamped event is
 * treated as somebody else's and still refetches.
 */
export function getSocketId(): string | undefined {
  return socket?.id;
}

export function getSyncStatus(): 'connected' | 'disconnected' {
  return socket?.connected ? 'connected' : 'disconnected';
}
