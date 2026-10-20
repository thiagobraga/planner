import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDebugStore, DEBUG_STORAGE_KEY, loadDebug } from '../debugStore.js';

describe('debugStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useDebugStore.setState({ enabled: false });
  });

  it('starts disabled', () => {
    expect(loadDebug()).toBe(false);
  });

  it('toggles on and off', () => {
    useDebugStore.getState().toggle();
    expect(useDebugStore.getState().enabled).toBe(true);
    useDebugStore.getState().toggle();
    expect(useDebugStore.getState().enabled).toBe(false);
  });

  it('persists the flag to localStorage', () => {
    useDebugStore.getState().toggle();
    expect(localStorage.getItem(DEBUG_STORAGE_KEY)).toBe('1');
    expect(loadDebug()).toBe(true);
    useDebugStore.getState().toggle();
    expect(localStorage.getItem(DEBUG_STORAGE_KEY)).toBeNull();
  });

  it('still toggles when storage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    useDebugStore.getState().toggle();
    expect(useDebugStore.getState().enabled).toBe(true);
    spy.mockRestore();
  });
});
