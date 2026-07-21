import 'fake-indexeddb/auto';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

let mockConnected: boolean;

vi.mock('../../utils/socket', () => ({
  getSyncStatus: () => (mockConnected ? 'connected' : 'disconnected'),
  getSocketId: () => 'socket-test',
}));

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
}

describe('client offline integration', () => {
  const originalFetch = global.fetch;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    mockConnected = true;
    setNavigatorOnLine(true);

    fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    // Set a current user so offline enqueues work
    const { setCurrentUserId } = await import('../client');
    setCurrentUserId('test-user');

    // Drain the queue between tests (shared fake-indexeddb instance).
    const { getQueuedMutations, removeMutation } = await import('../../utils/offlineQueue');
    const existing = await getQueuedMutations();
    for (const m of existing) {
      await removeMutation(m.id);
    }
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('queues apiCreateTask in IndexedDB and resolves synthetically instead of calling fetch, while offline', async () => {
    mockConnected = false;
    setNavigatorOnLine(false);

    const { apiCreateTask } = await import('../client');
    const { getQueuedMutations } = await import('../../utils/offlineQueue');

    const result = await apiCreateTask({ title: 'buy milk', priority: 4 });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.title).toBe('buy milk');
    expect(result.priority).toBe(4);
    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);

    const queued = await getQueuedMutations();
    expect(queued).toHaveLength(1);
    expect(queued[0].method).toBe('POST');
    expect(queued[0].path).toBe('/tasks');
    expect(JSON.parse(queued[0].body)).toMatchObject({ title: 'buy milk', priority: 4 });
  });

  it('calls the real fetch (no queueing) for apiCreateTask while online', async () => {
    mockConnected = true;
    setNavigatorOnLine(true);
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'server-id', title: 'buy milk', priority: 4 }),
    });

    const { apiCreateTask } = await import('../client');
    const { getQueuedMutations } = await import('../../utils/offlineQueue');

    const result = await apiCreateTask({ title: 'buy milk', priority: 4 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('server-id');
    expect(await getQueuedMutations()).toHaveLength(0);
  });

  it('echoes the :id from the path (not the trailing sub-resource segment) for offline PATCH/PUT calls', async () => {
    mockConnected = false;
    setNavigatorOnLine(false);

    const { apiUpdateTask, apiToggleHabitCompletion } = await import('../client');

    const updated = await apiUpdateTask('task-123', { title: 'renamed' });
    expect(updated.id).toBe('task-123');
    expect(updated.title).toBe('renamed');

    // PUT /habits/:id/completions - the trailing "completions" segment must
    // never be mistaken for the id.
    const completion = await apiToggleHabitCompletion('habit-456', '2026-07-15', true);
    expect((completion as { id?: string }).id).toBe('habit-456');
  });

  it('never queues /auth/* calls, even while offline (login must always hit the real network)', async () => {
    mockConnected = false;
    setNavigatorOnLine(false);
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: 'u1', email: 'a@b.com', displayName: 'A' }, token: 't' }),
    });

    const { apiLogin } = await import('../client');
    const { getQueuedMutations } = await import('../../utils/offlineQueue');

    await apiLogin('a@b.com', 'password');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(await getQueuedMutations()).toHaveLength(0);
  });
});
