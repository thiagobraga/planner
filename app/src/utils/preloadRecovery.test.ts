import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installPreloadRecovery } from './preloadRecovery';

describe('installPreloadRecovery', () => {
  const reload = vi.fn();

  beforeEach(() => {
    reload.mockClear();
    window.sessionStorage.clear();
    Object.defineProperty(window, 'location', { value: { reload }, configurable: true });
  });

  it('reloads once, then stops inside the loop window', () => {
    installPreloadRecovery();
    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
