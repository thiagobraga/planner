import type { PoolClient } from "pg";
import type { SyncEvent } from "../contracts/sync.js";
import type { ActivityRecord } from "./activity.js";

/** What a service hands to buildEvent: id, time, source and actor are filled in. */
export type SyncEventInput = Omit<SyncEvent, "id" | "emittedAt"> & { id?: string };

/** The handle a mutation callback works through, bound to one open transaction. */
export interface Mutation {
  client: PoolClient;
  recordActivity(record: ActivityRecord): Promise<void>;
  /** Queue an event; it is published only once the transaction commits. */
  emit(event: SyncEventInput): void;
}
