import { useEffect, useState } from 'react';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

// Floor between two opportunistic polls (tab refocused, connectivity back), so
// tab-switching in a burst can't turn into a request per switch.
const MIN_POLL_GAP_MS = 60 * 1000;

interface VersionResponse {
  current: string;
  latest: string;
}

/**
 * One poller for the whole app, at module scope rather than per hook instance:
 * the version is global state, so N mounts (plus StrictMode's double mount in
 * dev) must not mean N intervals and N requests.
 */
let initialVersion: string | null = null;
let updateAvailable = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let inFlight: Promise<void> | null = null;
let lastPollAt = 0;
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

function poll(): Promise<void> {
  // A hidden tab isn't going to act on the news, and an offline one can only
  // produce a failed request - both get picked up by the wake listeners below.
  if (updateAvailable || document.hidden || !navigator.onLine) return Promise.resolve();
  if (inFlight) return inFlight;

  lastPollAt = Date.now();
  inFlight = (async () => {
    const version = await fetchVersion();
    if (version === null) return;
    if (initialVersion === null) {
      initialVersion = version.current;
    }
    if (version.latest !== initialVersion) {
      updateAvailable = true;
      // Nothing left to learn - the banner is up and only a reload clears it.
      stopPolling();
      for (const notify of subscribers) notify(true);
    }
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

function pollIfStale(): void {
  if (Date.now() - lastPollAt < MIN_POLL_GAP_MS) return;
  void poll();
}

function onWake(): void {
  pollIfStale();
}

function onVisibilityChange(): void {
  if (!document.hidden) pollIfStale();
}

function startPolling(): void {
  if (intervalId !== null || updateAvailable) return;
  intervalId = setInterval(() => {
    void poll();
  }, POLL_INTERVAL_MS);
  window.addEventListener('online', onWake);
  document.addEventListener('visibilitychange', onVisibilityChange);
  pollIfStale();
}

function stopPolling(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  window.removeEventListener('online', onWake);
  document.removeEventListener('visibilitychange', onVisibilityChange);
}

/**
 * Compares the latest version advertised by the API against the version this
 * tab initially loaded with. A mismatch means a real deploy happened since,
 * not just a container restart.
 * Auth here is a cookie-backed DB session (not client-held state), so
 * reloading is always safe - it doesn't sign the user out.
 */
export function useVersionCheck(): boolean {
  const [available, setAvailable] = useState(updateAvailable);

  useEffect(() => {
    subscribers.add(setAvailable);
    startPolling();

    return () => {
      subscribers.delete(setAvailable);
      if (subscribers.size === 0) stopPolling();
    };
  }, []);

  return available;
}
