import { Fragment, useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskList } from '../components/TaskList';
import { SectionHeader } from '../components/SectionHeader';
import { InlineNameInput } from '../components/ui/InlineNameInput';
import { CollectionBoard } from '../components/board/CollectionBoard';
import { BoardToolbar } from '../components/board/BoardToolbar';
import { PageHeader } from '../components/PageHeader';
import { Toolbar } from '../components/ui/Toolbar';
import type { Task } from '../components/TaskItem';
import type { Section } from '../stores/taskStore';
import {
  fetchInboxTasks,
  fetchPreferences,
  apiCreateTask,
  apiUpdateTask,
  apiToggleTask,
  apiDeleteTask,
  fetchCollections,
  apiCreateSection,
  apiUpdateSection,
  apiDeleteSection,
  type ApiTask,
} from '../api/client';
import { ContextMenu, type ContextMenuItem } from '../components/ui/ContextMenu';
import { SectionDeleteModal } from '../components/SectionDeleteModal';
import { flattenCollections } from '../components/CollectionTreeNav';
import { Folder, ArrowUp, ArrowDown, Trash2, Pencil } from 'lucide-react';
import { useTaskDrag } from '../hooks/useTaskDrag';
import { useSectionDrag } from '../hooks/useSectionDrag';
import { useTaskVisibilityPreferences } from '../hooks/useTaskVisibilityPreferences';
import { useBoardPreferences } from '../hooks/useBoardPreferences';
import { flattenTasks } from '../utils/taskProjection';
import { nextOrderValue } from '../utils/order';
import { extractNaturalDate } from '../utils/date';
import { applyIndent } from '../utils/taskTree';
import { useSync } from '../hooks/useSync';
import { isEchoedMove } from '../utils/moveEcho';
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
    labels: t.labels,
    indent: t.depth,
    type: t.type,
    createdAt: t.createdAt,
  };
}

let tempCounter = 0;
function tempId() { return `temp-${++tempCounter}`; }

function buildSectionGroups(tasks: Task[], sections: Section[]) {
  const groups: Array<{ section: Section | null; tasks: Task[] }> = [];

  groups.push({
    section: null,
    tasks: tasks.filter((t) => !t.sectionId),
  });

  for (const section of [...sections].sort((a, b) => a.orderValue - b.orderValue)) {
    groups.push({
      section,
      tasks: tasks.filter((t) => t.sectionId === section.id),
    });
  }

  return groups;
}

export function InboxPage() {
  const { locale, t } = useI18n();
  const qc = useQueryClient();
  const cachedInbox = qc.getQueryData<Awaited<ReturnType<typeof fetchInboxTasks>>>(['inbox']);
  const [tasks, setTasks] = useState<Task[]>(() => cachedInbox?.tasks.map(apiToTask) ?? []);
  const [sections, setSections] = useState<Section[]>(() => cachedInbox?.sections ?? []);
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | undefined>();
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionTaskInput, setSectionTaskInput] = useState<Record<string, string>>({});
  const [, setSelectedId] = useState<string>();
  const [contextMenu, setContextMenu] = useState<{ taskId: string; position: { x: number; y: number } } | null>(null);
  const [sectionContextMenu, setSectionContextMenu] = useState<{ sectionId: string; position: { x: number; y: number } } | null>(null);
  const [deletingSection, setDeletingSection] = useState<{ id: string; name: string; taskCount: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { data } = useQuery({
    queryKey: ['inbox'],
    queryFn: fetchInboxTasks,
    staleTime: 30_000,
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

  const [syncedData, setSyncedData] = useState(data);
  if (data !== syncedData) {
    setSyncedData(data);
    if (data?.tasks) {
      setTasks(data.tasks.map(apiToTask));
    }
    if (data?.sections) {
      setSections(data.sections);
    }
  }

  const inboxCollectionId = data?.inboxCollectionId;
  const boardPreferences = useBoardPreferences(inboxCollectionId, preferences);

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ['inbox'] }), [qc]);

  // Moves are addressed to the real Inbox collection, which the view resolves
  // for us rather than the client having to look it up.
  const { activeDragId } = useTaskDrag({
    enabled: boardPreferences.view === 'list',
    tasks,
    setTasks,
    scope: { kind: 'collection', collectionId: data?.collectionId ?? '' },
    onError: invalidate,
    // A task can be dropped onto a sidebar collection and leave Inbox entirely.
    onMoved: () => qc.invalidateQueries({ queryKey: ['collection'] }),
  });

  useSectionDrag({ sections, setSections, onError: invalidate });

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
    const extracted = extractNaturalDate(trimmed, undefined, locale);

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

      const extracted = extractNaturalDate(trimmed, undefined, locale);

      // was a new row - create it, keeping whichever type it was opened as
      apiCreateTask({
        title: extracted.title,
        priority: 4,
        sectionId: currentTask?.sectionId,
        parentTaskId,
        depth: currentIndent,
        type: currentTask?.type ?? 'task',
        dueDate: extracted.dueDate,
        recurrenceRule: extracted.recurrenceRule,
        orderValue: currentTask?.orderValue ?? 0,
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
  }, [tasks, invalidate, locale]);

  const handleConvertType = useCallback((taskId: string, type: 'task' | 'note' | 'event') => {
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
  }, [invalidate]);

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
  }, [invalidate]);

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

  const { data: collections = [] } = useQuery({ queryKey: ['collections'], queryFn: fetchCollections });

  const handleRightClick = useCallback((taskId: string, position: { x: number; y: number }) => {
    setSelectedId(taskId);
    setContextMenu({ taskId, position });
  }, []);

  const handleSectionRightClick = useCallback((sectionId: string, position: { x: number; y: number }) => {
    setSectionContextMenu({ sectionId, position });
  }, []);

  const handleAddSection = useCallback(() => {
    if (!inboxCollectionId) return;
    const sectionId = tempId();
    setSections((prev) => [
      ...prev,
      { id: sectionId, name: '', collectionId: inboxCollectionId, orderValue: prev.length * 1000 },
    ]);
    setEditingSectionId(sectionId);
  }, [inboxCollectionId]);

  const handleDeleteSection = useCallback((sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId)!;
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
        apiCreateSection(inboxCollectionId!, { name: trimmed })
          .then((created) => {
            setSections((prev) =>
              prev.map((s) => (s.id === sectionId ? created : s))
            );
          })
          .catch(() => {
            setSections((prev) => prev.filter((s) => s.id !== sectionId));
          });
      } else {
        apiUpdateSection(sectionId, { name: trimmed }).catch(() => { });
      }
    },
    [handleDeleteSection, inboxCollectionId]
  );

  const handleCancelSectionEdit = useCallback((sectionId: string) => {
    setEditingSectionId(null);
    if (sectionId.startsWith('temp-')) {
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
    }
  }, []);

  const handleConfirmDeleteSectionAndTasks = useCallback(() => {
    const { id: sectionId } = deletingSection!;
    const taskIds = tasks.filter((t) => t.sectionId === sectionId).map((t) => t.id);
    setDeletingSection(null);
    setTasks((prev) => prev.filter((t) => t.sectionId !== sectionId));
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    Promise.all(taskIds.map((taskId) => apiDeleteTask(taskId)))
      .then(() => apiDeleteSection(sectionId))
      .catch(() => invalidate());
  }, [deletingSection, tasks, invalidate]);

  const handleConfirmMoveTasksToTopLevel = useCallback(() => {
    const { id: sectionId } = deletingSection!;
    setDeletingSection(null);
    setTasks((prev) => prev.map((t) => (t.sectionId === sectionId ? { ...t, sectionId: undefined } : t)));
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    apiDeleteSection(sectionId).catch(() => invalidate());
  }, [deletingSection, invalidate]);

  const projectSubmenuItems: ContextMenuItem[] = [
    ...flattenCollections(collections).map((c) => ({
      type: 'item',
      label: c.name,
      icon: (
        <span
          className="w-1.75 h-1.75 rounded-full inline-block filter-[saturate(0.55)]"
          style={{ backgroundColor: c.color, marginLeft: c.depth * 12 }}
        />
      ),
      onClick: () => {
        apiUpdateTask(contextMenu!.taskId, { collectionId: c.id }).catch(() => invalidate());
      },
    })),
    {
      type: 'item',
      label: t('contextMenu.noCollection'),
      icon: (
        <span
          className="w-1.75 h-1.75 rounded-full inline-block bg-transparent border border-ink/20"
        />
      ),
      onClick: () => {
        const inbox = collections.find((c) => c.isInbox);
        if (inbox) {
          apiUpdateTask(contextMenu!.taskId, { collectionId: inbox.id }).catch(() => invalidate());
        }
      },
    },
  ];

  // A section being named for the first time renders as an inline input in the
  // "+ New section" row itself, rather than up in the grouped list, so the
  // input appears exactly where the user clicked.
  const addingSection = sections.find((s) => s.id.startsWith('temp-'));
  const [topLevelGroup, ...sectionGroups] = buildSectionGroups(
    tasks,
    sections.filter((s) => !s.id.startsWith('temp-')),
  );
  // List view always groups by section, regardless of the Kanban groupBy
  // preference - status/priority grouping only applies to the Kanban board.

  return (
    <div
      className="inbox-page relative w-full cursor-text"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, button, [role="button"]')) return;
        inputRef.current?.focus();
      }}
    >
      <PageHeader
        title={t('page.inbox')}
        toolbar={
          <Toolbar className="inbox-page-header-controls">
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
        {boardPreferences.view === 'kanban' && data && inboxCollectionId ? (
          <CollectionBoard
            collectionId={inboxCollectionId}
            queryKey={['inbox']}
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
              containerId="collection:inbox"
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
                className="task-input task-add-input flex-1 text-[14px] leading-6 text-ink bg-transparent border-none outline-none p-0"
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
                      collectionId={inboxCollectionId ?? ''}
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
                      collectionId={inboxCollectionId}
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
                        className="task-input task-add-input flex-1 text-[14px] leading-6 text-ink bg-transparent border-none outline-none p-0"
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
