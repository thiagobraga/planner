import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TaskList } from '../components/TaskList';
import { setPendingColumn } from '../components/TaskItem';
import type { Task } from '../components/TaskItem';
import {
  fetchProjectView,
  apiCreateTask,
  apiUpdateTask,
  apiToggleTask,
  apiDeleteTask,
  type ApiTask,
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { applyIndent } from '../utils/taskTree';

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
  };
}

let tempCounter = 0;
function tempId() { return `temp-${++tempCounter}`; }

export function ProjectsPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const { logout } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [editingId, setEditingId] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [id]);

  const { data, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProjectView(id),
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
    () => qc.invalidateQueries({ queryKey: ['project', id] }),
    [qc, id],
  );

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
    apiCreateTask({ title: trimmed, priority: 4, projectId: id })
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
    setSelectedId(tid);
  }, []);

  const handleStartEdit = useCallback((taskId: string) => {
    setEditingId(taskId);
    setSelectedId(taskId);
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
      apiCreateTask({ title: trimmed, priority: 4, projectId: id })
        .then((created) => {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? apiToTask(created) : t)));
        })
        .catch(() => {
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
        });
    } else {
      apiUpdateTask(taskId, { title: trimmed }).catch(() => invalidate());
    }
  }, [id]);
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
    setSelectedId(undefined);
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
      setSelectedId(target.id);
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
  return (
    <div
      className="max-w-162 cursor-text"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, button, [role="button"]')) return;
        inputRef.current?.focus();
      }}
    >
      <h1 className="text-lg leading-6 h-6 font-semibold text-ink">
        {data?.project.name ?? 'Project'}
      </h1>

      <div className="h-6" />

      <TaskList
        tasks={tasks}
        selectedTaskId={selectedId}
        editingId={editingId}
        onTaskClick={(taskId) => setSelectedId(taskId === selectedId ? undefined : taskId)}
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
