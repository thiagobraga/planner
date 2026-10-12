import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, act, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DailyRoute } from '../DailyRoutes';
import { dailyView } from '../../test/dailyFixtures';
import { typeText } from '../../test/editableText';
import { I18nProvider } from '../../i18n/I18nContext';
import {
  apiCreateTask,
  fetchDaily,
  fetchPreferences,
  fetchCollections,
  type ApiTask,
  type Preferences,
  type ApiCollection,
} from '../../api/client';

const mockFetchDaily = vi.mocked(fetchDaily);
const mockFetchPreferences = vi.mocked(fetchPreferences);
const mockFetchCollections = vi.mocked(fetchCollections);
const mockApiCreateTask = vi.mocked(apiCreateTask);
const taskListMock = vi.hoisted(() =>
  vi.fn(({ tasks }: { tasks: { id: string; title: string; labels?: unknown[] }[] }) => (
    <div data-testid="task-list">
      {tasks.map((t) => (
        <div key={t.id} data-testid={`task-${t.id}`}>
          {t.title}
        </div>
      ))}
    </div>
  )),
);

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
  showNotes: true,
};

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchDaily: vi.fn(),
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
  TaskList: taskListMock,
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
    color: '#65788a',
    isInbox: false,
    isArchived: false,
    orderValue: 0,
    createdAt: '',
    updatedAt: '',
  },
];

function renderPage(slug = 'list') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={[`/daily/${slug}`]}>
          <Routes><Route path="/daily/:view" element={<DailyRoute />} /></Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockFetchDaily.mockResolvedValue(dailyView({ overdue: [overdueTask], today: [todayTask] }));
  mockFetchPreferences.mockResolvedValue(basePreferences);
  mockFetchCollections.mockResolvedValue(mockCollections);
  taskListMock.mockClear();
});

describe('DailyPage', () => {
  it('renders header with "Daily" title and controls', async () => {
    renderPage();

    const title = await screen.findByText('Daily');
    const header = title.closest('header');

    expect(header).toBeInTheDocument();
    expect(header).toContainElement(screen.getByRole('button', { name: 'List' }));
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByRole('menu')).not.toContainElement(screen.getByRole('button', { name: 'List' }));
    expect(within(screen.getByRole('menu')).queryByText('View')).not.toBeInTheDocument();
    expect(header).toContainElement(screen.getByRole('checkbox', { name: 'Completed tasks' }));
    expect(header).toContainElement(screen.getByRole('checkbox', { name: 'Notes' }));
    expect(screen.queryByRole('checkbox', { name: 'Next days' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'List' }).closest('.page-header-toolbar')).toBeInTheDocument();
  });

  it('groups tasks from earlier days under Migrate', async () => {
    renderPage();

    expect(await screen.findByText('Migrate')).toBeInTheDocument();
    expect(screen.queryByText(dayLabel(yesterday))).not.toBeInTheDocument();
  });

  it('renders "Add task" input', async () => {
    const { container } = renderPage();
    await screen.findByText('Today task');

    const todaySection = container.querySelector<HTMLElement>(`[data-day-date="${todayKey}"]`)!;
    expect(within(todaySection).getByRole('textbox', { name: 'New task…' })).toBeInTheDocument();
  });

  it('creates the typed task for today when the field loses focus', async () => {
    mockApiCreateTask.mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    await screen.findByText('Today task');

    const todaySection = container.querySelector<HTMLElement>(`[data-day-date="${todayKey}"]`)!;
    const input = within(todaySection).getByRole('textbox', { name: 'New task…' });
    typeText(input, 'Water plants');
    fireEvent.blur(input);

    expect(mockApiCreateTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Water plants', type: 'task', dueDate: todayKey }));
    expect(input).toBeEmptyDOMElement();
  });

  it('renders add-task fields as contenteditable text, not form inputs', async () => {
    renderPage();

    const inputs = await screen.findAllByRole('textbox', { name: 'New task…' });
    for (const input of inputs) expect(input).toHaveAttribute('contenteditable', 'plaintext-only');
  });

  it('preserves structured labels in the daily task mapper', async () => {
    mockFetchDaily.mockResolvedValue(dailyView({
      overdue: [
        {
          ...overdueTask,
          labels: [{ id: 'label-1', name: 'feature', color: '#7dbfb2' }],
        },
      ],
      today: [todayTask],
    }));

    renderPage();

    await screen.findByText('Overdue task');
    const overdueCall = taskListMock.mock.calls.find(([props]) =>
      props.tasks.some((task) => task.id === 'task-overdue-1'),
    );

    expect(overdueCall?.[0].tasks[0].labels).toEqual([
      { id: 'label-1', name: 'feature', color: '#7dbfb2' },
    ]);
  });

  it('triggers refetch and scrolls to today section when midnight timer fires', async () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(today);
      renderPage();

      await screen.findByText('Today task');
      const callsBeforeMidnight = mockFetchDaily.mock.calls.length;

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      vi.setSystemTime(tomorrow);
      expect(capturedMidnightCb).toBeTypeOf('function');
      await act(async () => { capturedMidnightCb!(); });

      expect(mockFetchDaily.mock.calls.length).toBeGreaterThan(callsBeforeMidnight);
      expect(scrollIntoViewMock).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the "Add task" input on the new day after midnight rolls over', async () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(today);
      renderPage();
      expect((await screen.findAllByRole('textbox', { name: 'New task…' })).length).toBeGreaterThan(0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      vi.setSystemTime(tomorrow);
      mockFetchDaily.mockResolvedValue(dailyView({ overdue: [], today: [] }));
      await act(async () => { capturedMidnightCb!(); });

      await waitFor(() => expect(document.querySelector(`[data-day-date="${dateKey(tomorrow)}"] [role="textbox"]`)).toBeInTheDocument());
    } finally {
      vi.useRealTimers();
    }
  });
});
