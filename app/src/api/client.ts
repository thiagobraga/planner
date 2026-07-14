const BASE = '/api/v1';

export function getToken(): string | null {
  return localStorage.getItem('planner_token');
}

export function setToken(token: string) {
  localStorage.setItem('planner_token', token);
}

export function clearToken() {
  localStorage.removeItem('planner_token');
}

export function hasToken(): boolean {
  return !!getToken();
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    if (res.status === 401) clearToken();
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export async function apiRegister(email: string, password: string, displayName: string): Promise<AuthUser> {
  const data = await request<{ user: AuthUser; token: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  });
  setToken(data.token);
  return data.user;
}

export async function apiLogin(email: string, password: string): Promise<AuthUser> {
  const data = await request<{ user: AuthUser; token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data.user;
}

export function apiLogout() {
  clearToken();
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export interface ApiTask {
  id: string;
  title: string;
  description?: string;
  priority: number;
  projectId: string;
  sectionId?: string;
  parentTaskId?: string;
  dueDate?: string;
  isCompleted: boolean;
  orderValue: number;
  depth?: number;
  type: 'task' | 'note';
  createdAt?: string;
}

export interface Preferences {
  userId: string;
  timeZone: string;
  weekStart: 'sunday' | 'monday';
  theme: 'light' | 'dark' | 'system';
  notificationsEnabled: boolean;
  font: 'lora' | 'playpen' | 'hubballi';
  showDots: boolean;
  background: 'beige' | 'white';
  smallCaps: boolean;
}

export async function fetchInboxTasks(): Promise<{ tasks: ApiTask[]; projectId: string | null }> {
  return request('/views/inbox');
}

export async function fetchTodayTasks(): Promise<{ overdue: ApiTask[]; today: ApiTask[] }> {
  return request('/views/today');
}

export async function fetchUpcomingTasks(): Promise<Array<{ date: string; tasks: ApiTask[] }>> {
  return request('/views/upcoming');
}

export async function fetchMonthNotes(year: number, month: number): Promise<{
  notesByDate: Record<string, ApiTask[]>;
  year: number;
  month: number;
}> {
  return request(`/views/month?year=${year}&month=${month}`);
}

export async function fetchPreferences(): Promise<Preferences> {
  return request<Preferences>('/preferences');
}

export async function apiUpdatePreferences(patch: Partial<Preferences>): Promise<Preferences> {
  return request<Preferences>('/preferences', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function apiCreateTask(input: {
  title: string;
  priority?: number;
  projectId?: string;
  dueDate?: string;
  parentTaskId?: string;
  depth?: number;
  type?: 'task' | 'note';
}): Promise<ApiTask> {
  return request<ApiTask>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiUpdateTask(
  id: string,
  updates: Partial<Pick<ApiTask, 'title' | 'priority' | 'dueDate' | 'depth' | 'type'>> & {
    // `null` promotes the task to the top level (unparent); backend derives depth.
    parentTaskId?: string | null;
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

// ── Projects ────────────────────────────────────────────────────────────────

export interface ApiProject {
  id: string;
  userId: string;
  parentId: string | null;
  name: string;
  color: string;
  isInbox: boolean;
  isArchived: boolean;
  orderValue: number;
  createdAt: string;
  updatedAt: string;
}

// Named palette accepted by the API, mapped to display hex values.
export const PROJECT_COLORS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'berry_red', hex: '#b8255f' },
  { name: 'red', hex: '#db4035' },
  { name: 'orange', hex: '#ff9933' },
  { name: 'yellow', hex: '#fad000' },
  { name: 'olive_green', hex: '#afb83b' },
  { name: 'lime_green', hex: '#7ecc49' },
  { name: 'green', hex: '#299438' },
  { name: 'mint_green', hex: '#6accbc' },
  { name: 'teal', hex: '#158fad' },
  { name: 'sky_blue', hex: '#14aaf5' },
  { name: 'light_blue', hex: '#96c3eb' },
  { name: 'blue', hex: '#4073ff' },
  { name: 'grape', hex: '#884dff' },
  { name: 'violet', hex: '#af38eb' },
  { name: 'lavender', hex: '#eb96eb' },
  { name: 'magenta', hex: '#e05194' },
  { name: 'salmon', hex: '#ff8d85' },
  { name: 'charcoal', hex: '#808080' },
  { name: 'grey', hex: '#b8b8b8' },
  { name: 'taupe', hex: '#ccac93' },
];

const PROJECT_COLOR_HEX = new Map(PROJECT_COLORS.map((c) => [c.name, c.hex]));

export function projectColorHex(name: string | undefined): string {
  return (name && PROJECT_COLOR_HEX.get(name)) || 'var(--color-ink-light)';
}

export async function fetchProjects(): Promise<ApiProject[]> {
  return request('/projects');
}

export async function apiCreateProject(input: {
  name: string;
  color: string;
  parentId?: string | null;
}): Promise<ApiProject> {
  return request<ApiProject>('/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiUpdateProject(
  id: string,
  updates: Partial<Pick<ApiProject, 'name' | 'color' | 'parentId' | 'orderValue'>>,
): Promise<ApiProject> {
  return request<ApiProject>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function apiDeleteProject(id: string): Promise<void> {
  await request<unknown>(`/projects/${id}`, { method: 'DELETE' });
}

export async function apiArchiveProject(id: string): Promise<ApiProject> {
  return request<ApiProject>(`/projects/${id}/archive`, { method: 'POST' });
}

export interface ProjectView {
  project: { id: string; name: string; color: string; isInbox: boolean };
  tasks: ApiTask[];
  projectId: string;
}

export async function fetchProjectView(id: string): Promise<ProjectView> {
  return request<ProjectView>(`/views/project/${id}`);
}

// ── Habits ───────────────────────────────────────────────────────────────────

export interface ApiHabit {
  id: string;
  name: string;
  note?: string;
  orderValue: number;
  completions: string[]; // ISO dates (YYYY-MM-DD), last 12 weeks
}

export async function fetchHabits(): Promise<ApiHabit[]> {
  return request('/habits');
}

export async function apiCreateHabit(input: { name: string; note?: string }): Promise<ApiHabit> {
  return request<ApiHabit>('/habits', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiUpdateHabit(
  id: string,
  updates: { name?: string; note?: string | null; orderValue?: number },
): Promise<ApiHabit> {
  return request<ApiHabit>(`/habits/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function apiDeleteHabit(id: string): Promise<void> {
  await request<unknown>(`/habits/${id}`, { method: 'DELETE' });
}

export async function apiToggleHabitCompletion(
  id: string,
  date: string,
  isCompleted: boolean,
): Promise<{ habitId: string; date: string; isCompleted: boolean }> {
  return request(`/habits/${id}/completions`, {
    method: 'PUT',
    body: JSON.stringify({ date, isCompleted }),
  });
}
