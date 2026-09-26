import { useCallback, useMemo, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ApiTask, BoardGroupBy } from '../../api/client';
import { TaskList, type TaskListCallbacks } from '../TaskList';
import type { Task } from '../TaskItem';
import type {
  BoardColumnDragData,
  BoardColumnDropData,
  BoardColumnHeaderDropData,
} from '../../types/drag';
import type { BoardColumn as BoardColumnModel } from '../../utils/boardColumns';
import { buildSubtreeIndex, flattenTasks } from '../../utils/taskProjection';
import { BoardCard } from './BoardCard';
import { BoardColumnHeader } from './BoardColumnHeader';
import { useI18n } from '../../i18n/I18nContext';

interface BoardColumnProps {
  collectionId: string;
  groupBy: BoardGroupBy;
  column: BoardColumnModel;
  allTasks: ApiTask[];
  onToggle?: (taskId: string, completed: boolean) => void;
  onRename?: (columnId: string, name: string) => void;
  onRecolor?: (columnId: string, color: string) => void;
  onMarkCompletion?: (columnId: string) => void;
  onDelete?: (columnId: string) => void;
  onCreate?: (title: string, column: BoardColumnModel) => Promise<void>;
  presentation?: 'kanban-list' | 'kanban';
  taskListProps?: TaskListCallbacks & { editingId?: string; activeDragId?: string | null };
}

function asJournalTask(task: ApiTask): Task {
  return {
    ...task,
    parentTaskId: task.parentTaskId ?? undefined,
    dueDate: task.dueDate?.slice(0, 10),
    indent: task.depth,
  };
}

function columnTaskTree(roots: ApiTask[], allTasks: ApiTask[]): Task[] {
  const ids = new Set(roots.map((task) => task.id));
  let foundDescendant = true;
  while (foundDescendant) {
    foundDescendant = false;
    for (const task of allTasks) {
      if (!ids.has(task.id) && task.parentTaskId && ids.has(task.parentTaskId)) {
        ids.add(task.id);
        foundDescendant = true;
      }
    }
  }
  return allTasks.filter((task) => ids.has(task.id)).map(asJournalTask);
}

export function BoardColumn({
  collectionId,
  groupBy,
  column,
  allTasks,
  onToggle,
  onRename,
  onRecolor,
  onMarkCompletion,
  onDelete,
  onCreate,
  presentation = 'kanban',
  taskListProps,
}: BoardColumnProps) {
  const { t } = useI18n();
  const subtreeIndex = useMemo(() => buildSubtreeIndex(flattenTasks(allTasks)), [allTasks]);
  const journalTasks = useMemo(() => columnTaskTree(column.tasks, allTasks), [allTasks, column.tasks]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const canEdit = groupBy === 'status' || (groupBy === 'section' && column.value !== null);
  const canReorder = groupBy !== 'priority' && column.value !== null;
  const dragData: BoardColumnDragData = {
    kind: 'board-column',
    columnId: column.id,
    collectionId,
    groupBy,
  };
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id, data: dragData, disabled: !canReorder });

  const columnDropData: BoardColumnDropData = {
    kind: 'board-column',
    columnId: column.id,
    collectionId,
    groupBy,
    containerId: column.id,
  };
  const { setNodeRef: setColumnDropRef, isOver } = useDroppable({
    id: `column-drop:${column.id}`,
    data: columnDropData,
  });

  const headerDropData: BoardColumnHeaderDropData = {
    kind: 'board-column-header',
    columnId: column.id,
    collectionId,
    groupBy,
  };
  const { setNodeRef: setHeaderDropRef } = useDroppable({
    id: `column-header:${column.id}`,
    data: headerDropData,
    disabled: !canReorder,
  });
  const setHeaderRef = useCallback((node: HTMLElement | null) => {
    setActivatorNodeRef(node);
    setHeaderDropRef(node);
  }, [setActivatorNodeRef, setHeaderDropRef]);

  const closeEditor = () => {
    setEditing(false);
    setDraft('');
    setFailed(false);
    requestAnimationFrame(() => addButtonRef.current?.focus());
  };

  const saveTask = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = draft.trim();
    if (!title || saving || !onCreate) return;
    setSaving(true);
    setFailed(false);
    try {
      await onCreate(title, column);
      closeEditor();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      ref={setNodeRef}
      className={`board-column ${isDragging ? 'is-dragging' : ''} ${isOver ? 'is-over' : ''}`}
      data-column-id={column.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <BoardColumnHeader
        columnId={column.id}
        groupBy={groupBy}
        title={column.title}
        color={column.color}
        isCompletionStatus={column.isCompletionStatus}
        canEdit={canEdit}
        dragHandleProps={canReorder ? { ...attributes, ...listeners } : undefined}
        setDragHandleRef={canReorder ? setHeaderRef : undefined}
        onRename={canEdit ? (name) => onRename?.(column.id, name) : undefined}
        onRecolor={groupBy === 'status' ? (color) => onRecolor?.(column.id, color) : undefined}
        onMarkCompletion={groupBy === 'status' ? () => onMarkCompletion?.(column.id) : undefined}
        onDelete={canEdit ? () => onDelete?.(column.id) : undefined}
      />
      <div ref={setColumnDropRef} className={`board-column-cards ${presentation === 'kanban-list' ? 'board-column-lists' : ''}`}>
        {presentation === 'kanban-list' ? (
          <TaskList
            {...taskListProps}
            tasks={journalTasks}
            containerId={column.id}
            dropId={`board-list-drop:${column.id}`}
            dropData={columnDropData}
            onTaskToggle={(taskId) => {
              const task = allTasks.find((candidate) => candidate.id === taskId);
              if (task) onToggle?.(taskId, !task.isCompleted);
            }}
          />
        ) : (
          column.tasks.map((task) => (
            <BoardCard
              key={task.id}
              task={task}
              subtasks={allTasks.filter((candidate) => candidate.parentTaskId === task.id)}
              containerId={column.id}
              subtreeIds={subtreeIndex.get(task.id)}
              onToggle={onToggle}
            />
          ))
        )}
        {editing && (
          <form className={`${presentation === 'kanban-list' ? 'board-list-editor' : 'board-card'} daily-board-editor`} onSubmit={saveTask}>
            <input
              autoFocus
              aria-label={t('quickAdd.taskTitle')}
              placeholder={t('quickAdd.taskTitle')}
              value={draft}
              disabled={saving}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && !saving) {
                  event.preventDefault();
                  closeEditor();
                }
              }}
            />
            {failed && <p role="alert">{t('board.addTaskFailed')}</p>}
            <div className="daily-board-editor-actions">
              <button className="daily-board-editor-save" type="submit" disabled={saving || !draft.trim()}>{t('common.save')}</button>
              <button className="daily-board-editor-cancel" type="button" disabled={saving} onClick={closeEditor}>{t('common.cancel')}</button>
            </div>
          </form>
        )}
        <button
          ref={addButtonRef}
          type="button"
          className="daily-board-add-task"
          hidden={editing || !onCreate}
          onClick={() => setEditing(true)}
        >
          <span aria-hidden="true" className="daily-board-add-icon">+</span>
          <span>{t('board.addTask')}</span>
        </button>
      </div>
    </section>
  );
}
