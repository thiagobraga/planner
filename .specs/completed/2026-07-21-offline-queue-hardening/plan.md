# Offline Queue Hardening

## Summary
Fix the IndexedDB replay crash caused by a missing `ownerUserId` index in the offline queue database. Replay should recover from stale browser storage instead of throwing.

## Requirements
- `getQueuedMutationsForUser()` must not crash if the index is missing.
- Fallback behavior should scan the store and filter by `ownerUserId`.
- FIFO ordering must still be preserved.
- The database should still repair or recreate the index when possible.

## Implementation
- Update `app/src/utils/offlineQueue.ts` to guard the indexed lookup.
- Add a fallback path that reads all records and filters by `ownerUserId`.
- Keep sorting behavior identical after fallback filtering.
- Strengthen the upgrade or repair path so stale databases recover cleanly.

## Risks
- A fallback scan could be slower on very large queues, so it should only run when the index is unavailable.
- A repair path that is too aggressive could accidentally drop valid queued mutations.

## Verification
- Add a regression test for a missing `ownerUserId` index.
- Confirm replay still returns records in FIFO order.
- Confirm the crash is gone in the offline replay path.

