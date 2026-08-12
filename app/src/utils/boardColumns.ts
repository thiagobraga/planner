import type { ApiSection, ApiStatus, ApiTask, BoardGroupBy, BoardOrder } from '../api/client';

export type BoardColumnId = `status:${string}` | `section:${string}` | `priority:${number}`;

export interface BoardColumn {
  id: BoardColumnId;
  value: string | number | null;
  title: string;
  color?: string;
  isCompletionStatus?: boolean;
  tasks: ApiTask[];
}

interface StatusListTask {
  id: string;
  parentTaskId?: string;
  statusId?: string | null;
}

export interface StatusListGroup<T> {
  id: string;
  title: string;
  color: string;
  tasks: T[];
}

export function buildStatusListGroups<T extends StatusListTask>(
  tasks: T[],
  statuses: ApiStatus[],
  completionStatusId: string | null,
): StatusListGroup<T>[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const fallbackStatusId = statuses.find((status) => status.id !== completionStatusId)?.id ?? statuses[0]?.id;

  const rootStatusId = (task: T): string | undefined => {
    let current = task;
    const visited = new Set<string>();
    while (current.parentTaskId && !visited.has(current.id)) {
      visited.add(current.id);
      const parent = byId.get(current.parentTaskId);
      if (!parent) break;
      current = parent;
    }
    return current.statusId ?? fallbackStatusId;
  };

  return statuses.map((status) => ({
    id: status.id,
    title: status.name,
    color: status.color,
    tasks: tasks.filter((task) => rootStatusId(task) === status.id),
  }));
}

export function buildColumnId(groupBy: BoardGroupBy, value: string | number | null): BoardColumnId {
  if (groupBy === 'section') return `section:${value ?? 'none'}`;
  return `${groupBy}:${String(value)}` as BoardColumnId;
}

export function parseColumnId(columnId: string): { groupBy: BoardGroupBy; value: string | number | null } | null {
  const separator = columnId.indexOf(':');
  if (separator < 1) return null;
  const groupBy = columnId.slice(0, separator);
  const rawValue = columnId.slice(separator + 1);
  if (groupBy === 'status' && rawValue) return { groupBy, value: rawValue };
  if (groupBy === 'section' && rawValue) return { groupBy, value: rawValue === 'none' ? null : rawValue };
  if (groupBy === 'priority' && /^[1-4]$/.test(rawValue)) return { groupBy, value: Number(rawValue) };
  return null;
}

interface BuildColumnsInput {
  groupBy: BoardGroupBy;
  tasks: ApiTask[];
  statuses: ApiStatus[];
  completionStatusId: string | null;
  sections: ApiSection[];
  boardOrder: BoardOrder;
  noSectionTitle: string;
  priorityTitle: (priority: number) => string;
}

function sortTasks(tasks: ApiTask[], positions?: Record<string, number>) {
  return [...tasks].sort((a, b) => {
    const aOrder = positions?.[a.id] ?? a.orderValue;
    const bOrder = positions?.[b.id] ?? b.orderValue;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
  });
}

export function buildColumns(input: BuildColumnsInput): BoardColumn[] {
  const rootTasks = input.tasks.filter((task) => !task.parentTaskId);

  if (input.groupBy === 'status') {
    return [...input.statuses]
      .sort((a, b) => a.orderValue - b.orderValue)
      .map((status) => ({
        id: buildColumnId('status', status.id),
        value: status.id,
        title: status.name,
        color: status.color,
        isCompletionStatus: status.id === input.completionStatusId,
        tasks: sortTasks(rootTasks.filter((task) => task.statusId === status.id), input.boardOrder.status),
      }));
  }

  if (input.groupBy === 'section') {
    const definitions = [
      { id: null, name: input.noSectionTitle, orderValue: -1 },
      ...input.sections.map((section) => ({ id: section.id, name: section.name, orderValue: section.orderValue })),
    ];
    return definitions
      .sort((a, b) => a.orderValue - b.orderValue)
      .map((section) => ({
        id: buildColumnId('section', section.id),
        value: section.id,
        title: section.name,
        tasks: sortTasks(rootTasks.filter((task) => (task.sectionId ?? null) === section.id)),
      }));
  }

  return [1, 2, 3, 4].map((priority) => ({
    id: buildColumnId('priority', priority),
    value: priority,
    title: input.priorityTitle(priority),
    tasks: sortTasks(rootTasks.filter((task) => task.priority === priority), input.boardOrder.priority),
  }));
}
