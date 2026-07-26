import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

async function fetchVersion(): Promise<string | null> {
  try {
    const res = await fetch('/api/v1/version');
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.version === 'string' ? data.version : null;
  } catch {
    return null;
  }
}

/**
 * Compares the API's build version (BUILD_ID, stamped once per Docker image
 * build - see buildInfo.ts) against the version this tab loaded with. A
 * mismatch means a real deploy happened since, not just a container restart.
 * Auth here is a cookie-backed DB session (not client-held state), so
 * reloading is always safe - it doesn't sign the user out.
 */
export function useVersionCheck(): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const initialVersion = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const version = await fetchVersion();
      if (cancelled || version === null) return;
      if (initialVersion.current === null) {
        initialVersion.current = version;
        return;
      }
      if (version !== initialVersion.current) {
        setUpdateAvailable(true);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return updateAvailable;
}
