import { Check, PanelRight, RotateCcw } from 'lucide-react';
import { openTaskDetails } from '../stores/taskDetailStore';
import type { ContextMenuItem } from '../types/contextMenu';
import type { TranslationKey } from '../i18n/catalogs';
import type { ApiStatus } from '../types/api';
import type { Task } from '../types/task';

export function resolveStageActions(task: Task, statuses: ApiStatus[], completionStatusId: string | null) {
  const none = { next: null, accept: null, reject: null };
  if (task.type === 'note' || task.type === 'event' || task.isCompleted || task.parentTaskId || (completionStatusId && task.statusId === completionStatusId)) return none;
  const sorted = [...statuses].sort((a, b) => a.orderValue - b.orderValue);
  const fallback = sorted.find((status) => status.id !== completionStatusId) ?? sorted[0];
  const current = sorted.find((status) => status.id === task.statusId) ?? (!task.statusId ? fallback : undefined);
  if (!current) return none;
  const find = (id: string | null) => sorted.find((status) => status.id === id) ?? null;
  const next = current.nextStatusMode === 'disabled' ? null
    : current.nextStatusMode === 'custom' ? find(current.nextStatusId)
      : sorted[sorted.indexOf(current) + 1] ?? null;
  return { next, accept: find(current.acceptStatusId), reject: find(current.rejectStatusId) };
}

export function buildTaskMenuActions({ task, statuses, completionStatusId, t, onToggle, onMove }: {
  task: Task | undefined;
  statuses: ApiStatus[];
  completionStatusId: string | null;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  onToggle: () => void;
  onMove: (statusId: string) => void;
}): ContextMenuItem[] {
  if (!task) return [];
  const openItem: ContextMenuItem = { type: 'item', label: t('detail.open'), icon: <PanelRight size={14} />, onClick: () => openDetailsFromMenu(task.id) };
  if (task.type === 'note' || task.type === 'event') return [openItem, { type: 'separator' }];
  const actions = resolveStageActions(task, statuses, completionStatusId);
  const items: ContextMenuItem[] = [
    openItem,
    { type: 'item', label: task.isCompleted ? t('contextMenu.reopen') : t('contextMenu.complete'), icon: task.isCompleted ? <RotateCcw size={14} /> : <Check size={14} />, onClick: onToggle },
  ];
  if (actions.next) items.push({ type: 'item', label: t('contextMenu.moveToStage', { stage: actions.next.name }), onClick: () => onMove(actions.next!.id) });
  if (actions.accept) items.push({ type: 'item', label: t('contextMenu.accept'), onClick: () => onMove(actions.accept!.id) });
  if (actions.reject) items.push({ type: 'item', label: t('contextMenu.reject'), onClick: () => onMove(actions.reject!.id) });
  items.push({ type: 'separator' });
  return items;
}

function openDetailsFromMenu(taskId: string): void {
  const origin = document.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(taskId)}"], [data-card-id="${CSS.escape(taskId)}"]`);
  openTaskDetails(taskId, { origin, focusPanel: true });
}
