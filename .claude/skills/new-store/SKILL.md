---
name: new-store
description: Use when scaffolding a new Zustand store in app/src/stores/. Triggers: "add a store for X", "create XStore", any new cross-page client-side state not covered by taskStore or authStore.
---

# New Zustand Store

## Overview

Stores hold cross-page client-side state. Server-fetched lists belong in React Query + local page state (see InboxPage pattern). Stores are for UI state shared between pages or entities that need instant cross-tab updates via useSync.

## When Store vs React Query

| Use store                                  | Use React Query + page state        |
| ------------------------------------------ | ----------------------------------- |
| State used on 2+ pages                     | State used on 1 page only           |
| Mutations update via useSync               | Data refetched on navigate          |
| Entity is cross-cutting (labels, projects) | Entity is page-scoped (inbox tasks) |

## Template

`app/src/stores/$NAMEStore.ts`:

```ts
import { create } from 'zustand';

interface Item {
  id: string;
  // add fields
}

interface XState {
  items: Item[];
  setItems: (items: Item[]) => void;
  addItem: (item: Item) => void;
  updateItem: (id: string, patch: Partial<Item>) => void;
  removeItem: (id: string) => void;
}

export const useXStore = create<XState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  updateItem: (id, patch) =>
    set((s) => ({
      items: s.items.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    })),
  removeItem: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));
```

## Selectors

Derive computed values at call site - don't store derived state:

```ts
// In component
const completed = useXStore((s) => s.items.filter((x) => x.isCompleted));
const byId = useXStore((s) => s.items.find((x) => x.id === targetId));
```

## Connect to Sync

Instead of `invalidate()`, drive the store directly from `useSync`:

```ts
const { addItem, updateItem, removeItem } = useXStore();

useSync(
  useCallback(
    (event) => {
      if (event.entityType !== 'yourEntity') return;
      if (event.eventType === 'deleted') removeItem(event.entityId);
      else if (event.eventType === 'created') addItem(event.payload as Item);
      else updateItem(event.entityId, event.payload as Partial<Item>);
    },
    [addItem, updateItem, removeItem],
  ),
);
```

## With Persistence (optional)

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useXStore = create<XState>()(
  persist(
    (set) => ({
      /* same body */
    }),
    { name: 'planner-x-store' }, // localStorage key - must be unique across stores
  ),
);
```

Use persistence only for UI preferences, not server data.
