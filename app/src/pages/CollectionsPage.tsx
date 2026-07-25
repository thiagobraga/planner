import { Fragment, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TaskList } from '../components/TaskList';
import { TaskVisibilityControls } from '../components/TaskVisibilityControls';
import { nextOrderValue } from '../utils/order';
import { extractNaturalDate } from '../utils/date';
import { setPendingColumn } from '../components/TaskItem';
import type { Task } from '../components/TaskItem';
import {
  fetchCollectionView,
  fetchPreferences,
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
import { applyIndent } from '../utils/taskTree';
import { fetchCollections, paletteColorHex } from '../api/client';
import { ContextMenu, type ContextMenuItem } from '../components/ui/ContextMenu';
import { useI18n } from '../i18n/I18nContext';

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
  const { locale, t } = useI18n();
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const { logout } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | undefined>();
  const [, setSelectedId] = useState<string>();
  const [contextMenu, setContextMenu] = useState<{ taskId: string; position: { x: number; y: number } } | null>(null);
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
  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: fetchPreferences,
  });
  const {
    isPending: visibilityPreferencesPending,
    setHideCompletedTasks,
    setHideOldNotes,
  } = useTaskVisibilityPreferences(preferences);

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
    const extracted = extractNaturalDate(trimmed, undefined, locale);
    
    setTasks((prev) => [
      ...prev,
      { id: tid, title: extracted.title, priority: 4, isCompleted: false, orderValue: nextOrderValue(prev), type: 'task' },
    ]);
    apiCreateTask({ 
      title: extracted.title, 
      priority: 4, 
      collectionId: id,
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

  const calculateMidpointOrder = (taskList: Task[], index: number, type: 'above' | 'below') => {
    const current = taskList[index].orderValue;
    if (type === 'below') {
      const next = index < taskList.length - 1 ? taskList[index + 1].orderValue : current + 2000;
      return Math.floor((current + next) / 2);
    } else {
      const prev = index > 0 ? taskList[index - 1].orderValue : current - 2000;
      return Math.floor((prev + current) / 2);
    }
  };

  const handleAddBelow = useCallback((afterId: string) => {
    const tid = tempId();
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === afterId);
      if (idx === -1) return prev;
      const computedOrderValue = calculateMidpointOrder(prev, idx, 'below');
      const next = [...prev];
      next.splice(idx + 1, 0, {
        id: tid,
        title: '',
        priority: 4,
        isCompleted: false,
        orderValue: computedOrderValue,
        indent: prev[idx]?.indent,
        parentTaskId: prev[idx]?.parentTaskId,
        type: 'task',
      });
      return next;
    });
    setEditingId(tid);
    setSelectedId(tid);
  }, []);

  const handleAddAbove = useCallback((beforeId: string) => {
    const tid = tempId();
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === beforeId);
      if (idx === -1) return prev;
      const computedOrderValue = calculateMidpointOrder(prev, idx, 'above');
      const next = [...prev];
      next.splice(idx, 0, {
        id: tid,
        title: '',
        priority: 4,
        isCompleted: false,
        orderValue: computedOrderValue,
        indent: prev[idx]?.indent,
        parentTaskId: prev[idx]?.parentTaskId,
        type: 'task',
      });
      return next;
    });
    setEditingId(tid);
    setSelectedId(tid);
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
      const currentTask = tasks.find((t) => t.id === taskId);
      const parentTaskId = currentTask?.parentTaskId ?? undefined;
      const currentIndent = currentTask?.indent ?? 0;
      
      const extracted = extractNaturalDate(trimmed, undefined, locale);
      
      // was a new row - create it, keeping whichever type it was opened as
      apiCreateTask({
        title: extracted.title,
        priority: 4,
        collectionId: id,
        parentTaskId,
        depth: currentIndent,
        type: currentTask?.type ?? 'task',
        dueDate: extracted.dueDate,
        recurrenceRule: extracted.recurrenceRule,
        orderValue: currentTask?.orderValue ?? 0,
      })
        .then((created) => {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...apiToTask(created), orderValue: t.orderValue } : t)));
        })
        .catch(() => {
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
        });
    } else {
      apiUpdateTask(taskId, { title: trimmed }).catch(() => invalidate());
    }
  }, [id, tasks, invalidate, locale]);
  const handleConvertType = useCallback((taskId: string, type: 'task' | 'note') => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, type } : t)));
    if (!taskId.startsWith('temp-')) {
      apiUpdateTask(taskId, { type }).catch(() => invalidate());
    }
  }, [invalidate]);

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
  }, [invalidate]);
  const handleIndent = useCallback((taskId: string, dir: 1 | -1) => {
    setTasks((prev) => {
      const flatNodes = flattenTasks(prev).map((r) => ({ ...r.task, indent: r.depth }));
      const { tasks: nextFlat, parentTaskId, changed } = applyIndent(flatNodes, taskId, dir);
      if (!changed) return prev;
      if (!taskId.startsWith('temp-')) {
        apiUpdateTask(taskId, { parentTaskId: parentTaskId ?? null }).catch(() => invalidate());
      }
      return nextFlat.map(t => t.id === taskId ? { ...t, parentTaskId: parentTaskId ?? undefined } : t);
    });
  }, [invalidate]);
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
    const hideCompleted = preferences?.hideCompletedTasks ?? false;
    const task = tasks.find((t) => t.id === taskId);
    const removeOnComplete = hideCompleted && task && !task.isCompleted;
    const previousTasks = tasks;

    setTasks((prev) =>
      removeOnComplete
        ? prev.filter((t) => t.id !== taskId)
        : prev.map((t) => (t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t)),
    );
    if (!taskId.startsWith('temp-')) {
      if (task) {
        apiToggleTask(taskId, !task.isCompleted).catch(() => {
          setTasks(previousTasks);
          invalidate();
        });
      }
    }
  }, [invalidate, preferences?.hideCompletedTasks, tasks]);

  const { data: collections = [] } = useQuery({ queryKey: ['collections'], queryFn: fetchCollections });

  const handleRightClick = useCallback((taskId: string, position: { x: number; y: number }) => {
    setSelectedId(taskId);
    setContextMenu({ taskId, position });
  }, []);

  const projectSubmenuItems = useMemo<ContextMenuItem[]>(() => {
    const items: ContextMenuItem[] = collections
      .filter((c) => !c.isInbox)
      .map((c) => ({
        type: 'item',
        label: c.name,
        icon: (
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: paletteColorHex(c.color) }}
          />
        ),
        onClick: () => {
          if (contextMenu?.taskId) {
            apiUpdateTask(contextMenu.taskId, { collectionId: c.id }).catch(() => invalidate());
          }
        },
      }));

    items.push({
      type: 'item',
      label: 'No project',
      icon: (
        <span
          className="w-2 h-2 rounded-full inline-block bg-transparent border border-ink/20"
        />
      ),
      onClick: () => {
        if (contextMenu?.taskId) {
          const inbox = collections.find((c) => c.isInbox);
          if (inbox) {
            apiUpdateTask(contextMenu.taskId, { collectionId: inbox.id }).catch(() => invalidate());
          }
        }
      },
    });

    return items;
  }, [collections, contextMenu, invalidate]);

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
      className="collection-detail-page relative w-full cursor-text"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, button, [role="button"]')) return;
        inputRef.current?.focus();
      }}
    >
      <header className="page-header-copy sticky-page-header max-w-162">
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
      </header>

      <div className="page-header-toolbar collection-page-header-controls sticky top-0 z-20 -mt-6 ml-auto w-fit">
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
        onConvertType={handleConvertType}
        onRightClick={handleRightClick}
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
          placeholder={t('common.addTask')}
          className="task-input task-add-input flex-1 text-sm leading-6 text-ink bg-transparent border-none outline-none p-0"
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

      {contextMenu && (
        <ContextMenu
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          items={[
            { type: 'item', label: 'Date', disabled: true },
            { type: 'item', label: 'Priority', disabled: true },
            { type: 'item', label: 'Project', submenu: projectSubmenuItems },
            { type: 'item', label: 'Tags', disabled: true },
            { type: 'separator' },
            { type: 'item', label: 'Add above', onClick: () => handleAddAbove(contextMenu.taskId) },
            { type: 'item', label: 'Add below', onClick: () => handleAddBelow(contextMenu.taskId) },
            { type: 'separator' },
            { type: 'item', label: 'Delete', destructive: true, onClick: () => handleDelete(contextMenu.taskId) },
          ]}
        />
      )}
    </div>
  );
}
