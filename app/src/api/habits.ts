import { request } from './transport';
import type { ApiHabit, ApiHabitGroup, HabitGroupMoveInput, HabitGroupMoveResponse, HabitMoveInput, HabitMoveResponse, HabitsResponse } from '../types/api';

// Habits -------------------------------------------------------------------

export async function fetchHabits(): Promise<HabitsResponse> {
  return request('/habits');
}

export async function apiCreateHabit(input: {
  name: string;
  parentId?: string | null;
  groupId?: string | null;
}): Promise<ApiHabit> {
  return request<ApiHabit>('/habits', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiUpdateHabit(
  id: string,
  updates: { name?: string; parentId?: string | null; groupId?: string | null; orderValue?: number },
): Promise<ApiHabit> {
  return request<ApiHabit>(`/habits/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function apiDeleteHabit(id: string): Promise<void> {
  await request<unknown>(`/habits/${id}`, { method: 'DELETE' });
}

export async function apiArchiveHabit(id: string): Promise<void> {
  await request<unknown>(`/habits/${id}/archive`, { method: 'POST' });
}

// A leaf completion stays a single-item response. A parent completion resolves
// its sub-habits server-side and returns one result per affected child.
export async function apiToggleHabitCompletion(
  id: string,
  date: string,
  isCompleted: boolean,
): Promise<
  | { habitId: string; date: string; isCompleted: boolean }
  | { habitId: string; date: string; isCompleted: boolean }[]
> {
  return request(`/habits/${id}/completions`, {
    method: 'PUT',
    body: JSON.stringify({ date, isCompleted }),
  });
}

export async function fetchHabitGroups(): Promise<ApiHabitGroup[]> {
  return request('/habit-groups');
}

export async function apiCreateHabitGroup(input: { name: string }): Promise<ApiHabitGroup> {
  return request<ApiHabitGroup>('/habit-groups', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiUpdateHabitGroup(
  id: string,
  updates: { name?: string; icon?: string | null; orderValue?: number },
): Promise<ApiHabitGroup> {
  return request<ApiHabitGroup>(`/habit-groups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// Habits in the group are ungrouped, not deleted.
export async function apiDeleteHabitGroup(id: string): Promise<void> {
  await request<unknown>(`/habit-groups/${id}`, { method: 'DELETE' });
}

export async function apiArchiveHabitGroup(id: string): Promise<void> {
  await request<unknown>(`/habit-groups/${id}/archive`, { method: 'POST' });
}

// Habit structural moves -----------------------------------------------------

export async function apiMoveHabit(id: string, input: HabitMoveInput): Promise<HabitMoveResponse> {
  return request<HabitMoveResponse>(`/habits/${id}/move`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function apiMoveHabitGroup(
  id: string,
  input: HabitGroupMoveInput,
): Promise<HabitGroupMoveResponse> {
  return request<HabitGroupMoveResponse>(`/habit-groups/${id}/move`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
