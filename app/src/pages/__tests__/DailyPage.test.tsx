import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyPage } from '../DailyPage';
import { fetchCollections, fetchDailyTimeline, fetchPreferences, type ApiTask, type Preferences } from '../../api/client';

const mockFetchDailyTimeline = vi.mocked(fetchDailyTimeline);
const mockFetchPreferences = vi.mocked(fetchPreferences);
const mockFetchCollections = vi.mocked(fetchCollections);

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchDailyTimeline: vi.fn(),
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

vi.mock('../../hooks/useSync', () => ({
  useSync: vi.fn(),
}));

let capturedMidnightCb: (() => void) | null = null;
vi.mock('../../hooks/useMidnightTimer', () => ({
  useMidnightTimer: vi.fn((cb) => {
    capturedMidnightCb = cb;
  }),
}));

vi.mock('../../hooks/useTaskDrag', () => ({
  useTaskDrag: () => ({ activeDragId: null }),
}));

vi.mock('../../components/TaskList', () => ({
  TaskList: ({
    tasks,
    onTaskToggle,
  }: {
    tasks: Array<{ id: string; title: string; isCompleted?: boolean }>;
    onTaskToggle?: (id: string) => void;
  }) => (
    <div data-testid="task-list">
      {tasks.map((task) => (
        <div key={task.id}>
          <span>{task.title}</span>
          {onTaskToggle && (
            <button
              type="button"
              aria-label={`${task.isCompleted ? 'Reopen' : 'Complete'}: ${task.title}`}
              onClick={() => onTaskToggle(task.id)}
            />
          )}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../../components/CalendarWidget', () => ({
  CalendarWidget: () => <div data-testid="calendar-widget" />,
}));

vi.mock('../../components/VirtualDay', () => ({
  VirtualDay: ({
    date,
    children,
    keepMounted = false,
    className = '',
  }: {
    date: string;
    children: ReactNode;
    keepMounted?: boolean;
    className?: string;
  }) => (
    <div
      id={`daily-day-${date}`}
      data-testid="virtual-day"
      data-date={date}
      data-keep-mounted={String(keepMounted)}
      className={className}
    >
      {children}
    </div>
  ),
}));

vi.mock('../../utils/phrases', () => ({
  getPhrase: () => 'Make today count',
}));

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
  hideOldNotes: false,
};

function fmtISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number): string {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return fmtISO(next);
}

const today = fmtISO(new Date());
const initialStart = addDays(new Date(), -14);
const futureStart = addDays(new Date(), 1);
const futureEnd = addDays(new Date(), 15);

function task(id: string, title: string, dueDate: string, isCompleted = false): ApiTask {
  return {
    id,
    title,
    priority: 4,
    collectionId: 'collection-1',
    isCompleted,
    orderValue: 0,
    type: 'task',
    dueDate,
    createdAt: `${dueDate}T12:00:00Z`,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DailyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  capturedMidnightCb = null;
  mockFetchDailyTimeline.mockReset();
  mockFetchPreferences.mockReset();
  mockFetchCollections.mockReset();

  mockFetchPreferences.mockResolvedValue(basePreferences);
  mockFetchCollections.mockResolvedValue([]);
});

describe('DailyPage', () => {
  it('renders header with "Daily" title and phrase', async () => {
    mockFetchDailyTimeline.mockResolvedValue({
      start: initialStart,
      end: today,
      days: [
        { date: today, tasks: [] },
      ],
    });

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

  it('renders the timeline in descending future, today, and past order on first load', async () => {
    mockFetchDailyTimeline
      .mockResolvedValueOnce({
        start: initialStart,
        end: today,
        days: [
          { date: '2026-07-24', tasks: [task('task-past', 'Past task', '2026-07-24')] },
          { date: today, tasks: [task('task-today', 'Today task', today)] },
        ],
      })
      .mockResolvedValueOnce({
        start: futureStart,
        end: futureEnd,
        days: [
          { date: '2026-07-27', tasks: [task('task-future', 'Future task', '2026-07-27')] },
        ],
      });

    renderPage();

    await screen.findByText('Future task');

    expect(mockFetchDailyTimeline).toHaveBeenNthCalledWith(1, initialStart, today);
    expect(mockFetchDailyTimeline).toHaveBeenNthCalledWith(2, futureStart, futureEnd);
    expect([...screen.getAllByTestId('virtual-day')].map((node) => node.getAttribute('data-date'))).toEqual([
      '2026-07-27',
      today,
      '2026-07-24',
    ]);
  });

  it('renders "Add task" input', async () => {
    mockFetchDailyTimeline.mockResolvedValue({
      start: initialStart,
      end: today,
      days: [{ date: today, tasks: [] }],
    });

    renderPage();

    expect(await screen.findByPlaceholderText('Add task…')).toBeInTheDocument();
  });

  it('triggers refetch and scrolls to today section when midnight timer fires', async () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    mockFetchDailyTimeline.mockResolvedValue({
      start: initialStart,
      end: futureEnd,
      days: [{ date: today, tasks: [] }],
    });

    renderPage();

    await screen.findByText('Daily');
    await waitFor(() => expect(mockFetchDailyTimeline).toHaveBeenCalledTimes(2));

    expect(capturedMidnightCb).toBeTypeOf('function');
    act(() => capturedMidnightCb!());

    await waitFor(() => expect(mockFetchDailyTimeline).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(scrollIntoViewMock).toHaveBeenCalled());
  });
});
