# Phase 2 - Task Context Menu & Task Operations

**Status:** Ready for implementation  
**Dependencies:** Phase 1 (CustomSelect, ContextMenu components)  
**Estimated scope:** 3 modified files, 1 new file (API client additions)

## Context

This phase wires the ContextMenu component (from Phase 1) to TaskItem rows in the Daily page. Right-clicking a task opens a context menu with operations: Date, Priority, Project, Tags, Add above, Add below, and Delete.

Only Project, Add above/below, and Delete are functional in this phase. Date, Priority, and Tags appear as disabled/no-op items.

## Current Architecture

### Task ordering:

- Tasks have an `order_value INTEGER NOT NULL DEFAULT 0` column
- `reorderTask` service uses gap-based ordering: positions are multiples of 1000
- Daily view sorts by: `priority ASC, order_value ASC, created_at ASC`
- **Problem**: New tasks are created with `order_value = 0` (the default), meaning they all sort equally and fall back to `created_at` ordering
- The existing `reorderTask` works within project/section/parent scope, NOT within a day scope

### Project assignment:

- `updateTask` already supports `projectId` in the input - the backend is ready
- Frontend `apiUpdateTask` only sends `title | priority | dueDate | depth | type` - needs `projectId` added

### Task deletion:

- `deleteTask` and `apiDeleteTask` already exist and work
- DailyPage already has `handleDelete` that removes optimistically + calls API

### Add below:

- DailyPage already has `handleAddBelow(afterId)` that creates a temp task and enters edit mode
- But it doesn't persist `order_value` properly - just assigns sequential indices locally

## Proposed Changes

### Context Menu Integration in TaskItem/TaskList

#### [MODIFY] `app/src/components/TaskItem.tsx`

Add `onContextMenu` handler:

- Prevent native context menu (`e.preventDefault()`)
- Call new `onRightClick?(id, position)` callback with `{ x: e.clientX, y: e.clientY }`
- The parent component manages the context menu state

Add `onRightClick` to `TaskItemProps`:

```typescript
onRightClick?: (id: string, position: { x: number; y: number }) => void;
```

#### [MODIFY] `app/src/components/TaskList.tsx`

Pass `onRightClick` through to TaskItem.

#### [MODIFY] `app/src/pages/DailyPage.tsx`

Major additions:

1. **Context Menu State:**

```typescript
const [contextMenu, setContextMenu] = useState<{
  taskId: string;
  position: { x: number; y: number };
} | null>(null);
```

2. **Right-click handler:**

```typescript
const handleRightClick = useCallback((id: string, position: { x: number; y: number }) => {
  setSelectedId(id);
  setContextMenu({ taskId: id, position });
}, []);
```

3. **Context Menu rendering** using the ContextMenu component from Phase 1:

Menu structure (exact order):

```
Date          (disabled - no action)
Priority      (disabled - no action)
Project  →    (submenu: list of projects + "No project")
Tags          (disabled - no action)
──────────────
Add above
Add below
──────────────
Delete        (destructive style)
```

4. **Project submenu:**

- Fetch projects list (reuse existing `fetchProjects` from API client)
- Show each project with its color dot
- Include "No project" / move-to-Inbox option
- On select: call `apiUpdateTask(taskId, { projectId })` → update local state

5. **Add above handler:**

```typescript
const handleAddAbove = useCallback((beforeId: string) => {
  // Similar to handleAddBelow but inserts BEFORE the target task
  const tid = tempId();
  updateSections((prev) =>
    prev.map((s) => {
      const idx = s.tasks.findIndex((t) => t.id === beforeId);
      if (idx === -1) return s;
      const next = [...s.tasks];
      next.splice(idx, 0, { id: tid, title: '', ... });
      return { ...s, tasks: next.map((t, i) => ({ ...t, orderValue: i + 1 })) };
    })
  );
  setEditingId(tid);
  setSelectedId(tid);
}, [updateSections]);
```

6. **Order persistence:**
   After creating a task via "Add above" or "Add below", the task needs a proper `order_value`. Current flow:

- Optimistically assign sequential order values locally
- On API create: the server assigns `order_value = 0` (default)
- After create returns, call `reorderTask` to persist the position

Better approach: Extend `apiCreateTask` to accept an `orderValue` parameter, and update the backend `createTask` to honor it.

### API Client Extension

#### [MODIFY] `app/src/api/client.ts`

1. Add `projectId` to `apiUpdateTask` allowed fields:

```typescript
export async function apiUpdateTask(
  id: string,
  updates: Partial<Pick<ApiTask, 'title' | 'priority' | 'dueDate' | 'depth' | 'type' | 'projectId'>>,
): Promise<ApiTask> { ... }
```

2. Add `orderValue` to `apiCreateTask` input:

```typescript
export async function apiCreateTask(input: {
  title: string;
  priority?: number;
  projectId?: string;
  dueDate?: string;
  parentTaskId?: string;
  depth?: number;
  type?: 'task' | 'note';
  orderValue?: number;
}): Promise<ApiTask> { ... }
```

### Backend: Order Value on Create

#### [MODIFY] `api/src/services/taskService.ts`

In `createTask`, accept optional `orderValue` in `CreateTaskInput`:

```typescript
export interface CreateTaskInput {
  // ... existing fields
  orderValue?: number;
}
```

In the INSERT query, use `input.orderValue ?? 0` instead of relying on the DEFAULT.

### Order Value Calculation

When inserting a task above or below another task within a day:

1. Get the tasks in the current day section (sorted by order_value)
2. Calculate the new order_value:
   - **Add below task at index i**: midpoint between tasks[i].orderValue and tasks[i+1].orderValue (or tasks[i].orderValue + 1000 if last)
   - **Add above task at index i**: midpoint between tasks[i-1].orderValue and tasks[i].orderValue (or tasks[i].orderValue - 1000 if first)
3. If the gap is too small (< 2), trigger a full renumber of all tasks in that day

This midpoint-insertion approach avoids expensive reorder calls and is dnd-friendly.

### Fetching Projects for Submenu

Projects are already fetched and cached in the Sidebar component via `fetchProjects()`. To avoid duplicate fetches:

- Import and use `fetchProjects` directly in DailyPage
- Cache with a simple `useEffect` + `useState` or use React Query if available in the component

## Files Changed Summary

| File                              | Action | Description                                                 |
| --------------------------------- | ------ | ----------------------------------------------------------- |
| `app/src/components/TaskItem.tsx` | MODIFY | Add `onRightClick` prop + `onContextMenu` handler           |
| `app/src/components/TaskList.tsx` | MODIFY | Pass `onRightClick` through                                 |
| `app/src/pages/DailyPage.tsx`     | MODIFY | Context menu state, handlers, rendering, project assignment |
| `app/src/api/client.ts`           | MODIFY | Add `projectId` to updateTask, `orderValue` to createTask   |
| `api/src/services/taskService.ts` | MODIFY | Accept `orderValue` in createTask input                     |

## Reused Components & Patterns

- `ContextMenu` from Phase 1
- Existing `apiDeleteTask`, `apiUpdateTask`, `apiCreateTask`
- Existing `handleDelete`, `handleAddBelow` patterns in DailyPage
- `fetchProjects` from API client
- `projectColorHex` for rendering project color dots in submenu

## Risks & Considerations

- **Order value collisions**: When many tasks are inserted between the same two tasks, midpoint values will converge. Need a renumber strategy when gap < 2.
- **Project assignment sync**: Changing a task's project should trigger a sync event. The backend already handles this in `updateTask` → `publishEvent`.
- **Inbox fallback**: When removing a project from a task ("No project"), it should move to the user's Inbox project. The `createTask` service already defaults to Inbox, but `updateTask` with projectId=null is NOT currently supported. May need to handle this by explicitly passing the Inbox project ID.
- **Context menu on completed tasks**: Should still work - users may want to delete completed tasks.
- **Overdue tasks**: Context menu should work on overdue-day sections too.

## Tests

Create/update:

- `app/src/components/__tests__/TaskItem.test.tsx` - test onRightClick fires on contextmenu event
- Test order_value calculation: midpoint between two values
- Test add-above inserts at correct position
- Test add-below inserts at correct position
- Test project assignment updates task

## Verification

1. `cd app && npx tsc --noEmit` - TypeScript compiles
2. `pnpm lint` - no lint errors
3. `pnpm test` - all tests pass
4. Manual:
   - Right-click a task → menu appears at cursor position
   - Task becomes selected (highlighted)
   - Menu doesn't overflow viewport edges
   - "Add above" creates new task above, in edit mode
   - "Add below" creates new task below, in edit mode
   - Order persists after page reload
   - "Project" submenu shows all projects, selecting one updates the task
   - "Delete" removes the task
   - Date/Priority/Tags appear but do nothing on click
