import { getSyncStatus } from './socket';

const DB_NAME = 'planner-offline-queue';
const STORE_NAME = 'mutations';
const INDEX_NAME = 'ownerUserId';

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

function createSchema(db: IDBDatabase, tx: IDBTransaction | null): void {
  const store = db.objectStoreNames.contains(STORE_NAME)
    ? tx?.objectStore(STORE_NAME)
    : db.createObjectStore(STORE_NAME, { keyPath: 'id' });
  if (!store || store.indexNames.contains(INDEX_NAME)) {
    return;
  }
  store.createIndex(INDEX_NAME, INDEX_NAME, { unique: false });
  // Records written before the index existed carry no ownerUserId, so they can
  // never be matched to a user or replayed - drop them rather than leave them
  // stranded in the store forever.
  const cursorReq = store.openCursor();
  cursorReq.onsuccess = () => {
    const cursor = cursorReq.result;
    if (!cursor) {
      return;
    }
    const value = cursor.value as Partial<QueuedMutation>;
    if (!value.ownerUserId) {
      store.delete(cursor.primaryKey);
    }
    cursor.continue();
  };
}

function open(version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request =
      version === undefined ? indexedDB.open(DB_NAME) : indexedDB.open(DB_NAME, version);
    request.onupgradeneeded = () => createSchema(request.result, request.transaction);
    request.onsuccess = () => {
      const db = request.result;
      // Another tab upgrading or deleting the database blocks on every open
      // connection until it closes.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

function hasIndex(db: IDBDatabase): boolean {
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    return false;
  }
  try {
    return db
      .transaction(STORE_NAME, 'readonly')
      .objectStore(STORE_NAME)
      .indexNames.contains(INDEX_NAME);
  } catch {
    return false;
  }
}

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    // Opening without a version yields whatever already exists, which is what
    // makes a drifted database repairable: one that reached the current
    // version without the index can be detected here and upgraded past it,
    // since onupgradeneeded only fires when the version actually increases.
    dbPromise = open()
      .then((db) => {
        if (hasIndex(db)) {
          return db;
        }
        const next = db.version + 1;
        db.close();
        return open(next);
      })
      .catch((err) => {
        // If the repair upgrade itself fails (e.g. another tab holds an open
        // connection that blocks onversionchange), reset the cached promise so
        // the next call can retry instead of permanently caching the rejection.
        dbPromise = null;
        throw err;
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

/**
 * Query by ownerUserId using the index when available, falling back to a
 * full-store scan when the index is missing. This prevents NotFoundError
 * crashes in browsers holding a stale database version.
 */
function getByOwner(db: IDBDatabase, ownerUserId: string): Promise<QueuedMutation[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    let req: IDBRequest<QueuedMutation[]>;
    if (store.indexNames.contains(INDEX_NAME)) {
      req = store.index(INDEX_NAME).getAll(ownerUserId);
    } else {
      // Fallback: index unavailable — scan all records and filter in memory.
      req = store.getAll();
    }

    req.onsuccess = () => {
      const records = req.result;
      // When the index was available IDB already filtered; when it wasn't we
      // need to filter ourselves. Running the filter in both cases is harmless
      // and keeps the result deterministic.
      resolve(records.filter((m) => m.ownerUserId === ownerUserId));
    };
    req.onerror = () => reject(req.error);
  });
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
  const db = await openDB();
  const all = await getByOwner(db, ownerUserId);
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
