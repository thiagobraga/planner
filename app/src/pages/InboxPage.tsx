import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TaskList } from '../components/TaskList';
import { setPendingColumn } from '../components/TaskItem';
import type { Task } from '../components/TaskItem';
import {
  fetchInboxTasks,
  apiCreateTask,
  apiUpdateTask,
  apiToggleTask,
  apiDeleteTask,
  type ApiTask,
} from '../api/client';
import { clearToken } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { getPhrase } from '../utils/phrases';
import { useSync } from '../hooks/useSync';

function apiToTask(t: ApiTask): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    projectId: t.projectId,
    dueDate: t.dueDate ?? undefined,
    isCompleted: t.isCompleted,
    orderValue: t.orderValue,
    indent: t.depth ?? 0,
    type: t.type,
    createdAt: t.createdAt,
  };
}

let tempCounter = 0;
function tempId() { return `temp-${++tempCounter}`; }

export function InboxPage() {
  const qc = useQueryClient();
  const { logout } = useAuth();
  const phrase = useMemo(() => getPhrase('inbox'), []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [editingId, setEditingId] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { data, error } = useQuery({
    queryKey: ['inbox'],
    queryFn: fetchInboxTasks,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (data?.tasks) {
      setTasks(data.tasks.map(apiToTask));
    }
  }, [data]);

  // If 401, log out
  useEffect(() => {
    if (error && (error as Error).message?.includes('401')) {
      clearToken();
      logout();
    }
  }, [error, logout]);

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ['inbox'] }), [qc]);

  useSync(useCallback((event) => {
    if (event.entityType !== 'task') return;
    invalidate();
  }, [invalidate]));

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
    apiCreateTask({ title: trimmed, priority: 4 })
      .then((created) => {
        setTasks((prev) => prev.map((t) => (t.id === tid ? apiToTask(created) : t)));
      })
      .catch(() => {
        setTasks((prev) => prev.filter((t) => t.id !== tid));
        invalidate();
      });
  };

  const handleTaskClick = useCallback((id: string) => {
    setSelectedId((prev) => prev === id ? undefined : id);
  }, []);

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
    setSelectedId(tid);
  }, []);

  const handleStartEdit = useCallback((id: string) => {
    setEditingId(id);
    setSelectedId(id);
  }, []);

  const handleEditCommit = useCallback((id: string, title: string) => {
    const trimmed = title.trim();
    setEditingId(undefined);
    if (!trimmed) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (!id.startsWith('temp-')) apiDeleteTask(id).catch(() => invalidate());
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title: trimmed } : t)));
    if (id.startsWith('temp-')) {
      // was a new task — create it
      apiCreateTask({ title: trimmed, priority: 4 })
        .then((created) => {
          setTasks((prev) => prev.map((t) => (t.id === id ? apiToTask(created) : t)));
        })
        .catch(() => {
          setTasks((prev) => prev.filter((t) => t.id !== id));
        });
    } else {
      apiUpdateTask(id, { title: trimmed }).catch(() => invalidate());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEditCancel = useCallback((id: string) => {
    setEditingId(undefined);
    if (id.startsWith('temp-')) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  }, []);

  const handleDelete = useCallback((id: string) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      setTimeout(() => {
        const items = document.querySelectorAll<HTMLElement>('[data-task-id]');
        const target = items[Math.max(0, idx - 1)];
        if (target) target.focus();
        else document.querySelector<HTMLElement>('.task-add-input')?.focus();
      }, 0);
      return next;
    });
    setEditingId(undefined);
    setSelectedId(undefined);
    if (!id.startsWith('temp-')) apiDeleteTask(id).catch(() => invalidate());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleIndent = useCallback((id: string, dir: 1 | -1) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const newIndent = Math.max(0, Math.min(4, (t.indent ?? 0) + dir));
        if (!id.startsWith('temp-')) {
          apiUpdateTask(id, { depth: newIndent }).catch(() => invalidate());
        }
        return { ...t, indent: newIndent };
      }),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNavigate = useCallback((id: string, dir: 'up' | 'down', col: number) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
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
      setSelectedId(target.id);
      return prev;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = useCallback((id: string) => {
    const prevTasks = tasksRef.current;
    const task = prevTasks.find((t) => t.id === id);

    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t)),
    );

    if (task && !id.startsWith('temp-')) {
      apiToggleTask(id, !task.isCompleted).catch(() => invalidate());
    }
  }, [invalidate]);

  return (
    <div
      className="max-w-162 cursor-text"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, button, [role="button"]')) return;
        inputRef.current?.focus();
      }}
    >
      <header className="sticky-page-header">
        <h1 className="text-[18px] leading-6 h-6 font-semibold text-ink m-0 p-0">
          Inbox
        </h1>

        <p className="text-[13px] leading-6 h-6 text-ink-light opacity-60 m-0 p-0">
          {phrase}
        </p>
      </header>

      <div className="h-6" />

      <TaskList
        tasks={tasks}
        selectedTaskId={selectedId}
        editingId={editingId}
        onTaskClick={handleTaskClick}
        onTaskToggle={handleToggle}
        onReorder={setTasks}
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
          className="task-input task-add-input flex-1 text-[14px] leading-6 text-ink bg-transparent border-none outline-none p-0"
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
                setSelectedId(last.id);
                return prev;
              });
            }
          }}
        />
      </form>
    </div>
  );
}
