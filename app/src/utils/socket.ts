import { io, Socket } from 'socket.io-client';
import { notifyUnauthorized } from './authEvents';

const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;

let socket: Socket | null = null;

// Whether the app wants a live socket right now. Every recovery path below is
// gated on this, so a socket closed deliberately (logout) is never resurrected.
let wantConnected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(): void {
  if (!wantConnected || reconnectTimer !== null) return;
  const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempts, RECONNECT_MAX_DELAY_MS);
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (wantConnected && !socket?.connected) {
      socket?.connect();
    }
  }, delay);
}

/**
 * Retry immediately, for the signals that mean "the user is back": regained
 * connectivity, a foregrounded tab, a page restored from bfcache. Background
 * tabs get their timers throttled, so socket.io's own backoff can be minutes
 * stale by the time anyone looks at the screen again.
 */
function reconnectNow(): void {
  if (!wantConnected || socket === null || socket.connected) return;
  clearReconnectTimer();
  reconnectAttempts = 0;
  socket.connect();
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      path: '/socket.io',
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 10_000,
    });

    // The server's `io.use` middleware (syncService.ts) only checks session
    // validity at connect time, so a session that dies while connected isn't
    // caught until the next reconnect attempt. socket.io-client can't tell an
    // auth rejection apart from a network hiccup and would otherwise retry
    // forever - stop it here and report the dead session the same way a 401
    // REST response would, instead of leaving the app stuck showing "Offline".
    socket.on('connect_error', (err) => {
      if (err.message === 'UNAUTHORIZED') {
        wantConnected = false;
        clearReconnectTimer();
        socket?.disconnect();
        notifyUnauthorized();
      }
    });

    socket.on('connect', () => {
      reconnectAttempts = 0;
      clearReconnectTimer();
    });

    // socket.io-client deliberately gives up for good when the *server* closed
    // the connection, and syncService.ts closes sockets exactly that way (the
    // 60s session revalidation sweep, the collection authorization guards). The
    // session is usually still fine, so retry here or the tab stays offline
    // until a manual reload - and if the session really is dead, the handshake
    // comes back UNAUTHORIZED above and logs the user out.
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        scheduleReconnect();
      }
    });

    window.addEventListener('online', reconnectNow);
    window.addEventListener('pageshow', reconnectNow);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) reconnectNow();
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
  wantConnected = true;
  reconnectAttempts = 0;
  clearReconnectTimer();
  getSocket().connect();
}

export function disconnectSocket(): void {
  wantConnected = false;
  clearReconnectTimer();
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
