import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DailyPage } from '../DailyPage';
import { I18nProvider } from '../../i18n/I18nContext';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
import {
  fetchTodayTasks,
  fetchPreferences,
  fetchCollections,
  fetchInboxTasks,
  apiCreateTask,
  apiUpdatePreferences,
  type ApiTask,
  type Preferences,
} from '../../api/client';

const mockFetchTodayTasks = vi.mocked(fetchTodayTasks);
const mockFetchPreferences = vi.mocked(fetchPreferences);
const mockFetchCollections = vi.mocked(fetchCollections);
const mockApiUpdatePreferences = vi.mocked(apiUpdatePreferences);

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchTodayTasks: vi.fn(),
  fetchPreferences: vi.fn(),
  fetchCollections: vi.fn(),
  apiToggleTask: vi.fn(),
  apiCreateTask: vi.fn(),
  apiUpdatePreferences: vi.fn(),
  fetchInboxTasks: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock('../../hooks/useSync', () => ({
  useSync: vi.fn(),
}));

vi.mock('../../hooks/useMidnightTimer', () => ({
  useMidnightTimer: vi.fn(),
}));

vi.mock('../../components/TaskList', () => ({
  TaskList: ({ tasks }: { tasks: { id: string; title: string }[] }) => (
    <div data-testid="task-list">
      {tasks.map((t) => (
        <div key={t.id}>{t.title}</div>
      ))}
    </div>
  ),
}));

vi.mock('../../utils/phrases', () => ({
  getPhrase: () => 'Make today count',
}));

function dateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const inSevenDays = new Date(today);
inSevenDays.setDate(inSevenDays.getDate() + 7);

const todayKey = dateKey(today);
const yesterdayKey = dateKey(yesterday);
const inSevenDaysKey = dateKey(inSevenDays);

const basePreferences: Preferences = {
  userId: 'user-1',
  locale: 'en',
  timeZone: 'UTC',
  weekStart: 'sunday',
  theme: 'light',
  notificationsEnabled: true,
  font: 'lora',
  showDots: true,
  background: 'beige',
  smallCaps: false,
  hideCompletedTasks: false,
  showNotes: true,
};

const overdueTask: ApiTask = {
  id: 'task-overdue', title: 'Overdue task', priority: 4, collectionId: 'col-1',
  isCompleted: false, orderValue: 0, depth: 0, type: 'task', dueDate: yesterdayKey,
};
const todayTask: ApiTask = {
  id: 'task-today', title: 'Today task', priority: 4, collectionId: 'col-1',
  isCompleted: false, orderValue: 0, depth: 0, type: 'task', dueDate: todayKey,
};
const noDateTask: ApiTask = {
  id: 'task-no-date', title: 'No date task', priority: 4, collectionId: 'col-1',
  isCompleted: false, orderValue: 0, depth: 0, type: 'task',
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter>
          <PlannerDragProvider>
            <DailyPage />
          </PlannerDragProvider>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

function openToolbarMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'More options' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockFetchPreferences.mockResolvedValue(basePreferences);
  mockFetchCollections.mockResolvedValue([]);
  mockApiUpdatePreferences.mockImplementation(async (patch) => ({ ...basePreferences, ...patch }));
  vi.mocked(fetchInboxTasks).mockResolvedValue({ tasks: [overdueTask, todayTask, noDateTask], collectionId: null, sections: [], statuses: [], completionStatusId: null, boardOrder: { status: {}, priority: {} } });
  mockFetchTodayTasks.mockResolvedValue({
    overdue: [overdueTask],
    today: [todayTask],
  });
});

describe('DailyPage week kanban view', () => {
  it('opens an inline card and creates a task with the selected day', async () => {
    vi.mocked(apiCreateTask).mockResolvedValue({ ...todayTask, id: 'created', title: 'Plan the day' });
    const { container } = renderPage();
    await screen.findByText('Today task');
    openToolbarMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Kanban cards' }));
    await screen.findByTestId('daily-week-board');
    const column = within(container.querySelector(`[data-column-id="day:${todayKey}"]`)! as HTMLElement);
    fireEvent.click(column.getByRole('button', { name: 'Add task' }));
    const input = column.getByRole('textbox', { name: 'Task title' });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: 'Plan the day' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(apiCreateTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Plan the day', dueDate: todayKey })));
    expect(await column.findByRole('heading', { name: 'Plan the day' })).toBeInTheDocument();
    expect(screen.queryByText('Drop work here')).not.toBeInTheDocument();
  });

  it('cancels a draft without creating an empty task and keeps failed drafts for retry', async () => {
    vi.mocked(apiCreateTask).mockRejectedValue(new Error('Unavailable'));
    const { container } = renderPage();
    await screen.findByText('Today task');
    openToolbarMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Kanban cards' }));
    await screen.findByTestId('daily-week-board');
    const column = within(container.querySelector('[data-column-id="migrate"]')! as HTMLElement);
    fireEvent.click(column.getByRole('button', { name: 'Add task' }));
    fireEvent.keyDown(column.getByRole('textbox'), { key: 'Escape' });
    expect(column.queryByRole('textbox')).not.toBeInTheDocument();
    expect(apiCreateTask).not.toHaveBeenCalled();
    fireEvent.click(column.getByRole('button', { name: 'Add task' }));
    const input = column.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Undated task' } });
    fireEvent.submit(input.closest('form')!);
    expect(await column.findByRole('alert')).toHaveTextContent('Could not add task');
    expect(input).toHaveValue('Undated task');
    expect(apiCreateTask).toHaveBeenCalledWith(expect.objectContaining({ dueDate: undefined }));
  });

  it('switches to the week board when Kanban is picked from the VIEW row, hiding the chronological list', async () => {
    renderPage();
    await screen.findByText('Today task');

    openToolbarMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Kanban cards' }));

    expect(await screen.findByTestId('daily-week-board')).toBeInTheDocument();
    expect(screen.queryByTestId('task-list')).not.toBeInTheDocument();
  });

  it('keeps Migrate scoped to Daily tasks while still showing scheduled tasks in their day column', async () => {
    const { container } = renderPage();
    await screen.findByText('Today task');

    openToolbarMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Kanban cards' }));
    await screen.findByTestId('daily-week-board');

    const migrateColumn = container.querySelector('[data-column-id="migrate"]');
    const todayColumn = container.querySelector(`[data-column-id="day:${todayKey}"]`);

    expect(migrateColumn).toHaveTextContent('Overdue task');
    expect(migrateColumn).not.toHaveTextContent('No date task');
    expect(todayColumn).toHaveTextContent('Today task');
  });

  it('restores the saved board view for Daily', async () => {
    window.localStorage.setItem('planner.boardViews.v1', JSON.stringify({ daily: 'kanban' }));
    renderPage();

    expect(await screen.findByTestId('daily-week-board')).toBeInTheDocument();
  });

  it('uses the selected date display in week column titles', async () => {
    mockFetchPreferences.mockResolvedValue({ ...basePreferences, dateFormat: 'YYYY-MM-DD' });
    window.localStorage.setItem('planner.boardViews.v1', JSON.stringify({ daily: 'kanban' }));
    renderPage();

    const heading = await screen.findByRole('heading', { name: `${todayKey} · Today`, exact: true });
    expect(heading).toHaveClass('daily-board-column-title');
  });

  it('opens page options when the empty Daily area is right-clicked', async () => {
    const { container } = renderPage();
    await screen.findByText('Today task');

    fireEvent.contextMenu(container.querySelector('.daily-page')!, { clientX: 100, clientY: 100 });

    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'List' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Kanban lists' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Kanban cards' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Next days/ })).toBeInTheDocument();
  });

  it('moves the visible week forward when the next-week arrow is clicked', async () => {
    const { container } = renderPage();
    await screen.findByText('Today task');

    openToolbarMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Kanban cards' }));
    await screen.findByTestId('daily-week-board');

    expect(container.querySelector(`[data-column-id="day:${todayKey}"]`)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));

    expect(container.querySelector(`[data-column-id="day:${todayKey}"]`)).toBeNull();
    expect(container.querySelector(`[data-column-id="day:${inSevenDaysKey}"]`)).not.toBeNull();
  });
});
