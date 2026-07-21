// Creates that have been sent but not yet answered, keyed by the temporary id
// the row carried while it was local-only.
//
// A child can be named and committed while its parent's own create is still in
// flight - the parent's id is still `temp-...`, which the server has never seen.
// Sending it would be rejected and cost the child its row. Waiting on the
// parent's create instead means the pair is written in the only order the
// server can accept: parent first, then child, addressed by the real id.

const pending = new Map<string, Promise<string>>();

/**
 * Register an in-flight create so children committed against its temporary id
 * can wait for the real one. Clears itself once settled, successfully or not.
 */
export function trackCreate(tempId: string, created: Promise<{ id: string }>): void {
  const realId = created.then((entity) => entity.id);
  pending.set(tempId, realId);
  realId
    .catch(() => undefined)
    .finally(() => {
      // Only if still ours: a later create against the same temp id wins.
      if (pending.get(tempId) === realId) pending.delete(tempId);
    });
}

/**
 * The server-side id for a parent reference, waiting for it if its create is
 * still in flight. A rejected parent create resolves to null rather than
 * throwing: the child then lands at the top level instead of vanishing.
 */
export async function resolveCreatedId(id: string | null): Promise<string | null> {
  if (!id) return null;
  const inFlight = pending.get(id);
  if (!inFlight) return id;
  return inFlight.catch(() => null);
}
