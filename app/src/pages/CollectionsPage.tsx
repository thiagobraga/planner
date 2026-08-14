import { Fragment, useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskList } from '../components/TaskList';
import { SectionHeader } from '../components/SectionHeader';
import { InlineNameInput } from '../components/ui/InlineNameInput';
import { CollectionBoard } from '../components/board/CollectionBoard';
import { BoardToolbar } from '../components/board/BoardToolbar';
import { PageHeader } from '../components/PageHeader';
import { Toolbar } from '../components/ui/Toolbar';
import { nextOrderValue } from '../utils/order';
import { extractNaturalDate } from '../utils/date';
import type { Task } from '../components/TaskItem';
import type { Section } from '../stores/taskStore';
import {
  fetchCollectionView,
  fetchPreferences,
  apiCreateTask,
  apiUpdateTask,
  apiToggleTask,
  apiDeleteTask,
  apiCreateCollection,
  apiUpdateCollection,
  apiDeleteCollection,
  apiCreateSection,
  apiUpdateSection,
  apiDeleteSection,
  PALETTE_COLORS,
  type ApiTask,
  type ApiCollection,
} from '../api/client';
import { runOptimistic, patchById, upsertById } from '../stores/optimistic';
import { useTaskDrag } from '../hooks/useTaskDrag';
import { useSectionDrag } from '../hooks/useSectionDrag';
import { useTaskVisibilityPreferences } from '../hooks/useTaskVisibilityPreferences';
import { useBoardPreferences } from '../hooks/useBoardPreferences';
import { flattenTasks } from '../utils/taskProjection';
import { applyIndent } from '../utils/taskTree';
import { fetchCollections } from '../api/client';
import { ContextMenu, type ContextMenuItem } from '../components/ui/ContextMenu';
import { ColorPickerPopover } from '../components/ui/ColorPickerPopover';
import { buildCollectionMenuItems } from '../components/collectionMenuItems';
import { ConfirmModal } from '../components/ConfirmModal';
import { SectionDeleteModal } from '../components/SectionDeleteModal';
import { flattenCollections, getHierarchicalColor } from '../components/CollectionTreeNav';
import { Folder, ArrowUp, ArrowDown, Trash2, Pencil, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

function apiToTask(t: ApiTask): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    collectionId: t.collectionId,
    sectionId: t.sectionId,
    statusId: t.statusId,
    parentTaskId: t.parentTaskId ?? undefined,
    dueDate: t.dueDate ?? undefined,
    isCompleted: t.isCompleted,
    orderValue: t.orderValue,
    indent: t.depth,
    type: t.type,
    // Siblings with equal order values fall back to creation time; without it
    // every tie resolves arbitrarily.
    createdAt: t.createdAt,
  };
}

let tempCounter = 0;
function tempId() { return `temp-${++tempCounter}`; }

function buildSectionGroups(tasks: Task[], sections: Section[]) {
  const groups: Array<{ section: Section | null; tasks: Task[] }> = [];

  // Top-level tasks (sectionId-less)
  groups.push({
    section: null,
    tasks: tasks.filter((t) => !t.sectionId),
  });

  // One group per section, ordered by orderValue
  for (const section of [...sections].sort((a, b) => a.orderValue - b.orderValue)) {
    groups.push({
      section,
      tasks: tasks.filter((t) => t.sectionId === section.id),
    });
  }

  return groups;
}

export function CollectionsPage() {
  const { locale, t } = useI18n();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | undefined>();
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionTaskInput, setSectionTaskInput] = useState<Record<string, string>>({});
  const [, setSelectedId] = useState<string>();
  const [contextMenu, setContextMenu] = useState<{ taskId: string; position: { x: number; y: number } } | null>(null);
  const [sectionContextMenu, setSectionContextMenu] = useState<{ sectionId: string; position: { x: number; y: number } } | null>(null);
  const [crumbMenu, setCrumbMenu] = useState<{ collectionId: string; position: { x: number; y: number } } | null>(null);
  const [crumbColorPicker, setCrumbColorPicker] = useState<
    { collectionId: string; color: string; position: { x: number; y: number } } | null
  >(null);
  const [renamingCrumbId, setRenamingCrumbId] = useState<string | null>(null);
  const [crumbDraft, setCrumbDraft] = useState('');
  const [subAddingParentId, setSubAddingParentId] = useState<string | null>(null);
  const [subNewName, setSubNewName] = useState('');
  const [deletingCollection, setDeletingCollection] = useState<{ id: string; name: string } | null>(null);
  const [deletingSection, setDeletingSection] = useState<{ id: string; name: string; taskCount: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [id]);

  const { data } = useQuery({
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
  const boardPreferences = useBoardPreferences(id, preferences);

  useLayoutEffect(() => {
    if (data?.tasks) {
      setTasks(data.tasks.map(apiToTask));
    }
  }, [data]);

  useLayoutEffect(() => {
    if (data?.sections) {
      setSections(data.sections);
    }
  }, [data]);

  const invalidate = useCallback(
    () => qc.invalidateQueries({ queryKey: ['collection', id] }),
    [qc, id],
  );

  const { activeDragId } = useTaskDrag({
    enabled: boardPreferences.view === 'list',
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

  useSectionDrag({ sections, setSections, onError: invalidate });

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

  const handleAddSectionTask = (sectionId: string, e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = (sectionTaskInput[sectionId] ?? '').trim();
    if (!trimmed) return;
    const tid = tempId();
    setSectionTaskInput((prev) => ({ ...prev, [sectionId]: '' }));
    const extracted = extractNaturalDate(trimmed, undefined, locale);

    setTasks((prev) => [
      ...prev,
      { id: tid, title: extracted.title, priority: 4, isCompleted: false, orderValue: nextOrderValue(prev), type: 'task', sectionId },
    ]);
    apiCreateTask({
      title: extracted.title,
      priority: 4,
      collectionId: id,
      sectionId,
      dueDate: extracted.dueDate,
      recurrenceRule: extracted.recurrenceRule,
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
        sectionId: prev[idx]?.sectionId,
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
        sectionId: prev[idx]?.sectionId,
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
        sectionId: currentTask?.sectionId,
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

  const handleSectionRightClick = useCallback((sectionId: string, position: { x: number; y: number }) => {
    setSectionContextMenu({ sectionId, position });
  }, []);

  const handleAddSection = useCallback(() => {
    const sectionId = tempId();
    setSections((prev) => [
      ...prev,
      { id: sectionId, name: '', collectionId: id, orderValue: prev.length * 1000 },
    ]);
    setEditingSectionId(sectionId);
  }, [id]);

  const handleDeleteSection = useCallback((sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const taskCount = tasks.filter((t) => t.sectionId === sectionId).length;
    setDeletingSection({ id: sectionId, name: section.name, taskCount });
  }, [sections, tasks]);

  const handleCommitSectionName = useCallback(
    (sectionId: string, name: string) => {
      const trimmed = name.trim();
      setEditingSectionId(null);
      if (!trimmed) {
        if (sectionId.startsWith('temp-')) {
          setSections((prev) => prev.filter((s) => s.id !== sectionId));
        } else {
          handleDeleteSection(sectionId);
        }
        return;
      }
      setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, name: trimmed } : s)));
      if (sectionId.startsWith('temp-')) {
        apiCreateSection(id, { name: trimmed })
          .then((created) => {
            setSections((prev) =>
              prev.map((s) => (s.id === sectionId ? created : s))
            );
          })
          .catch(() => {
            setSections((prev) => prev.filter((s) => s.id !== sectionId));
          });
      } else {
        apiUpdateSection(sectionId, { name: trimmed }).catch(() => {});
      }
    },
    [handleDeleteSection, id]
  );

  const handleCancelSectionEdit = useCallback((sectionId: string) => {
    setEditingSectionId(null);
    if (sectionId.startsWith('temp-')) {
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
    }
  }, []);

  const handleConfirmDeleteSectionAndTasks = useCallback(() => {
    if (!deletingSection) return;
    const { id: sectionId } = deletingSection;
    const taskIds = tasks.filter((t) => t.sectionId === sectionId).map((t) => t.id);
    setDeletingSection(null);
    setTasks((prev) => prev.filter((t) => t.sectionId !== sectionId));
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    Promise.all(taskIds.map((taskId) => apiDeleteTask(taskId)))
      .then(() => apiDeleteSection(sectionId))
      .catch(() => invalidate());
  }, [deletingSection, tasks, invalidate]);

  const handleConfirmMoveTasksToTopLevel = useCallback(() => {
    if (!deletingSection) return;
    const { id: sectionId } = deletingSection;
    setDeletingSection(null);
    setTasks((prev) => prev.map((t) => (t.sectionId === sectionId ? { ...t, sectionId: undefined } : t)));
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    apiDeleteSection(sectionId).catch(() => invalidate());
  }, [deletingSection, invalidate]);

  const projectSubmenuItems = useMemo<ContextMenuItem[]>(() => {
    const items: ContextMenuItem[] = flattenCollections(collections).map((c) => ({
      type: 'item',
      label: c.name,
      icon: (
        <span
          className="w-1.75 h-1.75 rounded-full inline-block filter-[saturate(0.55)]"
          style={{ backgroundColor: c.color, marginLeft: c.depth * 12 }}
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
      label: t('contextMenu.noCollection'),
      icon: (
        <span
          className="w-1.75 h-1.75 rounded-full inline-block bg-transparent border border-ink/20"
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
  }, [collections, contextMenu, invalidate, t]);

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
      out.unshift({ id: current.id, name: current.name, color: current.color });
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }

    if (out.length > 0) return out;
    return data?.collection
      ? [{ id: data.collection.id, name: data.collection.name, color: data.collection.color }]
      : [];
  }, [collections, id, data]);

  const setCollectionsCache = useCallback(
    (updater: (prev: ApiCollection[]) => ApiCollection[]) => {
      qc.setQueryData<ApiCollection[]>(['collections'], (prev) => updater(prev ?? []));
    },
    [qc],
  );

  // Same flat recolor the sidebar performs: only the targeted crumb changes.
  const handleCrumbColorCommit = (collectionId: string, color: string) => {
    void runOptimistic<ApiCollection, ApiCollection>({
      state: collections,
      apply: (prev) => patchById(prev, collectionId, { color }),
      call: () => apiUpdateCollection(collectionId, { color }),
      onApply: (next) => qc.setQueryData<ApiCollection[]>(['collections'], next),
      onRevert: (snapshot) => qc.setQueryData<ApiCollection[]>(['collections'], snapshot),
      onSuccess: (updated) => setCollectionsCache((prev) => upsertById(prev, updated)),
    }).catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  };

  const handleCrumbRename = (collectionId: string) => {
    const trimmed = crumbDraft.trim();
    if (renamingCrumbId !== collectionId) return;
    setRenamingCrumbId(null);
    if (!trimmed) return;
    setCollectionsCache((prev) => patchById(prev, collectionId, { name: trimmed }));
    apiUpdateCollection(collectionId, { name: trimmed }).catch(() =>
      qc.invalidateQueries({ queryKey: ['collections'] }),
    );
  };

  const handleCrumbCommitSub = () => {
    if (!subAddingParentId) return;
    const parentId = subAddingParentId;
    const trimmed = subNewName.trim();
    setSubAddingParentId(null);
    setSubNewName('');
    if (!trimmed) return;
    const color = getHierarchicalColor('temp-id', parentId, collections);
    apiCreateCollection({ name: trimmed, color: color || PALETTE_COLORS[0], parentId })
      .then((created) => setCollectionsCache((prev) => [...prev, created]))
      .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  };

  // A section being named for the first time renders as an inline input in the
  // "+ New section" row itself, rather than up in the grouped list, so the
  // input appears exactly where the user clicked.
  const addingSection = sections.find((s) => s.id.startsWith('temp-'));
  const [topLevelGroup, ...sectionGroups] = buildSectionGroups(
    tasks,
    sections.filter((s) => !s.id.startsWith('temp-')),
  );
  return (
    <div
      className="collection-detail-page relative w-full cursor-text"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, button, [role="button"]')) return;
        inputRef.current?.focus();
      }}
    >
      <PageHeader
        titleClassName="collections-page-title flex items-center gap-2"
        title={
          <>
            {trail.map((crumb, i) => {
                const isCurrent = i === trail.length - 1;
                return (
                  <Fragment key={crumb.id}>
                    {i > 0 && (
                      <ChevronRight size={13} className="collections-page-title-separator font-normal mx-1 text-ink-light opacity-50" aria-hidden="true" />
                    )}
                    <span
                      className="collections-page-crumb flex min-w-0 items-center gap-2"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setCrumbMenu({ collectionId: crumb.id, position: { x: e.clientX, y: e.clientY } });
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="w-1.75 h-1.75 shrink-0 rounded-full"
                        style={{ background: crumb.color }}
                      />
                      {renamingCrumbId === crumb.id ? (
                        <input
                          autoFocus
                          aria-label={t('common.rename')}
                          value={crumbDraft}
                          onChange={(e) => setCrumbDraft(e.target.value)}
                          onBlur={() => handleCrumbRename(crumb.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCrumbRename(crumb.id);
                            if (e.key === 'Escape') setRenamingCrumbId(null);
                          }}
                          className="min-w-0 flex-1 border-0 border-b border-dot bg-transparent p-0 text-lg leading-6 font-semibold text-ink outline-none"
                        />
                      ) : isCurrent ? (
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
          </>
        }
        afterTitle={
          subAddingParentId && (
            <div className="collections-page-sub-input flex h-6 items-center">
              <input
                autoFocus
                value={subNewName}
                onChange={(e) => setSubNewName(e.target.value)}
                onBlur={handleCrumbCommitSub}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCrumbCommitSub();
                  if (e.key === 'Escape') {
                    setSubAddingParentId(null);
                    setSubNewName('');
                  }
                }}
                placeholder={t('page.collectionName')}
                className="h-6 w-full min-w-0 border-0 border-b border-dot bg-transparent p-0 text-[13px] leading-6 text-ink outline-none"
              />
            </div>
          )
        }
        toolbar={
          <Toolbar className="collection-page-header-controls">
            <BoardToolbar
              view={boardPreferences.view}
              groupBy={boardPreferences.groupBy}
              hideCompletedTasks={preferences?.hideCompletedTasks ?? false}
              hideOldNotes={preferences?.hideOldNotes ?? false}
              preferencesDisabled={!preferences || visibilityPreferencesPending}
              onViewChange={boardPreferences.setView}
              onGroupByChange={boardPreferences.setGroupBy}
              onHideCompletedTasksChange={setHideCompletedTasks}
              onHideOldNotesChange={setHideOldNotes}
            />
          </Toolbar>
        }
      />

      <div className={boardPreferences.view === 'kanban' ? 'w-full' : 'max-w-162'}>
        {boardPreferences.view === 'kanban' && data ? (
          <CollectionBoard
            collectionId={id}
            queryKey={['collection', id]}
            groupBy={boardPreferences.groupBy}
            tasks={data.tasks}
            statuses={data.statuses}
            completionStatusId={data.completionStatusId}
            sections={data.sections}
            boardOrder={data.boardOrder}
            onToggle={(taskId) => handleToggle(taskId)}
          />
        ) : (
        <>
        <div className="h-6" />

        <TaskList
          tasks={topLevelGroup.tasks}
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
          onKeyDown={handleAddNoteKeyDown}
        />
        </form>

        <SortableContext
          items={sectionGroups.map((group) => group.section!.id)}
          strategy={verticalListSortingStrategy}
        >
        {sectionGroups.map((group) => (
          <Fragment key={group.section!.id}>
            <div className="h-6" />
            <SectionHeader
              section={group.section!}
              collectionId={id ?? ''}
              isEditing={editingSectionId === group.section!.id}
              onEdit={() => setEditingSectionId(group.section!.id)}
              onCommitName={(name) => handleCommitSectionName(group.section!.id, name)}
              onCancelEdit={() => handleCancelSectionEdit(group.section!.id)}
              onDelete={() => handleDeleteSection(group.section!.id)}
              onRightClick={(position) => handleSectionRightClick(group.section!.id, position)}
            />
            <TaskList
              tasks={group.tasks}
              containerId={`section:${group.section!.id}`}
              sectionId={group.section!.id}
              collectionId={id}
              activeDragId={activeDragId}
              editingId={editingId}
              onTaskToggle={handleToggle}
              onStartEdit={handleStartEdit}
              onEditCommit={handleEditCommit}
              onEditCancel={handleEditCancel}
              onDelete={handleDelete}
              onAddBelow={handleAddBelow}
              onIndent={handleIndent}
              onConvertType={handleConvertType}
              onRightClick={handleRightClick}
            />
            <form
              onSubmit={(e) => handleAddSectionTask(group.section!.id, e)}
              className="flex items-center h-6"
            >
              <span className="w-6 text-center text-[10px] leading-6 text-ink opacity-25 select-none shrink-0">
                •
              </span>
              <input
                type="text"
                value={sectionTaskInput[group.section!.id] ?? ''}
                onChange={(e) =>
                  setSectionTaskInput((prev) => ({ ...prev, [group.section!.id]: e.target.value }))
                }
                placeholder={t('common.addTask')}
                className="task-input task-add-input flex-1 text-sm leading-6 text-ink bg-transparent border-none outline-none p-0"
                spellCheck={false}
              />
            </form>
          </Fragment>
        ))}
        </SortableContext>

        <div className="h-6" />

        {addingSection ? (
          <div className="flex h-6 w-full min-w-0 items-center pr-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-ink-light opacity-35">+</span>
            <InlineNameInput
              defaultValue=""
              placeholder={t('page.newSection')}
              className="uppercase tracking-widest text-[10px] font-semibold text-ink-light"
              onCommit={(name) => handleCommitSectionName(addingSection.id, name)}
              onCancel={() => handleCancelSectionEdit(addingSection.id)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAddSection}
            className="group flex h-6 w-full min-w-0 items-center pr-2 text-ink-light opacity-35 transition-opacity hover:opacity-100"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center">+</span>
            <span className="min-w-0 flex-1 truncate text-left uppercase tracking-widest text-[10px] font-semibold">
              {t('page.newSection')}
            </span>
          </button>
        )}
        </>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          items={[
            // { type: 'item', label: 'Date', icon: <Calendar size={14} />, disabled: true },
            // { type: 'item', label: 'Priority', icon: <Tag size={14} />, disabled: true },
            { type: 'item', label: t('contextMenu.collection'), icon: <Folder size={14} />, submenu: projectSubmenuItems },
            // { type: 'item', label: 'Tags', icon: <Hash size={14} />, disabled: true },
            { type: 'separator' },
            { type: 'item', label: t('contextMenu.addAbove'), icon: <ArrowUp size={14} />, onClick: () => handleAddAbove(contextMenu.taskId) },
            { type: 'item', label: t('contextMenu.addBelow'), icon: <ArrowDown size={14} />, onClick: () => handleAddBelow(contextMenu.taskId) },
            { type: 'separator' },
            { type: 'item', label: t('common.delete'), icon: <Trash2 size={14} />, destructive: true, onClick: () => handleDelete(contextMenu.taskId) },
          ]}
        />
      )}

      {sectionContextMenu && (
        <ContextMenu
          position={sectionContextMenu.position}
          onClose={() => setSectionContextMenu(null)}
          items={[
            { type: 'item', label: t('common.rename'), icon: <Pencil size={14} />, onClick: () => setEditingSectionId(sectionContextMenu.sectionId) },
            { type: 'separator' },
            { type: 'item', label: t('common.delete'), icon: <Trash2 size={14} />, destructive: true, onClick: () => handleDeleteSection(sectionContextMenu.sectionId) },
          ]}
        />
      )}

      {crumbMenu && (
        <ContextMenu
          position={crumbMenu.position}
          onClose={() => setCrumbMenu(null)}
          items={buildCollectionMenuItems(t, {
            onChangeColor: () =>
              setCrumbColorPicker({
                collectionId: crumbMenu.collectionId,
                color: trail.find((c) => c.id === crumbMenu.collectionId)?.color ?? '#65788a',
                position: crumbMenu.position,
              }),
            onStartRename: () => {
              setCrumbDraft(trail.find((c) => c.id === crumbMenu.collectionId)?.name ?? '');
              setRenamingCrumbId(crumbMenu.collectionId);
            },
            onAddSub: () => {
              setSubNewName('');
              setSubAddingParentId(crumbMenu.collectionId);
            },
            onDelete: () =>
              setDeletingCollection({
                id: crumbMenu.collectionId,
                name: trail.find((c) => c.id === crumbMenu.collectionId)?.name ?? '',
              }),
          })}
        />
      )}

      {crumbColorPicker && (
        <ColorPickerPopover
          position={crumbColorPicker.position}
          value={crumbColorPicker.color}
          onCommit={(color) => handleCrumbColorCommit(crumbColorPicker.collectionId, color)}
          onClose={() => setCrumbColorPicker(null)}
        />
      )}

      <ConfirmModal
        isOpen={deletingCollection !== null}
        title={t('page.deleteCollection')}
        message={t('page.deleteCollectionMessage', { name: deletingCollection?.name ?? '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          if (!deletingCollection) return;
          const target = deletingCollection.id;
          setDeletingCollection(null);
          setCollectionsCache((prev) => prev.filter((c) => c.id !== target));
          apiDeleteCollection(target)
            .then(() => navigate('/daily'))
            .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
        }}
        onCancel={() => setDeletingCollection(null)}
      />

      <SectionDeleteModal
        isOpen={deletingSection !== null}
        sectionName={deletingSection?.name ?? ''}
        taskCount={deletingSection?.taskCount ?? 0}
        onDeleteTasks={handleConfirmDeleteSectionAndTasks}
        onMoveToTopLevel={handleConfirmMoveTasksToTopLevel}
        onCancel={() => setDeletingSection(null)}
      />
    </div>
  );
}
