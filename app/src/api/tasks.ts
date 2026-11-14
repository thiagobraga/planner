import { request, ApiError } from './transport';
import type { ApiDailyView } from '../types/daily';
import type { ApiSection, ApiStatus, ApiTask, BoardOrder, ReorganizeMove, TaskMoveInput, TaskMoveResponse } from '../types/api';
import type { ParsedDateInput, TaskSchedule } from '../types/task';

// Tasks ---------------------------------------------------------------------

export async function fetchInboxTasks(): Promise<{
  tasks: ApiTask[];
  collectionId: string | null;
  inboxCollectionId?: string;
  sections: ApiSection[];
  statuses: ApiStatus[];
  completionStatusId: string | null;
  boardOrder: BoardOrder;
}> {
  return request('/views/inbox');
}

export async function fetchDaily(from: string, to: string): Promise<ApiDailyView> {
  return request(`/daily/${from}/${to}`);
}

export async function apiParseDate(q: string, locale: 'en' | 'pt-BR', signal?: AbortSignal): Promise<ParsedDateInput | null> {
  const params = new URLSearchParams({ q, locale });
  try {
    return await request<ParsedDateInput>(`/dates/parse?${params}`, { signal });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function apiCreateTask(input: {
  title: string;
  priority?: number;
  collectionId?: string;
  sectionId?: string | null;
  dueDate?: string;
  parentTaskId?: string;
  depth?: number;
  type?: 'task' | 'note' | 'event';
  recurrenceRule?: object | null;
  orderValue?: number;
}): Promise<ApiTask> {
  return request<ApiTask>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiUpdateTask(
  id: string,
  updates: Partial<Pick<ApiTask, 'title' | 'priority' | 'depth' | 'type' | 'collectionId' | 'sectionId'>> &
    Partial<TaskSchedule> & {
      parentTaskId?: string | null;
      dueTimezone?: string | null;
      deadlineTimezone?: string | null;
    },
): Promise<ApiTask> {
  return request<ApiTask>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function apiToggleTask(id: string, isCompleted: boolean): Promise<ApiTask> {
  return request<ApiTask>(`/tasks/${id}/${isCompleted ? 'complete' : 'reopen'}`, {
    method: 'POST',
  });
}

export async function apiDeleteTask(id: string): Promise<void> {
  await request<unknown>(`/tasks/${id}`, { method: 'DELETE' });
}

// Structural moves -----------------------------------------------------------
//
// A move is deliberately separate from `apiUpdateTask`. Update patches a task's
// own fields; move rewrites tree position, list membership and the ordering of
// everything around it, and must do so in one transaction. The legacy
// `PATCH /tasks/:id/reorder` stays live for older clients but is unused here.

export async function apiMoveTask(id: string, input: TaskMoveInput): Promise<TaskMoveResponse> {
  return request<TaskMoveResponse>(`/tasks/${id}/move`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function apiReorganizeTasks(moves: ReorganizeMove[]): Promise<{ updated: number }> {
  return request<{ updated: number }>('/tasks/reorganize', {
    method: 'POST',
    body: JSON.stringify({ moves }),
  });
}
