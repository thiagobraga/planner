import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useResolvedTheme } from '../useResolvedTheme';
import type { BackgroundPreference } from '../../types/theme';

type Listener = (e: MediaQueryListEvent) => void;

let matches: boolean;
let listeners: Set<Listener>;
const originalMatchMedia = window.matchMedia;

function setSystemDark(value: boolean) {
  matches = value;
  listeners.forEach((listener) => listener({ matches: value } as MediaQueryListEvent));
}

describe('useResolvedTheme', () => {
  beforeEach(() => {
    matches = false;
    listeners = new Set();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      get matches() { return matches; },
      media: query,
      addEventListener: (_: string, listener: Listener) => listeners.add(listener),
      removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('returns a fixed preference as-is', () => {
    matches = true;
    const { result } = renderHook(() => useResolvedTheme('white'));

    expect(result.current).toBe('white');
    expect(listeners.size).toBe(0);
  });

  it('follows the OS scheme when the preference is system', () => {
    matches = true;
    const { result } = renderHook(() => useResolvedTheme('system'));

    expect(result.current).toBe('dark');

    act(() => setSystemDark(false));
    expect(result.current).toBe('beige');
  });

  it('stops listening once the preference leaves system', () => {
    const { result, rerender } = renderHook(({ pref }) => useResolvedTheme(pref), {
      initialProps: { pref: 'system' as BackgroundPreference },
    });
    expect(listeners.size).toBe(1);

    rerender({ pref: 'dark' });

    expect(result.current).toBe('dark');
    expect(listeners.size).toBe(0);
  });
});
