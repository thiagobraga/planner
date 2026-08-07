// TODO: implement unit tests for app/src/api/client.ts
// Planned tests:
// - enqueue/synthetic response when offline and POST create (mock isOnline/enqueueMutation)
// - ApiError thrown on non-ok response; notifyUnauthorized called on 401 (mock global.fetch)
// - XSRF header included when cookie present (mock document.cookie)

import { describe, it, expect } from 'vitest';

describe('client.ts (placeholder)', () => {
  it('placeholder: tests to be implemented in feat/full-coverage-tests worktree', () => {
    expect(true).toBe(true);
  });
});
