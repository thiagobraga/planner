import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TaskList } from '../components/TaskList';
import { TaskVisibilityControls } from '../components/TaskVisibilityControls';
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
import { useAuth } from '../contexts/AuthContext';
import { useTaskDrag } from '../hooks/useTaskDrag';
import { useTaskVisibilityPreferences } from '../hooks/useTaskVisibilityPreferences';
import { flattenTasks } from '../utils/taskProjection';
import { getPhrase } from '../utils/phrases';
import { nextOrderValue } from '../utils/order';
import { extractNaturalDate } from '../utils/date';
import { applyIndent } from '../utils/taskTree';
import { useSync } from '../hooks/useSync';
import { isEchoedMove } from '../utils/moveEcho';

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
  const {
    preferences,
    isPending: visibilityPreferencesPending,
    setHideCompletedTasks,
    setHideOldNotes,
  } = useTaskVisibilityPreferences();

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

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ['inbox'] }), [qc]);

  // Moves are addressed to the real Inbox collection, which the view resolves
  // for us rather than the client having to look it up.
  const { activeDragId } = useTaskDrag({
    tasks,
    setTasks,
    scope: { kind: 'collection', collectionId: data?.collectionId ?? '' },
    onError: invalidate,
    // A task can be dropped onto a sidebar collection and leave Inbox entirely.
    onMoved: () => qc.invalidateQueries({ queryKey: ['collection'] }),
  });

  useSync(useCallback((event) => {
    if (event.entityType !== 'task') return;
    // Refetching mid-move would overwrite the optimistic state with the order the
    // server held before the request this session is still waiting on.
    if (isEchoedMove(event)) return;
    invalidate();
  }, [invalidate]));

  const handleAddAtEnd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    const tid = tempId();
    setInput('');
    const extracted = extractNaturalDate(trimmed);
    
    setTasks((prev) => [
      ...prev,
      { id: tid, title: extracted.title, priority: 4, isCompleted: false, orderValue: nextOrderValue(prev), type: 'task' },
    ]);
    apiCreateTask({ 
      title: extracted.title, 
      priority: 4, 
      dueDate: extracted.dueDate, 
      recurrenceRule: extracted.recurrenceRule 
    })
      .then((created) => {
        setTasks((prev) => prev.map((t) => (t.id === tid ? apiToTask(created) : t)));
      })
      .catch(() => {
        setTasks((prev) => prev.filter((t) => t.id !== tid));
        invalidate();
      });
  };

  /** A leading '-' opens a note instead of a task, as it does on Daily. */
  const handleAddNoteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): boolean => {
    if (e.key !== '-' || input !== '') return false;
    e.preventDefault();

    const tid = tempId();
    setTasks((prev) => [
      ...prev,
      {
        id: tid,
        title: '',
        priority: 4,
        isCompleted: false,
        orderValue: nextOrderValue(prev),
        type: 'note',
      },
    ]);
    setEditingId(tid);
    return true;
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
        parentTaskId: prev[idx]?.parentTaskId,
        type: 'task',
      });
      return next.map((t, i) => ({ ...t, orderValue: i + 1 }));
    });
    setEditingId(tid);
  }, []);

  const handleStartEdit = useCallback((id: string) => {
    setEditingId(id);
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
      const currentTask = tasks.find((t) => t.id === id);
      const parentTaskId = currentTask?.parentTaskId ?? undefined;
      const currentIndent = currentTask?.indent ?? 0;
      
      const extracted = extractNaturalDate(trimmed);
      
      // was a new row - create it, keeping whichever type it was opened as
      apiCreateTask({
        title: extracted.title,
        priority: 4,
        parentTaskId,
        depth: currentIndent,
        type: currentTask?.type ?? 'task',
        dueDate: extracted.dueDate,
        recurrenceRule: extracted.recurrenceRule,
      })
        .then((created) => {
          setTasks((prev) => prev.map((t) => (t.id === id ? { ...apiToTask(created), orderValue: t.orderValue } : t)));
        })
        .catch(() => {
          setTasks((prev) => prev.filter((t) => t.id !== id));
        });
    } else {
      apiUpdateTask(id, { title: trimmed }).catch(() => invalidate());
    }
  }, [tasks, invalidate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConvertType = useCallback((taskId: string, type: 'task' | 'note') => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, type } : t)));
    if (!taskId.startsWith('temp-')) {
      apiUpdateTask(taskId, { type }).catch(() => invalidate());
    }
  }, [invalidate]);

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
    if (!id.startsWith('temp-')) apiDeleteTask(id).catch(() => invalidate());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleIndent = useCallback((id: string, dir: 1 | -1) => {
    setTasks((prev) => {
      const flatNodes = flattenTasks(prev).map((r) => ({ ...r.task, indent: r.depth }));
      const { tasks: nextFlat, parentTaskId, changed } = applyIndent(flatNodes, id, dir);
      if (!changed) return prev;
      if (!id.startsWith('temp-')) {
        apiUpdateTask(id, { parentTaskId: parentTaskId ?? null }).catch(() => invalidate());
      }
      return nextFlat.map(t => t.id === id ? { ...t, parentTaskId: parentTaskId ?? undefined } : t);
    });
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
      return prev;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = useCallback((id: string) => {
    const prevTasks = tasksRef.current;
    const task = prevTasks.find((t) => t.id === id);
    const hideCompleted = preferences?.hideCompletedTasks ?? false;
    const removeOnComplete = hideCompleted && task && !task.isCompleted;

    setTasks((prev) =>
      removeOnComplete
        ? prev.filter((t) => t.id !== id)
        : prev.map((t) => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t)),
    );

    if (task && !id.startsWith('temp-')) {
      apiToggleTask(id, !task.isCompleted).catch(() => {
        setTasks(prevTasks);
        invalidate();
      });
    }
  }, [invalidate, preferences?.hideCompletedTasks]);

  return (
    <div
      className="inbox-page relative w-full cursor-text"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, button, [role="button"]')) return;
        inputRef.current?.focus();
      }}
    >
      <header className="page-header-copy sticky-page-header max-w-162">
        <h1 className="text-[18px] leading-6 h-6 font-semibold text-ink m-0 p-0">
          Inbox
        </h1>

        <p className="page-header-subtitle text-[13px] leading-6 h-6 text-ink-light opacity-60 m-0 p-0">
          {phrase}
        </p>
      </header>

      <div className="page-header-toolbar inbox-page-header-controls sticky top-6 z-20 -mt-6 ml-auto w-fit">
        <TaskVisibilityControls
          hideCompletedTasks={preferences?.hideCompletedTasks ?? false}
          hideOldNotes={preferences?.hideOldNotes ?? false}
          disabled={!preferences || visibilityPreferencesPending}
          onHideCompletedTasksChange={setHideCompletedTasks}
          onHideOldNotesChange={setHideOldNotes}
        />
      </div>

      <div className="max-w-162">
        <div className="h-6" />

      <TaskList
        tasks={tasks}
        containerId="inbox"
        activeDragId={activeDragId}
        editingId={editingId}
        italicDueDate={false}
        onTaskToggle={handleToggle}
        onStartEdit={handleStartEdit}
        onEditCommit={handleEditCommit}
        onEditCancel={handleEditCancel}
        onDelete={handleDelete}
        onAddBelow={handleAddBelow}
        onIndent={handleIndent}
        onNavigate={handleNavigate}
        onConvertType={handleConvertType}
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
            if (handleAddNoteKeyDown(e)) return;
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
    </div>
  );
}
