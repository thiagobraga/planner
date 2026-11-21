import type { KeyboardEvent } from 'react';
import { apiCreateTask } from '../api/client';
import type { InboxAddOptions } from '../types/inbox';
import { extractNaturalDate } from '../utils/date';
import { nextOrderValue } from '../utils/order';
import { blurOnEscape } from '../utils/editableText';
import { apiToTask, tempId } from './useInboxTaskRows';

/** Quick capture at the end of the Inbox or of a section; a leading '-' opens a note. */
export function useInboxAdd({ input, setInput, setSectionTaskInput, setTasks, setEditingId, invalidate, locale }: InboxAddOptions) {
  const handleAddAtEnd = (text: string) => {
    const trimmed = text.trim();
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

  const handleAddSectionTask = (sectionId: string, text: string) => {
    const trimmed = text.trim();
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
      recurrenceRule: extracted.recurrenceRule })
      .then((created) => {
        setTasks((prev) => prev.map((t) => (t.id === tid ? apiToTask(created) : t)));
      })
      .catch(() => {
        setTasks((prev) => prev.filter((t) => t.id !== tid));
        invalidate();
      });
  };

  /** A leading '-' opens a note instead of a task, as it does on Daily. */
  const handleAddNoteKeyDown = (e: KeyboardEvent<HTMLDivElement>): boolean => {
    blurOnEscape(e);
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
        type: 'note' },
    ]);
    setEditingId(tid);
    return true;
  };

  return { handleAddAtEnd, handleAddSectionTask, handleAddNoteKeyDown };
}
