import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { request } from '../client';
import { notifyUnauthorized } from '../../utils/authEvents';

vi.mock('../../utils/authEvents', () => ({
  notifyUnauthorized: vi.fn(),
}));

const fetchMock = vi.fn();
const mockNotifyUnauthorized = vi.mocked(notifyUnauthorized);

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  mockNotifyUnauthorized.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request() 401 handling', () => {
  it('reports a dead session on a 401 from a non-auth endpoint', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Session expired or revoked' } }),
    );

    await request('/tasks').catch(() => {});

    expect(mockNotifyUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not report a dead session on a 401 from /auth/login (wrong credentials)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }),
    );

    await request('/auth/login', { method: 'POST', body: '{}' }).catch(() => {});

    expect(mockNotifyUnauthorized).not.toHaveBeenCalled();
  });

  it('does not report a dead session on non-401 errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: { code: 'INTERNAL_ERROR', message: 'oops' } }));

    await request('/tasks').catch(() => {});

    expect(mockNotifyUnauthorized).not.toHaveBeenCalled();
  });

  it('does not report a dead session on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await request('/tasks');

    expect(mockNotifyUnauthorized).not.toHaveBeenCalled();
  });
});
