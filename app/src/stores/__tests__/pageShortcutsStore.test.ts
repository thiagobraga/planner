import { describe, expect, it, vi } from 'vitest';
import { runPageShortcut, usePageShortcutsStore } from '../pageShortcutsStore';

describe('pageShortcutsStore', () => {
  it('runs the handler the current page registered, and nothing once it leaves', () => {
    const handler = vi.fn();
    const release = usePageShortcutsStore.getState().register(handler);
    runPageShortcut('view:style');
    expect(handler).toHaveBeenCalledWith('view:style');
    release();
    runPageShortcut('view:style');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('keeps the newer page when an older one releases late', () => {
    const older = vi.fn();
    const newer = vi.fn();
    const releaseOlder = usePageShortcutsStore.getState().register(older);
    usePageShortcutsStore.getState().register(newer);
    releaseOlder();
    runPageShortcut('view:today');
    expect(newer).toHaveBeenCalledWith('view:today');
    expect(older).not.toHaveBeenCalled();
  });
});
