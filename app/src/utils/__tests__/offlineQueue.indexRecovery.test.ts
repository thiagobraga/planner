import 'fake-indexeddb/auto';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../socket', () => ({
  getSyncStatus: () => 'connected',
}));

const DB_NAME = 'planner-offline-queue';
const STORE_NAME = 'mutations';

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

/**
 * Recreates the state that produced `NotFoundError` in the wild: a database
 * sitting at a given version with the store present but the `ownerUserId`
 * index missing, as left behind by a build that bumped the version before the
 * index-creation code existed.
 */
function seedDatabaseWithoutIndex(version: number, records: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, version);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (records.length === 0) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const record of records) {
        store.add(record);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

function readVersion(): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => {
      const { version } = request.result;
      request.result.close();
      resolve(version);
    };
    request.onerror = () => reject(request.error);
  });
}

describe('offlineQueue index recovery', () => {
  beforeEach(async () => {
    vi.resetModules();
    await deleteDatabase();
  });

  it('reads queued mutations from a database left at the current version without the index', async () => {
    await seedDatabaseWithoutIndex(3, [
      {
        id: 'a',
        method: 'POST',
        path: '/tasks',
        body: '{}',
        createdAt: 1,
        ownerUserId: 'user-1',
      },
    ]);

    const { getQueuedMutationsForUser } = await import('../offlineQueue');

    const queued = await getQueuedMutationsForUser('user-1');
    expect(queued.map((m) => m.id)).toEqual(['a']);
  });

  it('creates the index by upgrading past the drifted version', async () => {
    await seedDatabaseWithoutIndex(3);

    const { getQueuedMutationsForUser } = await import('../offlineQueue');
    await getQueuedMutationsForUser('user-1');

    expect(await readVersion()).toBeGreaterThan(3);
  });

  it('drops records that predate the ownerUserId index instead of stranding them', async () => {
    await seedDatabaseWithoutIndex(3, [
      { id: 'orphan', method: 'POST', path: '/tasks', body: '{}', createdAt: 1 },
      {
        id: 'owned',
        method: 'POST',
        path: '/tasks',
        body: '{}',
        createdAt: 2,
        ownerUserId: 'user-1',
      },
    ]);

    const { getQueuedMutations } = await import('../offlineQueue');

    const all = await getQueuedMutations();
    expect(all.map((m) => m.id)).toEqual(['owned']);
  });

  it('still serves a database that already has the index, without upgrading it', async () => {
    const { enqueueMutation } = await import('../offlineQueue');
    await enqueueMutation({
      method: 'POST',
      path: '/tasks',
      body: '{}',
      ownerUserId: 'user-1',
    });
    const versionAfterFirstOpen = await readVersion();

    vi.resetModules();
    const { getQueuedMutationsForUser } = await import('../offlineQueue');
    const queued = await getQueuedMutationsForUser('user-1');

    expect(queued).toHaveLength(1);
    expect(await readVersion()).toBe(versionAfterFirstOpen);
  });
});
