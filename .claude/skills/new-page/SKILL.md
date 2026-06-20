---
name: new-page
description: Use when scaffolding a new React page in app/src/pages/. Triggers: adding a new route view with task list, data fetching, or CRUD handlers for any entity.
---

# New Page

## Overview

Pages follow a strict pattern: useQuery → local state → 8 handlers with optimistic updates → TaskList render. Copy from `InboxPage.tsx` as the canonical model.

## Files to Touch

1. Create `app/src/pages/$NAMEPage.tsx`
2. Register route in `app/src/App.tsx` inside `<AppShell>` block (lines 23-31)

## Imports

```ts
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TaskList } from '../components/TaskList';
import { setPendingColumn } from '../components/TaskItem';
import type { Task } from '../components/TaskItem';
import { fetchXTasks, apiCreateTask, apiUpdateTask, apiToggleTask, apiDeleteTask, type ApiTask } from '../api/client';
import { clearToken } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
```

## Boilerplate

```ts
function apiToTask(t: ApiTask): Task {
  return { id: t.id, title: t.title, description: t.description, priority: t.priority,
    projectId: t.projectId, dueDate: t.dueDate ?? undefined,
    isCompleted: t.isCompleted, orderValue: t.orderValue, indent: t.depth ?? 0 };
}
let tempCounter = 0;
function tempId() { return `temp-${++tempCounter}`; }
```

## State

```ts
const qc = useQueryClient();
const { logout } = useAuth();
const [tasks, setTasks] = useState<Task[]>([]);
const [input, setInput] = useState('');
const [selectedId, setSelectedId] = useState<string | undefined>();
const [editingId, setEditingId] = useState<string | undefined>();
const inputRef = useRef<HTMLInputElement>(null);
const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ['pageKey'] }), [qc]);
```

## Data Fetching

```ts
const { data, error } = useQuery({ queryKey: ['pageKey'], queryFn: fetchXTasks, staleTime: 30_000 });
useEffect(() => { if (data?.tasks) setTasks(data.tasks.map(apiToTask)); }, [data]);
useEffect(() => { if (error && (error as Error).message?.includes('401')) { clearToken(); logout(); } }, [error, logout]);
```

## Handlers (8 required)

- **handleAddAtEnd** — `tempId()` → optimistic setState → `apiCreateTask` → swap id → revert on catch
- **handleAddBelow** — splice after index, `setEditingId(tid)` + `setSelectedId(tid)`
- **handleStartEdit** — set both `editingId` + `selectedId`
- **handleEditCommit** — if `id.startsWith('temp-')`: `apiCreateTask` then swap; else `apiUpdateTask`; empty title = delete
- **handleEditCancel** — `setEditingId(undefined)`; filter temp tasks from state
- **handleDelete** — filter from state, DOM focus fallback via `querySelectorAll('[data-task-id]')`, skip API on temp
- **handleIndent** — `Math.max(0, Math.min(4, indent + dir))`, `apiUpdateTask(id, { depth })`
- **handleNavigate** — `setPendingColumn(col)`, set `editingId`/`selectedId`; ArrowUp from input → last task

## JSX Structure

```tsx
<div style={{ maxWidth: '648px', cursor: 'text' }}>
  <h1 style={{ fontFamily: '"Lora", serif', fontSize: '18px', lineHeight: '24px', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>
    Page Title
  </h1>
  <div style={{ height: '24px' }} />
  <TaskList tasks={tasks} selectedTaskId={selectedId} editingId={editingId}
    onTaskClick={(id) => setSelectedId(id === selectedId ? undefined : id)}
    onTaskToggle={handleToggle} onReorder={setTasks}
    onStartEdit={handleStartEdit} onEditCommit={handleEditCommit}
    onEditCancel={handleEditCancel} onDelete={handleDelete}
    onAddBelow={handleAddBelow} onIndent={handleIndent} onNavigate={handleNavigate} />
  <form onSubmit={handleAddAtEnd} style={{ display: 'flex', alignItems: 'center', height: '24px' }}>
    <span style={{ width: '24px', textAlign: 'center', fontSize: '10px', color: 'var(--color-ink)', opacity: 0.25 }}>•</span>
    <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
      placeholder="Add task…" className="task-input task-add-input"
      style={{ flex: 1, fontSize: '14px', lineHeight: '24px', fontFamily: '"Lora", serif',
        color: 'var(--color-ink)', background: 'transparent', border: 'none', outline: 'none', padding: 0 }} />
  </form>
</div>
```

## Route Registration

```tsx
// app/src/App.tsx — inside <AppShell> block
import { XPage } from './pages/XPage';
<Route path="/x" element={<XPage />} />
```

## Design Checklist

- Lora serif everywhere — no sans-serif, no system-ui
- Colors: `var(--color-ink)`, `var(--color-ink-light)`, `var(--color-paper)` — never `#fff`/`#000`
- Brick-red (`var(--color-accent)`) ≤10% of surface area
- No `box-shadow` on non-overlay elements
- All heights/margins multiples of 24px (or 4px sub-steps)
