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

  const handleAddAtEnd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    const tid = tempId();
    setInput('');
    setTasks((prev) => [
      ...prev,
      { id: tid, title: trimmed, priority: 4, isCompleted: false, orderValue: prev.length + 1 },
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
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t)),
    );
    if (!id.startsWith('temp-')) {
      const task = tasks.find((t) => t.id === id);
      if (task) apiToggleTask(id, !task.isCompleted).catch(() => invalidate());
    }
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{ maxWidth: '648px', cursor: 'text' }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, button, [role="button"]')) return;
        inputRef.current?.focus();
      }}
    >
      <h1
        style={{
          fontFamily: '"Lora", serif',
          fontSize: '18px',
          lineHeight: '24px',
          height: '24px',
          fontWeight: 600,
          color: 'var(--color-ink)',
          margin: 0,
          padding: 0,
        }}
      >
        Inbox
      </h1>

      <p
        style={{
          fontSize: '13px',
          lineHeight: '24px',
          height: '24px',
          color: 'var(--color-ink-light)',
          opacity: 0.6,
          margin: 0,
          padding: 0,
        }}
      >
        {phrase}
      </p>

      <div style={{ height: '24px' }} />

      <TaskList
        tasks={tasks}
        selectedTaskId={selectedId}
        editingId={editingId}
        onTaskClick={(id) => setSelectedId(id === selectedId ? undefined : id)}
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
        style={{ display: 'flex', alignItems: 'center', height: '24px' }}
      >
        <span
          style={{
            width: '24px',
            textAlign: 'center',
            fontSize: '10px',
            lineHeight: '24px',
            color: 'var(--color-ink)',
            opacity: 0.25,
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          •
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add task…"
          className="task-input task-add-input"
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
          style={{
            flex: 1,
            fontSize: '14px',
            lineHeight: '24px',
            fontFamily: '"Lora", serif',
            color: 'var(--color-ink)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
          }}
        />
      </form>
    </div>
  );
}
