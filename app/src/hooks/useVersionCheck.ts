import { useEffect, useState } from 'react';
import { getSocket } from '../utils/socket';

interface VersionResponse {
  current: string;
  latest: string;
}

/**
 * One listener for the whole app, at module scope rather than per hook
 * instance: the version is global state, so N mounts (plus StrictMode's
 * double mount in dev) must not mean N subscriptions.
 */
let initialVersion: string | null = null;
let updateAvailable = false;
let started = false;
const subscribers = new Set<(updateAvailable: boolean) => void>();

async function fetchVersion(): Promise<VersionResponse | null> {
  try {
    const res = await fetch('/api/v1/version', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.current === 'string' && typeof data.latest === 'string'
      ? { current: data.current, latest: data.latest }
      : null;
  } catch {
    return null;
  }
}

function checkLatest(latest: string): void {
  if (updateAvailable) return;
  if (initialVersion !== null && latest === initialVersion) return;
  updateAvailable = true;
  // Nothing left to learn - the banner is up and only a reload clears it.
  stopListening();
  for (const notify of subscribers) notify(true);
}

function onVersionPush(payload: { version: string }): void {
  checkLatest(payload.version);
}

async function fetchInitialVersion(): Promise<void> {
  const version = await fetchVersion();
  if (version === null) return;
  initialVersion = version.current;
  checkLatest(version.latest);
}

function startListening(): void {
  if (started || updateAvailable) return;
  started = true;
  getSocket().on('version', onVersionPush);
  void fetchInitialVersion();
}

function stopListening(): void {
  if (!started) return;
  started = false;
  getSocket().off('version', onVersionPush);
}

/**
 * Compares the version pushed by the server over the socket against the
 * version this tab initially loaded with. A mismatch means a real deploy
 * happened since, not just a container restart.
 * Auth here is a cookie-backed DB session (not client-held state), so
 * reloading is always safe - it doesn't sign the user out.
 */
export function useVersionCheck(): boolean {
  const [available, setAvailable] = useState(updateAvailable);

  useEffect(() => {
    subscribers.add(setAvailable);
    startListening();

    return () => {
      subscribers.delete(setAvailable);
      if (subscribers.size === 0) stopListening();
    };
  }, []);

  return available;
}
