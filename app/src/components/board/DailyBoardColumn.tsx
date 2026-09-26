import { useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { DailyBoardColumnProps } from '../../types/dailyBoard';
import type { DayDropData, NoDateDropData } from '../../types/drag';
import { TaskList } from '../TaskList';
import type { Task } from '../TaskItem';
import { BoardCard } from './BoardCard';
import { Button } from '../ui/Button';
import { useI18n } from '../../i18n/I18nContext';

function asJournalTask(task: DailyBoardColumnProps['allTasks'][number]): Task {
  return {
    ...task,
    parentTaskId: task.parentTaskId ?? undefined,
    dueDate: task.dueDate?.slice(0, 10),
    indent: task.depth,
  };
}

function columnTaskTree(roots: DailyBoardColumnProps['tasks'], allTasks: DailyBoardColumnProps['allTasks']): Task[] {
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

export function DailyBoardColumn({ column, title, isToday, tasks, allTasks, onToggle, onCreate, onOrganize, presentation = 'kanban', taskListProps }: DailyBoardColumnProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const savingRef = useRef(false);

  const closeEditor = () => {
    setEditing(false);
    setDraft('');
    setFailed(false);
    requestAnimationFrame(() => addButtonRef.current?.focus());
  };

  const saveTask = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFailed(false);
    try {
      await onCreate(trimmed, column.iso ?? undefined);
      closeEditor();
    } catch {
      setFailed(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  // Migrate clears a task's due date on drop, same as the old No-date column;
  // a day column sets the due date to that day.
  const dropData: DayDropData | NoDateDropData | undefined =
    column.id === 'migrate'
      ? { kind: 'no-date', containerId: column.id }
      : column.iso
        ? { kind: 'day', date: column.iso, containerId: column.id }
        : undefined;

  const { setNodeRef, isOver } = useDroppable({
    id: `daily-column-drop:${column.id}`,
    data: dropData,
    disabled: !column.droppable,
  });
  const journalTasks = columnTaskTree(tasks, allTasks);

  return (
    <section
      className={`board-column ${isOver ? 'is-over' : ''}`}
      data-column-id={column.id}
    >
      <header className="board-column-header">
        <h2 className="daily-board-column-title">
          {title}
          {isToday && <> · <span>{t('page.today')}</span></>}
        </h2>
        {column.id === 'migrate' ? (
          onOrganize && (
            <Button variant="secondary" size="xs" onClick={onOrganize}>
              {t('reorganize.button')}
            </Button>
          )
        ) : null}
      </header>
      <div ref={setNodeRef} className={`board-column-cards ${presentation === 'kanban-list' ? 'board-column-lists' : ''}`}>
        {presentation === 'kanban-list' ? (
          <TaskList
            {...taskListProps}
            tasks={journalTasks}
            containerId={column.id}
            dropId={`daily-list-drop:${column.id}`}
            dropData={dropData}
            onTaskToggle={(taskId) => {
              const task = allTasks.find((candidate) => candidate.id === taskId);
              if (task) onToggle?.(taskId, !task.isCompleted);
            }}
          />
        ) : (
          tasks.map((task) => (
            <BoardCard
              key={task.id}
              task={task}
              subtasks={allTasks.filter((candidate) => candidate.parentTaskId === task.id)}
              containerId={column.id}
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
          hidden={editing}
          onClick={() => setEditing(true)}
        >
          <span aria-hidden="true" className="daily-board-add-icon">+</span>
          <span>{t('board.addTask')}</span>
        </button>
      </div>
    </section>
  );
}
