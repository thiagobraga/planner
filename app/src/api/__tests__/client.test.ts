import 'fake-indexeddb/auto';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const offlineMocks = vi.hoisted(() => ({
  enqueue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils/offlineQueue', () => ({
  isOnline: () => false,
  enqueueMutation: offlineMocks.enqueue,
}));

vi.mock('../../utils/socket', () => ({
  getSocketId: () => undefined,
}));

vi.mock('../../utils/authEvents', () => ({
  notifyUnauthorized: () => {},
}));

describe('api client unit tests', () => {
  beforeEach(() => {
    offlineMocks.enqueue.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
    Object.defineProperty(document, 'cookie', { value: '', configurable: true });
    vi.unstubAllGlobals();
  });

  it('ApiError.fieldErrors narrows details to ValidationDetail[]', async () => {
    const { ApiError } = await import('../client');
    const err = new ApiError({
      message: 'bad',
      code: 'VALIDATION',
      status: 400,
      details: [{ field: 'email', message: 'invalid' }, { nope: true }],
    });

    const fields = err.fieldErrors();
    expect(fields).toEqual([{ field: 'email', message: 'invalid' }]);
  });

  it('includes X-XSRF-TOKEN and X-Socket-Id headers when present', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    Object.defineProperty(document, 'cookie', { value: 'planner_csrf=tok123:meta', configurable: true });

    const { request } = await import('../client');

    await request('/views/today');

    expect(fetchMock).toHaveBeenCalled();
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers['X-XSRF-TOKEN']).toBe('tok123');
  });

  it('queues DELETE calls when offline and returns undefined', async () => {
    const { setCurrentUserId, apiDeleteTask } = await import('../client');
    setCurrentUserId('u-9');

    const res = await apiDeleteTask('t-9');
    expect(res).toBeUndefined();
    expect(offlineMocks.enqueue).toHaveBeenCalledTimes(1);
    expect(offlineMocks.enqueue.mock.calls[0][0]).toMatchObject({ method: 'DELETE', path: '/tasks/t-9', ownerUserId: 'u-9' });
  });

  it('returns client-provided id for offline POST create', async () => {
    const { setCurrentUserId, apiCreateTask } = await import('../client');
    setCurrentUserId('u-10');

    const task = await apiCreateTask({ id: 'cli-1', title: 'x', priority: 1 });
    expect(task.id).toBe('cli-1');
    expect(offlineMocks.enqueue).toHaveBeenCalled();
    const queued = offlineMocks.enqueue.mock.calls[0][0];
    expect(queued.path).toBe('/tasks');
    expect(JSON.parse(queued.body)).toMatchObject({ id: 'cli-1', title: 'x' });
  });

  it('setCurrentUserId and getCurrentUserId work', async () => {
    const { setCurrentUserId, getCurrentUserId } = await import('../client');
    setCurrentUserId('me');
    expect(getCurrentUserId()).toBe('me');
    setCurrentUserId(null);
    expect(getCurrentUserId()).toBeNull();
  });
});