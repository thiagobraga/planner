import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMidnightTimer } from '../useMidnightTimer';

describe('useMidnightTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers callback when midnight arrives', () => {
    const callback = vi.fn();
    const baseDate = new Date('2026-07-26T23:59:50.000Z');
    vi.setSystemTime(baseDate);

    renderHook(() => useMidnightTimer(callback, 'UTC'));

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10000);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('clears timer on unmount', () => {
    const callback = vi.fn();
    const baseDate = new Date('2026-07-26T23:59:50.000Z');
    vi.setSystemTime(baseDate);

    const { unmount } = renderHook(() => useMidnightTimer(callback, 'UTC'));

    unmount();

    vi.advanceTimersByTime(10000);
    expect(callback).not.toHaveBeenCalled();
  });
});
