import type { TranslationKey } from '../types/i18n';

interface GuardTask {
  id: string;
  title: string;
  description?: string | null;
  parentTaskId?: string | null;
}

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Subtasks below `id` in the loaded list: deleting it on the server removes all of them. */
export function descendantCount(id: string, tasks: readonly GuardTask[]): number {
  const children = new Map<string, string[]>();
  for (const task of tasks) {
    if (!task.parentTaskId) continue;
    children.set(task.parentTaskId, [...(children.get(task.parentTaskId) ?? []), task.id]);
  }
  const seen = new Set<string>();
  const walk = (parent: string) => {
    for (const child of children.get(parent) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      walk(child);
    }
  };
  walk(id);
  return seen.size;
}

/** A task that carries subtasks or written notes is never removed as a side effect. */
export function holdsWork(task: GuardTask | undefined, tasks: readonly GuardTask[]): boolean {
  if (!task) return false;
  return descendantCount(task.id, tasks) > 0 || Boolean(task.description?.trim());
}

/**
 * Explicit delete: plain tasks go at once; a task with subtasks or notes asks
 * first and says how many subtasks go with it.
 */
export function confirmTaskDelete(task: GuardTask | undefined, tasks: readonly GuardTask[], t: Translate): boolean {
  if (!task || !holdsWork(task, tasks)) return true;
  const count = descendantCount(task.id, tasks);
  return globalThis.confirm(count > 0
    ? t('task.deleteCascade', { title: task.title, count })
    : t('task.deleteWithNotes', { title: task.title }));
}
