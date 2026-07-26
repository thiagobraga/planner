let unauthorizedHandler: (() => void) | null = null;

/**
 * Single point both the REST client (401 responses) and the socket
 * singleton (UNAUTHORIZED connect_error) report through, so AuthContext can
 * react to a dead session no matter which transport noticed first, without
 * client.ts and socket.ts importing each other.
 */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized(): void {
  unauthorizedHandler?.();
}
