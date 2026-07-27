import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyPage } from '../DailyPage';
import { fetchCollections, fetchDailyTimeline, fetchPreferences, apiToggleTask, apiUpdatePreferences } from '../../api/client';

const mockFetchDailyTimeline = vi.mocked(fetchDailyTimeline);
const mockFetchCollections = vi.mocked(fetchCollections);
const mockFetchPreferences = vi.mocked(fetchPreferences);
const mockApiToggleTask = vi.mocked(apiToggleTask);
const mockApiUpdatePreferences = vi.mocked(apiUpdatePreferences);

vi.mock('../../utils/socket', () => ({
  getSocket: () => ({
    on: vi.fn(),
    off: vi.fn(),
    connected: true,
  }),
}));

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchDailyTimeline: vi.fn(),
  fetchCollections: vi.fn(),
  fetchPreferences: vi.fn(),
  apiToggleTask: vi.fn(),
  apiUpdatePreferences: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock('../../hooks/useSync', () => ({
  useSync: vi.fn(),
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
  }: {
    date: string;
    children: ReactNode;
    keepMounted?: boolean;
  }) => (
    <div
      id={`daily-day-${date}`}
      data-testid="virtual-day"
      data-date={date}
      data-keep-mounted={String(keepMounted)}
    >
      {children}
    </div>
  ),
}));

// UTC, not local time: the preferences mock reports timeZone: 'UTC' and
// DailyPage derives its todayKey from that preference. See DailyPage.test.tsx.
function fmtISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, amount: number): string {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return fmtISO(next);
}

const today = fmtISO(new Date());
const initialStart = addDays(new Date(), -14);
const visibleTask = {
  id: 'task-1',
  title: 'Visible task',
  priority: 4,
  collectionId: 'collection-1',
  isCompleted: false,
  orderValue: 1,
  type: 'task' as const,
  dueDate: today,
  createdAt: `${today}T12:00:00Z`,
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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
  mockFetchDailyTimeline.mockReset();
  mockFetchCollections.mockReset();
  mockFetchPreferences.mockReset();
  mockApiToggleTask.mockReset();
  mockApiUpdatePreferences.mockReset();

  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: false })),
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());

  mockFetchCollections.mockResolvedValue([]);
  mockFetchPreferences.mockResolvedValue({
    userId: 'user-1',
    locale: 'en',
    timeZone: 'UTC',
    weekStart: 'sunday',
    theme: 'system',
    notificationsEnabled: true,
    font: 'lora',
    showDots: true,
    background: 'beige',
    smallCaps: false,
    hideCompletedTasks: true,
    hideOldNotes: false,
  });
  mockFetchDailyTimeline.mockImplementation((start, end) => {
    if (start === initialStart && end === today) {
      return Promise.resolve({
        start,
        end,
        days: [{ date: today, tasks: [visibleTask] }],
      });
    }

    return Promise.resolve({
      start,
      end,
      days: [],
    });
  });
  mockApiToggleTask.mockResolvedValue({
    ...visibleTask,
    isCompleted: true,
  });
  mockApiUpdatePreferences.mockImplementation(async (patch) => ({
    userId: 'user-1',
    locale: 'en',
    timeZone: 'UTC',
    weekStart: 'sunday',
    theme: 'system',
    notificationsEnabled: true,
    font: 'lora',
    showDots: true,
    background: 'beige',
    smallCaps: false,
    hideCompletedTasks: patch.hideCompletedTasks ?? true,
    hideOldNotes: patch.hideOldNotes ?? false,
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DailyPage behavior visibility', () => {
  it('scrolls the current-date section into view from the Today toolbar button', async () => {
    renderPage();

    await screen.findByRole('button', { name: 'Complete: Visible task' });
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    await waitFor(() =>
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' }),
    );
  });

  it('optimistically toggles completed-task visibility and rolls back on failure', async () => {
    mockFetchPreferences.mockResolvedValueOnce({
      userId: 'user-1',
      locale: 'en',
      timeZone: 'UTC',
      weekStart: 'sunday',
      theme: 'system',
      notificationsEnabled: true,
      font: 'lora',
      showDots: true,
      background: 'beige',
      smallCaps: false,
      hideCompletedTasks: false,
      hideOldNotes: false,
    });
    const update = deferred<Awaited<ReturnType<typeof apiUpdatePreferences>>>();
    mockApiUpdatePreferences.mockReturnValueOnce(update.promise);
    renderPage();

    const hideCompleted = await screen.findByRole('button', { name: 'Hide completed tasks' });
    await waitFor(() => expect(hideCompleted).not.toBeDisabled());
    fireEvent.click(hideCompleted);

    await waitFor(() =>
      expect(mockApiUpdatePreferences).toHaveBeenCalledWith({ hideCompletedTasks: true }),
    );
    await screen.findByRole('button', { name: 'Show completed tasks' });

    update.reject(new Error('nope'));
    await screen.findByRole('button', { name: 'Hide completed tasks' });
  });

  it('optimistically toggles old-note visibility and rolls back on failure', async () => {
    const update = deferred<Awaited<ReturnType<typeof apiUpdatePreferences>>>();
    mockApiUpdatePreferences.mockReturnValueOnce(update.promise);
    renderPage();

    const hideOldNotes = await screen.findByRole('button', { name: 'Hide old notes' });
    await waitFor(() => expect(hideOldNotes).not.toBeDisabled());
    fireEvent.click(hideOldNotes);

    await waitFor(() =>
      expect(mockApiUpdatePreferences).toHaveBeenCalledWith({ hideOldNotes: true }),
    );
    await screen.findByRole('button', { name: 'Show old notes' });

    update.reject(new Error('nope'));
    await screen.findByRole('button', { name: 'Hide old notes' });
  });

  it('removes a completed task immediately when hide completed tasks is on', async () => {
    renderPage();

    const completeButton = await screen.findByRole('button', { name: 'Complete: Visible task' });
    fireEvent.click(completeButton);

    expect(mockApiToggleTask).toHaveBeenCalledWith('task-1', true);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Complete: Visible task' })).not.toBeInTheDocument());
  });

  it('does not let an older unfiltered load overwrite the filtered daily view', async () => {
    const firstLoad = deferred<Awaited<ReturnType<typeof fetchDailyTimeline>>>();

    mockFetchDailyTimeline.mockReset();
    mockFetchDailyTimeline
      .mockReturnValueOnce(firstLoad.promise)
      .mockResolvedValueOnce({
        start: initialStart,
        end: today,
        days: [
          {
            date: today,
            tasks: [{ ...visibleTask, id: 'task-open', title: 'Open task', isCompleted: false }],
          },
        ],
      });

    mockFetchPreferences.mockResolvedValueOnce({
      userId: 'user-1',
      locale: 'en',
      timeZone: 'UTC',
      weekStart: 'sunday',
      theme: 'system',
      notificationsEnabled: true,
      font: 'lora',
      showDots: true,
      background: 'beige',
      smallCaps: false,
      hideCompletedTasks: false,
      hideOldNotes: false,
    });

    const update = deferred<Awaited<ReturnType<typeof apiUpdatePreferences>>>();
    mockApiUpdatePreferences.mockReturnValueOnce(update.promise);

    renderPage();

    const hideCompleted = await screen.findByRole('button', { name: 'Hide completed tasks' });
    await waitFor(() => expect(hideCompleted).not.toBeDisabled());
    fireEvent.click(hideCompleted);

    await waitFor(() =>
      expect(mockApiUpdatePreferences).toHaveBeenCalledWith({ hideCompletedTasks: true }),
    );
    update.resolve({
      userId: 'user-1',
      locale: 'en',
      timeZone: 'UTC',
      weekStart: 'sunday',
      theme: 'system',
      notificationsEnabled: true,
      font: 'lora',
      showDots: true,
      background: 'beige',
      smallCaps: false,
      hideCompletedTasks: true,
      hideOldNotes: false,
    });

    await waitFor(() => expect(mockFetchDailyTimeline).toHaveBeenCalledTimes(2));
    await screen.findByRole('button', { name: 'Complete: Open task' });

    firstLoad.resolve({
      start: initialStart,
      end: today,
      days: [
        {
          date: today,
          tasks: [
            {
              ...visibleTask,
              title: 'Hidden completed task',
              isCompleted: true,
            },
          ],
        },
      ],
    });

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Reopen: Hidden completed task' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Complete: Open task' })).toBeInTheDocument();
  });

  it('restores the task when the completion request fails', async () => {
    mockApiToggleTask.mockRejectedValueOnce(new Error('nope'));
    mockFetchDailyTimeline.mockImplementation((start, end) => Promise.resolve({
      start,
      end,
      days: start <= today && today <= end ? [{ date: today, tasks: [visibleTask] }] : [],
    }));
    renderPage();

    const completeButton = await screen.findByRole('button', { name: 'Complete: Visible task' });
    fireEvent.click(completeButton);

    await waitFor(() => expect(mockApiToggleTask).toHaveBeenCalledWith('task-1', true));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Complete: Visible task' })).toBeInTheDocument());
  });
});
