import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DailyPage } from '../DailyPage';
import { I18nProvider } from '../../i18n/I18nContext';
import {
  fetchTodayTasks,
  fetchPreferences,
  fetchCollections,
  type ApiTask,
  type Preferences,
  type ApiCollection,
} from '../../api/client';

const mockFetchTodayTasks = vi.mocked(fetchTodayTasks);
const mockFetchPreferences = vi.mocked(fetchPreferences);
const mockFetchCollections = vi.mocked(fetchCollections);

const basePreferences: Preferences = {
  userId: 'user-1',
  locale: 'en',
  timeZone: 'UTC',
  weekStart: 'monday',
  theme: 'light',
  notificationsEnabled: true,
  font: 'lora',
  showDots: true,
  background: 'beige',
  smallCaps: false,
  hideCompletedTasks: false,
  hideOldNotes: false,
};

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchTodayTasks: vi.fn(),
  fetchPreferences: vi.fn(),
  fetchCollections: vi.fn(),
  apiCreateTask: vi.fn(),
  apiToggleTask: vi.fn(),
  apiUpdateTask: vi.fn(),
  apiDeleteTask: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock('../../hooks/useTaskDrag', () => ({
  useTaskDrag: () => ({ activeDragId: null }),
}));

vi.mock('../../hooks/useSync', () => ({
  useSync: vi.fn(),
}));

let capturedMidnightCb: (() => void) | null = null;
vi.mock('../../hooks/useMidnightTimer', () => ({
  useMidnightTimer: vi.fn((cb) => {
    capturedMidnightCb = cb;
  }),
}));

vi.mock('../../components/TaskList', () => ({
  TaskList: ({ tasks }: { tasks: { id: string; title: string }[] }) => (
    <div data-testid="task-list">
      {tasks.map((t) => (
        <div key={t.id} data-testid={`task-${t.id}`}>
          {t.title}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../../utils/phrases', () => ({
  getPhrase: () => 'Make today count',
}));

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);

function dateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayLabel(d: Date, locale: 'en' | 'pt-BR' = 'en'): string {
  const month = d.toLocaleDateString(locale, { month: 'short' }).replace(/\./g, '').toUpperCase();
  const day = String(d.getDate()).padStart(2, '0');
  const weekday = d.toLocaleDateString(locale, { weekday: 'short' }).replace(/\./g, '').toUpperCase();
  return `${month} ${day} ${weekday}`;
}

const todayKey = dateKey(today);
const yesterdayKey = dateKey(yesterday);

const overdueTask: ApiTask = {
  id: 'task-overdue-1',
  title: 'Overdue task',
  priority: 4,
  collectionId: 'col-1',
  isCompleted: false,
  orderValue: 0,
  depth: 0,
  type: 'task',
  dueDate: yesterdayKey,
};

const todayTask: ApiTask = {
  id: 'task-today-1',
  title: 'Today task',
  priority: 4,
  collectionId: 'col-1',
  isCompleted: false,
  orderValue: 0,
  depth: 0,
  type: 'task',
  dueDate: todayKey,
  createdAt: new Date().toISOString(),
};

const mockCollections: ApiCollection[] = [
  {
    id: 'col-1',
    userId: 'user-1',
    parentId: null,
    name: 'Work',
    color: 'blue',
    isInbox: false,
    isArchived: false,
    orderValue: 0,
    createdAt: '',
    updatedAt: '',
  },
];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter>
          <DailyPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockFetchTodayTasks.mockResolvedValue({ overdue: [overdueTask], today: [todayTask] });
  mockFetchPreferences.mockResolvedValue(basePreferences);
  mockFetchCollections.mockResolvedValue(mockCollections);
});

describe('DailyPage', () => {
  it('renders header with "Daily" title and phrase', async () => {
    renderPage();

    const title = await screen.findByText('Daily');
    const header = title.closest('header');

    expect(header).toBeInTheDocument();
    expect(header).toContainElement(screen.getByText('Make today count'));
    expect(header).not.toContainElement(screen.getByRole('button', { name: 'Today' }));
    expect(header).not.toContainElement(screen.getByRole('button', { name: 'Hide completed tasks' }));
    expect(header).not.toContainElement(screen.getByRole('button', { name: 'Hide old notes' }));
    expect(screen.getByRole('button', { name: 'Today' }).closest('.page-header-toolbar')).toHaveClass('sticky');
  });

  it('renders overdue section label', async () => {
    renderPage();

    const overdueLabel = dayLabel(yesterday);
    expect(await screen.findByText(overdueLabel)).toBeInTheDocument();
  });

  it('removes dots from Portuguese month and weekday labels', async () => {
    window.localStorage.setItem('planner_locale', 'pt-BR');

    renderPage();

    const overdueLabel = dayLabel(yesterday, 'pt-BR');
    expect(await screen.findByText(overdueLabel)).toBeInTheDocument();
    expect(overdueLabel).not.toContain('.');
  });

  it('renders "Add task" input', async () => {
    renderPage();

    expect(await screen.findByPlaceholderText('Add task…')).toBeInTheDocument();
  });

  it('triggers refetch and scrolls to today section when midnight timer fires', async () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    renderPage();

    await screen.findByText('Daily');
    expect(mockFetchTodayTasks).toHaveBeenCalledTimes(1);

    expect(capturedMidnightCb).toBeTypeOf('function');
    capturedMidnightCb!();

    expect(mockFetchTodayTasks).toHaveBeenCalledTimes(2);
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });
});
