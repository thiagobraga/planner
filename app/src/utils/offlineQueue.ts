import { getSyncStatus } from './socket';

const DB_NAME = 'planner-offline-queue';
const DB_VERSION = 2;
const STORE_NAME = 'mutations';

export type QueuedMutationMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface QueuedMutation {
  id: string;
  method: QueuedMutationMethod;
  path: string;
  body: string;
  createdAt: number;
  ownerUserId: string;
  /**
   * For a create-type mutation (POST with no id segment in its path), the
   * client-minted id synthesized as the optimistic response's `id` (see
   * `client.ts`'s `buildSyntheticResponse`). Once this mutation replays
   * successfully and the real server id is known, `remapQueuedId` uses this
   * to rewrite any not-yet-replayed queued mutation that referenced it.
   */
  clientEntityId?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('ownerUserId', 'ownerUserId', { unique: false });
        }
        if (event.oldVersion < 2 && db.objectStoreNames.contains(STORE_NAME)) {
          const store = request.transaction?.objectStore(STORE_NAME);
          if (store) {
            if (!store.indexNames.contains('ownerUserId')) {
              store.createIndex('ownerUserId', 'ownerUserId', { unique: false });
            }
            const cursorReq = store.openCursor();
            cursorReq.onsuccess = () => {
              const cursor = cursorReq.result;
              if (cursor) {
                const value = cursor.value as Partial<QueuedMutation>;
                if (!value.ownerUserId) {
                  store.delete(cursor.primaryKey);
                }
                cursor.continue();
              }
            };
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const req = run(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

function withStoreAndIndex<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, index: IDBIndex) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('ownerUserId');
        const req = run(store, index);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

let lastStamp = 0;
function nextStamp(): number {
  const now = Date.now();
  lastStamp = now > lastStamp ? now : lastStamp + 1;
  return lastStamp;
}

export async function enqueueMutation(op: {
  method: QueuedMutationMethod;
  path: string;
  body: string;
  ownerUserId: string;
  clientEntityId?: string;
}): Promise<string> {
  if (!op.ownerUserId) {
    throw new Error('Cannot enqueue mutation without an authenticated owner');
  }

  const id = crypto.randomUUID();
  const record: QueuedMutation = {
    id,
    method: op.method,
    path: op.path,
    body: op.body,
    createdAt: nextStamp(),
    ownerUserId: op.ownerUserId,
    ...(op.clientEntityId ? { clientEntityId: op.clientEntityId } : {}),
  };
  await withStore('readwrite', (store) => store.add(record));
  return id;
}

export async function getQueuedMutations(): Promise<QueuedMutation[]> {
  const all = await withStore<QueuedMutation[]>('readonly', (store) => store.getAll());
  return [...all].sort((a, b) => a.createdAt - b.createdAt);
}

export async function getQueuedMutationsForUser(ownerUserId: string): Promise<QueuedMutation[]> {
  const all = await withStoreAndIndex<QueuedMutation[]>('readonly', (_store, index) => {
    const req = index.getAll(ownerUserId);
    return req as unknown as IDBRequest<QueuedMutation[]>;
  });
  return [...all].sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeMutation(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
}

function remapPathId(path: string, oldId: string, newId: string): string {
  const segments = path.split('/');
  return segments.map((segment) => (segment === oldId ? newId : segment)).join('/');
}

const BODY_ID_FIELDS = ['parentTaskId'] as const;

function remapBodyId(body: string, oldId: string, newId: string): string {
  if (!body || !body.includes(oldId)) {
    return body;
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body);
  } catch {
    return body;
  }
  let changed = false;
  for (const field of BODY_ID_FIELDS) {
    if (parsed[field] === oldId) {
      parsed[field] = newId;
      changed = true;
    }
  }
  return changed ? JSON.stringify(parsed) : body;
}

export async function remapQueuedId(oldId: string, newId: string): Promise<void> {
  const mutations = await getQueuedMutations();
  for (const mutation of mutations) {
    const remappedPath = remapPathId(mutation.path, oldId, newId);
    const remappedBody = remapBodyId(mutation.body, oldId, newId);
    if (remappedPath !== mutation.path || remappedBody !== mutation.body) {
      const updated: QueuedMutation = { ...mutation, path: remappedPath, body: remappedBody };
      await withStore('readwrite', (store) => store.put(updated));
    }
  }
}

export async function clearUserMutations(ownerUserId: string): Promise<void> {
  const mutations = await getQueuedMutationsForUser(ownerUserId);
  await Promise.all(mutations.map((m) => removeMutation(m.id)));
}

export async function clearAllMutations(): Promise<void> {
  const all = await getQueuedMutations();
  await Promise.all(all.map((m) => removeMutation(m.id)));
}

export function isOnline(): boolean {
  return navigator.onLine && getSyncStatus() === 'connected';
}
