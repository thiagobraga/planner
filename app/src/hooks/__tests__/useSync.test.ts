import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

let mockOn: ReturnType<typeof vi.fn>;
let mockOff: ReturnType<typeof vi.fn>;

vi.mock('../../utils/socket', () => ({
  getSocket: () => ({ on: mockOn, off: mockOff, connected: true }),
}));

import { useSync } from '../useSync';

describe('useSync', () => {
  beforeEach(() => {
    mockOn = vi.fn();
    mockOff = vi.fn();
  });

  it('subscribes handler to sync event on mount', () => {
    const handler = vi.fn();
    renderHook(() => useSync(handler));
    expect(mockOn).toHaveBeenCalledWith('sync', handler);
  });

  it('unsubscribes handler on unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useSync(handler));
    unmount();
    expect(mockOff).toHaveBeenCalledWith('sync', handler);
  });
});
