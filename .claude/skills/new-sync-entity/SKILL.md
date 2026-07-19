---
name: new-sync-entity
description: Use when adding a new entity type to the real-time sync pipeline. Triggers: "add sync for X", extending SyncEntityType, wiring a useSync handler for a new entity.
---

# New Sync Entity

## Overview

Every new entity that needs real-time updates touches **5 locations** in a fixed order. Missing any one breaks sync silently.

## Touch List (in order)

1. `api/src/services/syncService.ts` - extend `SyncEntityType`
2. `api/src/services/$NAMEService.ts` - call `publishEvent` after each mutation
3. `app/src/hooks/useSync.ts` - mirror the type extension
4. `app/src/pages/$NAMEPage.tsx` (or component) - add `useSync` handler
5. Verify both sides match

---

## Step 1 - Extend Backend Type

`api/src/services/syncService.ts` line 10:

```ts
// Before
export type SyncEntityType = 'task' | 'project' | 'section' | 'label' | 'comment' | 'reminder';

// After
export type SyncEntityType =
  | 'task'
  | 'project'
  | 'section'
  | 'label'
  | 'comment'
  | 'reminder'
  | 'yourEntity';
```

## Step 2 - Emit in Service

Call after every SQL INSERT / UPDATE / DELETE:

```ts
import { publishEvent, buildEvent } from './syncService.js';

publishEvent(
  buildEvent({
    entityType: 'yourEntity',
    eventType: 'created', // 'updated' | 'deleted' | 'completed' | 'uncompleted'
    entityId: row.id,
    userId,
    projectId: row.project_id ?? null, // null for user-owned entities
    payload: formattedRow,
  }),
).catch((err) => console.error('[sync] publish failed', err));
```

## Step 3 - Mirror Frontend Type

`app/src/hooks/useSync.ts`:

```ts
// Match the backend union exactly - string literals must be identical
export type SyncEntityType =
  | 'task'
  | 'project'
  | 'section'
  | 'label'
  | 'comment'
  | 'reminder'
  | 'yourEntity';
```

## Step 4 - Handle in Page/Component

```ts
const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ['yourKey'] }), [qc]);

useSync(
  useCallback(
    (event) => {
      if (event.entityType !== 'yourEntity') return;
      if (event.eventType === 'deleted') {
        setItems((prev) => prev.filter((x) => x.id !== event.entityId));
      } else {
        invalidate();
      }
    },
    [invalidate],
  ),
);
```

## SyncEvent Interface Reference

```ts
interface SyncEvent {
  id: string;
  entityType: SyncEntityType;
  eventType: SyncEventType; // "created" | "updated" | "deleted" | "completed" | "uncompleted"
  entityId: string;
  userId: string;
  projectId?: string | null;
  payload?: unknown;
  emittedAt: string;
}
```

## Verification

```bash
# Should appear in exactly syncService.ts + useSync.ts + your new service
grep -rn "yourEntity" api/src/ app/src/

# Run both test suites
docker compose exec api npm test && docker compose exec app npm test
```

## Common Mistakes

| Mistake                                              | Effect                                             |
| ---------------------------------------------------- | -------------------------------------------------- |
| Omit `projectId` on project-scoped entity            | Collaborators never receive the event              |
| String literal differs between backend/frontend      | TypeScript won't catch it; events silently ignored |
| Handler not wrapped in `useCallback`                 | New subscription on every render → memory leak     |
| Forget `publishEvent` on one mutation (e.g., delete) | Partial sync - other tabs stale after deletion     |
