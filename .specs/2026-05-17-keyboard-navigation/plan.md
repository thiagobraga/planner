# Keyboard Navigation — Column-Preserving Up/Down Between Tasks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When editing any task or the "Add task" input, pressing Up/Down moves focus directly into the adjacent task's edit mode with the cursor at the same character column.

**Architecture:** Add `onNavigate(id, dir, col)` callback to `TaskItem` → `InboxPage` handles it by setting `editingId` to the target task and storing a pending cursor column in a module-level variable; each `TaskItem`'s `useEffect([isEditing])` consumes the pending column on focus. No new files needed.

**Tech Stack:** React 18 (state batching), TypeScript, `<input type="text">` (uncontrolled via `defaultValue`)

---

## Current Behavior (what changes)

- ArrowUp/Down while editing → commits task → focuses the task **row div** (not edit mode)
- ArrowUp from add-task input → focuses the last task **row div** (not edit mode)
- No column preservation anywhere

## Target Behavior

- ArrowUp/Down while editing → commits task → opens adjacent task **directly in edit mode** with cursor at same column (clamped to title length)
- ArrowDown from last task → focuses add-task input with cursor at same column
- ArrowUp from add-task input → opens last task in edit mode with cursor at same column

---

## Files

- Modify: `app/src/components/TaskItem.tsx` — add `onNavigate` prop, module-level pending column, update `handleEditKeyDown` and `useEffect([isEditing])`
- Modify: `app/src/components/TaskList.tsx` — add `onNavigate` to `TaskCallbacks` pick and pass through
- Modify: `app/src/pages/InboxPage.tsx` — add `handleNavigate`, update add-task `onKeyDown`, pass `onNavigate` to `TaskList`

---

### Task 1: Add `onNavigate` prop to `TaskItem` and wire through `TaskList`

**Files:**
- Modify: `app/src/components/TaskItem.tsx:20-32`
- Modify: `app/src/components/TaskList.tsx:18-21`

- [ ] **Step 1: Add prop to `TaskItemProps`**

In `TaskItem.tsx`, add to the `TaskItemProps` interface after `onIndent`:

```ts
onNavigate?: (id: string, dir: 'up' | 'down', col: number) => void;
```

- [ ] **Step 2: Add to destructure in `TaskItem` function signature**

After `onIndent,` in the destructure:

```ts
onNavigate,
```

- [ ] **Step 3: Add to `TaskCallbacks` pick in `TaskList.tsx`**

Change:
```ts
type TaskCallbacks = Pick<
  TaskItemProps,
  'onStartEdit' | 'onEditCommit' | 'onEditCancel' | 'onDelete' | 'onAddBelow' | 'onIndent'
>;
```
To:
```ts
type TaskCallbacks = Pick<
  TaskItemProps,
  'onStartEdit' | 'onEditCommit' | 'onEditCancel' | 'onDelete' | 'onAddBelow' | 'onIndent' | 'onNavigate'
>;
```

- [ ] **Step 4: Pass `onNavigate` through in `TaskList` JSX**

In the `<TaskItem>` render inside `TaskList`, add:
```tsx
onNavigate={onNavigate}
```

- [ ] **Step 5: Add `onNavigate` to `TaskList` destructure**

In `TaskList` function params, add `onNavigate,` alongside the other callbacks.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /p/projects/planner/app && npx tsc --noEmit
```
Expected: 0 errors (onNavigate is optional so no call sites need updating yet)

- [ ] **Step 7: Commit**

```bash
git add app/src/components/TaskItem.tsx app/src/components/TaskList.tsx
git commit -m "feat: add onNavigate prop to TaskItem and TaskList"
```

---

### Task 2: Module-level pending column + update `TaskItem` handlers

**Files:**
- Modify: `app/src/components/TaskItem.tsx`

- [ ] **Step 1: Add module-level pending column state**

After the imports at the top of `TaskItem.tsx`, before the `Task` interface, add:

```ts
let _pendingCol: number | null = null;
export function setPendingColumn(col: number | null): void { _pendingCol = col; }
function consumePendingColumn(): number | null { const c = _pendingCol; _pendingCol = null; return c; }
```

- [ ] **Step 2: Update `useEffect([isEditing])` to consume pending column**

Replace lines 88–95:
```ts
useEffect(() => {
  if (isEditing) {
    editRef.current?.focus();
    // place cursor at end
    const len = editRef.current?.value.length ?? 0;
    editRef.current?.setSelectionRange(len, len);
  }
}, [isEditing]);
```
With:
```ts
useEffect(() => {
  if (isEditing && editRef.current) {
    editRef.current.focus();
    const pending = consumePendingColumn();
    const len = editRef.current.value.length;
    const col = pending !== null ? Math.min(pending, len) : len;
    editRef.current.setSelectionRange(col, col);
  }
}, [isEditing]);
```

- [ ] **Step 3: Update `handleEditKeyDown` ArrowUp/Down cases**

Replace lines 153–163:
```ts
} else if (e.key === 'ArrowDown') {
  e.preventDefault();
  committedRef.current = true;
  onEditCommit?.(task.id, e.currentTarget.value);
  setTimeout(() => focusAdjacent(task.id, 'down'), 0);
} else if (e.key === 'ArrowUp') {
  e.preventDefault();
  committedRef.current = true;
  onEditCommit?.(task.id, e.currentTarget.value);
  setTimeout(() => focusAdjacent(task.id, 'up'), 0);
}
```
With:
```ts
} else if (e.key === 'ArrowDown') {
  e.preventDefault();
  const col = e.currentTarget.selectionStart ?? 0;
  committedRef.current = true;
  onEditCommit?.(task.id, e.currentTarget.value);
  onNavigate?.(task.id, 'down', col);
} else if (e.key === 'ArrowUp') {
  e.preventDefault();
  const col = e.currentTarget.selectionStart ?? 0;
  committedRef.current = true;
  onEditCommit?.(task.id, e.currentTarget.value);
  onNavigate?.(task.id, 'up', col);
}
```

Note: `focusAdjacent` function can remain — it's still used by the non-editing row key handler. No need to delete it.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /p/projects/planner/app && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add app/src/components/TaskItem.tsx
git commit -m "feat: column-preserving cursor on task edit navigation"
```

---

### Task 3: Wire `handleNavigate` in `InboxPage`

**Files:**
- Modify: `app/src/pages/InboxPage.tsx`

- [ ] **Step 1: Import `setPendingColumn`**

Add to the import from `../components/TaskItem`:
```ts
import { setPendingColumn } from '../components/TaskItem';
```

Existing import is:
```ts
import type { Task } from '../components/TaskItem';
```
Change to:
```ts
import { setPendingColumn } from '../components/TaskItem';
import type { Task } from '../components/TaskItem';
```

- [ ] **Step 2: Add `handleNavigate` function**

Add after `handleIndent` (around line 172), before `handleToggle`:

```ts
const handleNavigate = useCallback((id: string, dir: 'up' | 'down', col: number) => {
  setTasks((prev) => {
    const idx = prev.findIndex((t) => t.id === id);
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0) return prev; // already at top, no-op

    if (targetIdx >= prev.length) {
      // past last task — go to add-task input
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const clamped = Math.min(col, inputRef.current.value.length);
          inputRef.current.setSelectionRange(clamped, clamped);
        }
      });
      return prev;
    }

    const target = prev[targetIdx];
    setPendingColumn(col);
    setEditingId(target.id);
    setSelectedId(target.id);
    return prev;
  });
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Pass `onNavigate` to `TaskList`**

In the `<TaskList>` JSX (around line 223), add:
```tsx
onNavigate={handleNavigate}
```

- [ ] **Step 4: Update add-task input ArrowUp handler**

Replace the existing `onKeyDown` on the add-task `<input>` (lines 264–269):
```tsx
onKeyDown={(e) => {
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    const items = document.querySelectorAll<HTMLElement>('[data-task-id]');
    items[items.length - 1]?.focus();
  }
}}
```
With:
```tsx
onKeyDown={(e) => {
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    setTasks((prev) => {
      if (prev.length === 0) return prev;
      const col = (e.target as HTMLInputElement).selectionStart ?? 0;
      const last = prev[prev.length - 1];
      setPendingColumn(col);
      setEditingId(last.id);
      setSelectedId(last.id);
      return prev;
    });
  }
}}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /p/projects/planner/app && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add app/src/pages/InboxPage.tsx
git commit -m "feat: wire column-preserving task navigation in InboxPage"
```

---

## Verification

Start the dev server:
```bash
cd /p/projects/planner && docker compose up -d && cd app && npm run dev
```

**Test 1 — Down into next task at same column:**
1. Click a task with a long title to start editing (Shift+Enter or click)
2. Move cursor to position 3 (press Home, then Right×3)
3. Press ArrowDown
4. Expected: next task is now in edit mode, cursor at position 3 (or end if next title is shorter than 3 chars)

**Test 2 — Up into previous task at same column:**
1. Edit a task, cursor at position 5
2. Press ArrowUp
3. Expected: previous task in edit mode, cursor at position 5 (or end if title shorter)

**Test 3 — ArrowDown from last task goes to add-task input at same column:**
1. Edit the last task, cursor at position 2
2. Press ArrowDown
3. Expected: add-task input focused, cursor at position 2 (or end if add-task input text is shorter)

**Test 4 — ArrowUp from add-task input goes to last task in edit mode:**
1. Click the add-task input, type a few chars, move cursor to position 1
2. Press ArrowUp
3. Expected: last task is now in edit mode, cursor at position 1 (or clamped)

**Test 5 — ArrowUp from first task = no-op:**
1. Edit the first task
2. Press ArrowUp
3. Expected: nothing happens (cursor stays in first task's edit input)

**Test 6 — Existing behavior intact:**
- Enter still commits + adds blank task below
- Escape still cancels edit
- Shift+Enter still starts editing a selected row
- Tab/Shift+Tab still indents
- Row-level ArrowUp/Down (when not editing) still navigates rows without entering edit mode
