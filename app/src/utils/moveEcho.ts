// Bookkeeping for structural moves that are still in flight.
//
// A move is broadcast to every session, including the one that made it. That
// echo is useless to the originator - it has already applied the move
// optimistically and is about to patch authoritative values from the response -
// and actively harmful, because handling it mid-flight refetches over the
// optimistic state and makes the row jump.
//
// So the originator registers the ids it is moving, ignores any event naming
// them, and unregisters once the request settles.

/** Ids currently being moved, ref-counted so overlapping moves cannot untrack early. */
const pending = new Map<string, number>();

/** An `updated` payload for a structural move carries the ids it disturbed. */
interface MovePayload {
  affectedIds?: string[];
}

export interface EchoableEvent {
  entityId: string;
  payload?: unknown;
}

/**
 * Register a move as in flight. Returns the function that clears it, which the
 * caller must run on success *and* failure - a move that is never cleared would
 * silently deafen the page to that row for the rest of the session.
 */
export function trackMove(ids: string[]): () => void {
  const tracked = [...new Set(ids)];
  for (const id of tracked) pending.set(id, (pending.get(id) ?? 0) + 1);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const id of tracked) {
      const remaining = (pending.get(id) ?? 1) - 1;
      if (remaining > 0) pending.set(id, remaining);
      else pending.delete(id);
    }
  };
}

/** True when this event is the echo of a move this session is still applying. */
export function isEchoedMove(event: EchoableEvent): boolean {
  if (pending.has(event.entityId)) return true;
  const affected = (event.payload as MovePayload | undefined)?.affectedIds;
  return Array.isArray(affected) && affected.some((id) => pending.has(id));
}

/**
 * True when this event describes a structural move rather than an edit.
 *
 * A move reorders and reparents rows the receiving page cannot patch in place -
 * it may have changed a task's day, collection or depth, and every sibling's
 * order alongside it - so the page must refetch rather than swap one row.
 */
export function isStructuralMove(event: EchoableEvent): boolean {
  return Array.isArray((event.payload as MovePayload | undefined)?.affectedIds);
}

/** Test seam: forget every tracked move. */
export function resetTrackedMoves(): void {
  pending.clear();
}
