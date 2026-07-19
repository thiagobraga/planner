import { Fragment, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TaskList } from '../components/TaskList';
import { setPendingColumn } from '../components/TaskItem';
import type { Task } from '../components/TaskItem';
import {
  fetchCollectionView,
  apiCreateTask,
  apiUpdateTask,
  apiToggleTask,
  apiDeleteTask,
  type ApiTask,
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useTaskDrag } from '../hooks/useTaskDrag';
import { applyIndent, getParentCandidate } from '../utils/taskTree';
import { fetchCollections, paletteColorHex } from '../api/client';

function apiToTask(t: ApiTask): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    collectionId: t.collectionId,
    sectionId: t.sectionId,
    parentTaskId: t.parentTaskId ?? undefined,
    dueDate: t.dueDate ?? undefined,
    isCompleted: t.isCompleted,
    orderValue: t.orderValue,
    indent: t.depth ?? 0,
    type: t.type,
    // Siblings with equal order values fall back to creation time; without it
    // every tie resolves arbitrarily.
    createdAt: t.createdAt,
  };
}

let tempCounter = 0;
function tempId() { return `temp-${++tempCounter}`; }

export function CollectionsPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const { logout } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [id]);

  const { data, error } = useQuery({
    queryKey: ['collection', id],
    queryFn: () => fetchCollectionView(id),
    staleTime: 30_000,
    enabled: !!id,
  });

  useEffect(() => {
    if (data?.tasks) {
      setTasks(data.tasks.map(apiToTask));
    }
  }, [data]);

  // If 401, log out
  useEffect(() => {
    if (error && (error as Error).message?.includes('401')) {
      logout();
    }
  }, [error, logout]);

  const invalidate = useCallback(
    () => qc.invalidateQueries({ queryKey: ['collection', id] }),
    [qc, id],
  );

  const { activeDragId } = useTaskDrag({
    tasks,
    setTasks,
    scope: { kind: 'collection', collectionId: id },
    onError: invalidate,
    // A task can be dropped onto Inbox or another collection in the sidebar.
    onMoved: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['collection'] });
    },
  });

  const handleAddAtEnd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    const tid = tempId();
    setInput('');
    setTasks((prev) => [
      ...prev,
      { id: tid, title: trimmed, priority: 4, isCompleted: false, orderValue: prev.length + 1, type: 'task' },
    ]);
    apiCreateTask({ title: trimmed, priority: 4, collectionId: id })
      .then((created) => {
        setTasks((prev) => prev.map((t) => (t.id === tid ? apiToTask(created) : t)));
      })
      .catch(() => {
        setTasks((prev) => prev.filter((t) => t.id !== tid));
        invalidate();
      });
  };

  const handleAddBelow = useCallback((afterId: string) => {
    const tid = tempId();
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === afterId);
      const next = [...prev];
      next.splice(idx + 1, 0, {
        id: tid,
        title: '',
        priority: 4,
        isCompleted: false,
        orderValue: 0,
        indent: prev[idx]?.indent,
        type: 'task',
      });
      return next.map((t, i) => ({ ...t, orderValue: i + 1 }));
    });
    setEditingId(tid);
  }, []);

  const handleStartEdit = useCallback((taskId: string) => {
    setEditingId(taskId);
  }, []);

  const handleEditCommit = useCallback((taskId: string, title: string) => {
    const trimmed = title.trim();
    setEditingId(undefined);
    if (!trimmed) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (!taskId.startsWith('temp-')) apiDeleteTask(taskId).catch(() => invalidate());
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, title: trimmed } : t)));
    if (taskId.startsWith('temp-')) {
      let parentTaskId: string | undefined;
      const currentIndent = tasks.find((t) => t.id === taskId)?.indent ?? 0;
      if (currentIndent > 0) {
        const idx = tasks.findIndex((t) => t.id === taskId);
        parentTaskId = getParentCandidate(tasks, idx, currentIndent) ?? undefined;
      }
      apiCreateTask({ title: trimmed, priority: 4, collectionId: id, parentTaskId, depth: currentIndent })
        .then((created) => {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? apiToTask(created) : t)));
        })
        .catch(() => {
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
        });
    } else {
      apiUpdateTask(taskId, { title: trimmed }).catch(() => invalidate());
    }
  }, [id, tasks, invalidate]);
  const handleEditCancel = useCallback((taskId: string) => {
    setEditingId(undefined);
    if (taskId.startsWith('temp-')) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  }, []);

  const handleDelete = useCallback((taskId: string) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === taskId);
      const next = prev.filter((t) => t.id !== taskId);
      setTimeout(() => {
        const items = document.querySelectorAll<HTMLElement>('[data-task-id]');
        const target = items[Math.max(0, idx - 1)];
        if (target) target.focus();
        else document.querySelector<HTMLElement>('.task-add-input')?.focus();
      }, 0);
      return next;
    });
    setEditingId(undefined);
    if (!taskId.startsWith('temp-')) apiDeleteTask(taskId).catch(() => invalidate());
  }, []);
  const handleIndent = useCallback((taskId: string, dir: 1 | -1) => {
    setTasks((prev) => {
      const { tasks: next, parentTaskId, changed } = applyIndent(prev, taskId, dir);
      if (!changed) return prev;
      if (!taskId.startsWith('temp-')) {
        apiUpdateTask(taskId, { parentTaskId }).catch(() => invalidate());
      }
      return next;
    });
  }, []);
  const handleNavigate = useCallback((taskId: string, dir: 'up' | 'down', col: number) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === taskId);
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0) return prev;
      if (targetIdx >= prev.length) {
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
      return prev;
    });
  }, []);
  const handleToggle = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t)),
    );
    if (!taskId.startsWith('temp-')) {
      const task = tasks.find((t) => t.id === taskId);
      if (task) apiToggleTask(taskId, !task.isCompleted).catch(() => invalidate());
    }
  }, [tasks]);

  // Same query key the sidebar uses, so the ancestor lookup reads from a cache
  // that is already populated rather than refetching.
  const { data: collections = [] } = useQuery({ queryKey: ['collections'], queryFn: fetchCollections });

  // A sub-collection reads as a breadcrumb of its ancestors, so its place in the
  // tree is visible from the page itself. Falls back to the view payload when the
  // sidebar store has not loaded yet.
  const trail = useMemo(() => {
    const byId = new Map(collections.map((c) => [c.id, c]));
    const out: { id: string; name: string; color: string }[] = [];
    const seen = new Set<string>();

    let current = byId.get(id);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      out.unshift({ id: current.id, name: current.name, color: paletteColorHex(current.color) });
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }

    if (out.length > 0) return out;
    return data?.collection
      ? [{ id: data.collection.id, name: data.collection.name, color: paletteColorHex(data.collection.color) }]
      : [];
  }, [collections, id, data]);

  return (
    <div
      className="max-w-162 cursor-text"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, button, [role="button"]')) return;
        inputRef.current?.focus();
      }}
    >
      <h1 className="collections-page-title flex h-6 items-center gap-2 text-lg leading-6 font-semibold text-ink">
        {trail.map((crumb, i) => {
          const isCurrent = i === trail.length - 1;
          return (
            <Fragment key={crumb.id}>
              {i > 0 && (
                <span className="collections-page-title-separator font-normal text-ink-light opacity-50" aria-hidden="true">
                  /
                </span>
              )}
              <span className="collections-page-crumb flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: crumb.color }}
                />
                {isCurrent ? (
                  <span className="truncate">{crumb.name}</span>
                ) : (
                  <Link
                    to={`/collection/${crumb.id}`}
                    className="truncate text-ink-light transition-colors hover:text-ink"
                  >
                    {crumb.name}
                  </Link>
                )}
              </span>
            </Fragment>
          );
        })}
      </h1>

      <div className="h-6" />

      <TaskList
        tasks={tasks}
        containerId={`collection:${id}`}
        activeDragId={activeDragId}
        editingId={editingId}
        onTaskToggle={handleToggle}
        onStartEdit={handleStartEdit}
        onEditCommit={handleEditCommit}
        onEditCancel={handleEditCancel}
        onDelete={handleDelete}
        onAddBelow={handleAddBelow}
        onIndent={handleIndent}
        onNavigate={handleNavigate}
      />

      <form
        onSubmit={handleAddAtEnd}
        className="flex items-center h-6"
      >
        <span className="w-6 text-center text-[10px] leading-6 text-ink opacity-25 select-none shrink-0">
          •
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add task…"
          className="task-input task-add-input flex-1 text-sm leading-6 text-ink bg-transparent border-none outline-none p-0"
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setTasks((prev) => {
                if (prev.length === 0) return prev;
                const col = (e.target as HTMLInputElement).selectionStart ?? 0;
                const last = prev[prev.length - 1];
                setPendingColumn(col);
                setEditingId(last.id);
                return prev;
              });
            }
          }}
        />
      </form>
    </div>
  );
}
