import pool from "../db/pool.js";
import { recordActivity } from "./activityService.js";
import { buildEvent, publishEvent } from "./syncService.js";
import type { SyncEvent } from "../contracts/sync.js";
import type { Mutation } from "../types/mutation.js";

/**
 * Run a write on one pooled client inside BEGIN/COMMIT, with its activity in
 * the same transaction, and publish the queued sync events after COMMIT.
 *
 * Any error before COMMIT rolls everything back and publishes nothing. A
 * publish failure after COMMIT is logged and swallowed: the write stands, so
 * reporting it as an error would invite a retry that duplicates it.
 */
export async function runMutation<T>(work: (tx: Mutation) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  const events: SyncEvent[] = [];
  let broken = false;
  let result: T;
  try {
    await client.query("BEGIN");
    result = await work({
      client,
      recordActivity: (record) => recordActivity(client, record),
      // Built now so the event carries the request's source and actor.
      emit: (input) => { events.push(buildEvent(input)); },
    });
    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      broken = true;
    }
    throw err;
  } finally {
    // A client whose ROLLBACK failed may still hold the transaction; drop it.
    client.release(broken);
  }
  // Not awaited: node-redis queues commands while reconnecting, so awaiting
  // would let a Redis stall hang the response for a write that is already
  // committed. Issue order on the one pub connection keeps events in order.
  for (const event of events) {
    publishEvent(event).catch((err) => {
      console.error("[mutation] publish after commit failed; the write stands:", err);
    });
  }
  return result;
}
