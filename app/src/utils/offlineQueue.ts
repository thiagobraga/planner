import { getSyncStatus } from './socket';

const DB_NAME = 'planner-offline-queue';
const DB_VERSION = 1;
const STORE_NAME = 'mutations';

export type QueuedMutationMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface QueuedMutation {
  id: string;
  method: QueuedMutationMethod;
  path: string;
  body: string;
  createdAt: number;
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

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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

/**
 * Strictly increasing enqueue stamps.
 *
 * Replay order is FIFO by `createdAt`, but `Date.now()` only has millisecond
 * resolution and several mutations can easily be queued inside one tick - a
 * task created and immediately dragged, for instance. Ties then fall back to
 * IndexedDB key order, which is a random UUID, so the move could replay before
 * the create it depends on and be addressed to a task the server has never
 * seen. Nudging the stamp forward on a tie keeps the sequence total.
 */
let lastStamp = 0;
function nextStamp(): number {
  const now = Date.now();
  lastStamp = now > lastStamp ? now : lastStamp + 1;
  return lastStamp;
}

/**
 * Queue a write-method REST call for replay once the app reconnects. Returns
 * the generated id of the queued record (not the eventual server id).
 */
export async function enqueueMutation(op: {
  method: QueuedMutationMethod;
  path: string;
  body: string;
  clientEntityId?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  const record: QueuedMutation = {
    id,
    method: op.method,
    path: op.path,
    body: op.body,
    createdAt: nextStamp(),
    ...(op.clientEntityId ? { clientEntityId: op.clientEntityId } : {}),
  };
  await withStore('readwrite', (store) => store.add(record));
  return id;
}

/** All queued mutations, FIFO (oldest first). */
export async function getQueuedMutations(): Promise<QueuedMutation[]> {
  const all = await withStore<QueuedMutation[]>('readonly', (store) => store.getAll());
  return [...all].sort((a, b) => a.createdAt - b.createdAt);
}

/** Remove a mutation from the queue after it has successfully replayed. */
export async function removeMutation(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
}

// Path segments are always `/<collection>/<id>[/<action>]` - matches an id
// that appears as its own path segment (bounded by `/` or end-of-string) so
// a substring match inside an unrelated segment can never accidentally hit.
function remapPathId(path: string, oldId: string, newId: string): string {
  const segments = path.split('/');
  return segments.map((segment) => (segment === oldId ? newId : segment)).join('/');
}

// Body field(s) that reference another entity's id and therefore need
// remapping when that entity was itself an offline-created record. Currently
// only `parentTaskId` (task-references-parent-task); extend here if other
// cross-entity id references are added to queued mutation bodies.
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

/**
 * Rewrites any not-yet-replayed queued mutation that references `oldId`
 * (a client-minted id from an offline create) so it instead targets `newId`
 * (the id the server actually assigned once that create replayed). Rewrites
 * both the `path` (e.g. `/tasks/<oldId>/complete` -> `/tasks/<newId>/complete`)
 * and known cross-entity id fields in the JSON `body` (e.g. `parentTaskId`).
 *
 * Updates records in place (rather than delete+re-add) so `createdAt`, and
 * therefore FIFO replay order, is preserved.
 */
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

/**
 * Module-level connectivity check for non-React modules (`client.ts` is not
 * a hook). Mirrors `useOnlineStatus`'s combined signal: online only when the
 * browser reports a network AND the sync socket is connected. There is no
 * cached/subscribed state here on purpose - each call reads the two sources
 * live, which is simpler than mirroring listeners and just as correct since
 * both `navigator.onLine` and `getSyncStatus()` are already backed by live
 * browser/socket state.
 */
export function isOnline(): boolean {
  return navigator.onLine && getSyncStatus() === 'connected';
}
