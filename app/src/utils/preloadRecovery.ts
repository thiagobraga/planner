const RELOAD_KEY = 'planner_preload_reload_at';
const RELOAD_WINDOW_MS = 10_000;

// A stale shell can reference hashed chunks pruned by a newer deploy. Reload
// once to pick up the fresh index.html; the window stops a reload loop.
export function installPreloadRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    try {
      const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
      if (Date.now() - last < RELOAD_WINDOW_MS) return;
      window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
      return;
    }
    window.location.reload();
  });
}
