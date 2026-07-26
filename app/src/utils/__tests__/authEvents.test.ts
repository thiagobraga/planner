import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setUnauthorizedHandler, notifyUnauthorized } from '../authEvents';

describe('authEvents', () => {
  beforeEach(() => {
    setUnauthorizedHandler(null);
  });

  it('invokes the registered handler', () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    notifyUnauthorized();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no handler is registered', () => {
    expect(() => notifyUnauthorized()).not.toThrow();
  });

  it('stops calling a handler once cleared', () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    setUnauthorizedHandler(null);

    notifyUnauthorized();

    expect(handler).not.toHaveBeenCalled();
  });

  it('only the most recently registered handler runs', () => {
    const first = vi.fn();
    const second = vi.fn();
    setUnauthorizedHandler(first);
    setUnauthorizedHandler(second);

    notifyUnauthorized();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
