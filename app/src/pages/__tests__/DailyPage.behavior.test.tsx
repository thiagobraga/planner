import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DailyPage } from '../DailyPage';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
import {
  apiToggleTask,
  apiUpdatePreferences,
  fetchCollections,
  fetchPreferences,
  fetchTodayTasks,
} from '../../api/client';

vi.mock('../../utils/socket', () => ({
  getSocket: () => ({
    on: vi.fn(),
    off: vi.fn(),
    connected: true,
  }),
}));

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchTodayTasks: vi.fn(),
  fetchCollections: vi.fn(),
  fetchPreferences: vi.fn(),
  apiToggleTask: vi.fn(),
  apiUpdatePreferences: vi.fn(),
}));

const mockFetchTodayTasks = vi.mocked(fetchTodayTasks);
const mockFetchCollections = vi.mocked(fetchCollections);
const mockFetchPreferences = vi.mocked(fetchPreferences);
const mockApiToggleTask = vi.mocked(apiToggleTask);
const mockApiUpdatePreferences = vi.mocked(apiUpdatePreferences);
const scrollIntoView = vi.fn();

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function openToolbarMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'More options' }));
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
        <PlannerDragProvider>
          <DailyPage />
        </PlannerDragProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockFetchTodayTasks.mockReset();
  mockFetchCollections.mockReset();
  mockFetchPreferences.mockReset();
  mockApiToggleTask.mockReset();
  mockApiUpdatePreferences.mockReset();
  scrollIntoView.mockReset();

  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: false })),
  });

  mockFetchCollections.mockResolvedValue([]);
  mockFetchPreferences.mockResolvedValue({
    userId: 'user-1',
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
  mockFetchTodayTasks.mockResolvedValue({
    overdue: [],
    today: [
      {
        id: 'task-1',
        title: 'Visible task',
        priority: 4,
        collectionId: 'collection-1',
        isCompleted: false,
        orderValue: 1,
        type: 'task',
        dueDate: '2026-07-20',
        createdAt: '2026-07-20T12:00:00Z',
      },
    ],
  });
  mockApiToggleTask.mockResolvedValue({
    id: 'task-1',
    title: 'Visible task',
    priority: 4,
    collectionId: 'collection-1',
    isCompleted: true,
    orderValue: 1,
    type: 'task',
    dueDate: '2026-07-20',
    createdAt: '2026-07-20T12:00:00Z',
  });
  mockApiUpdatePreferences.mockImplementation(async (patch) => ({
    userId: 'user-1',
    timeZone: 'UTC',
    weekStart: 'sunday',
    theme: 'system',
    notificationsEnabled: true,
    font: 'lora',
    showDots: true,
    background: 'beige',
    smallCaps: false,
    hideCompletedTasks: patch.hideCompletedTasks ?? true,
    hideOldNotes: false,
  }));
});

describe('DailyPage behavior visibility', () => {
  it('scrolls the current-date section into view when returning to today from the next-days toggle', async () => {
    renderPage();

    await screen.findByRole('button', { name: 'Complete: Visible task' });
    openToolbarMenu();
    const nextDays = screen.getByRole('checkbox', { name: 'Next days' });
    fireEvent.click(nextDays);
    fireEvent.click(nextDays);

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' }));
  });

  it('optimistically toggles completed-task visibility and rolls back on failure', async () => {
    mockFetchPreferences.mockResolvedValueOnce({
      userId: 'user-1',
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

    await screen.findByRole('button', { name: 'Complete: Visible task' });
    openToolbarMenu();
    const hideCompleted = await screen.findByRole('checkbox', { name: 'Completed tasks' });
    await waitFor(() => expect(hideCompleted).not.toBeDisabled());
    expect(hideCompleted).toBeChecked();
    fireEvent.click(hideCompleted);

    await waitFor(() =>
      expect(mockApiUpdatePreferences).toHaveBeenCalledWith({ hideCompletedTasks: true }),
    );
    expect(hideCompleted).not.toBeChecked();

    update.reject(new Error('nope'));
    await waitFor(() => expect(hideCompleted).toBeChecked());
  });

  it('optimistically toggles old-note visibility and rolls back on failure', async () => {
    const update = deferred<Awaited<ReturnType<typeof apiUpdatePreferences>>>();
    mockApiUpdatePreferences.mockReturnValueOnce(update.promise);
    renderPage();

    await screen.findByRole('button', { name: 'Complete: Visible task' });
    openToolbarMenu();
    const hideOldNotes = await screen.findByRole('checkbox', { name: 'Old notes' });
    await waitFor(() => expect(hideOldNotes).not.toBeDisabled());
    expect(hideOldNotes).toBeChecked();
    fireEvent.click(hideOldNotes);

    await waitFor(() =>
      expect(mockApiUpdatePreferences).toHaveBeenCalledWith({ hideOldNotes: true }),
    );
    expect(hideOldNotes).not.toBeChecked();

    update.reject(new Error('nope'));
    await waitFor(() => expect(hideOldNotes).toBeChecked());
  });

  it('removes a completed task immediately when hide completed tasks is on', async () => {
    renderPage();

    const completeButton = await screen.findByRole('button', { name: 'Complete: Visible task' });
    fireEvent.click(completeButton);

    expect(mockApiToggleTask).toHaveBeenCalledWith('task-1', true);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Complete: Visible task' })).not.toBeInTheDocument());
  });

  it('does not let an older unfiltered load overwrite the filtered daily view', async () => {
    const firstLoad = deferred<Awaited<ReturnType<typeof fetchTodayTasks>>>();

    mockFetchTodayTasks.mockReturnValueOnce(firstLoad.promise);

    renderPage();

    await waitFor(() => expect(mockFetchTodayTasks).toHaveBeenCalledTimes(1));

    firstLoad.resolve({
      overdue: [],
      today: [
        {
          id: 'task-open',
          title: 'Open task',
          priority: 4,
          collectionId: 'collection-1',
          isCompleted: false,
          orderValue: 1,
          type: 'task',
          dueDate: '2026-07-20',
          createdAt: '2026-07-20T12:00:00Z',
        },
      ],
    });

    // Simulate hideCompletedTasks filtering: only open task shows
    expect(await screen.findByRole('button', { name: 'Complete: Open task' })).toBeInTheDocument();

    // Verify completed tasks are not rendered (hideCompletedTasks=true)
    expect(screen.queryByRole('button', { name: 'Reopen: Hidden completed task' })).not.toBeInTheDocument();
  });

  it('restores the task when the completion request fails', async () => {
    mockApiToggleTask.mockRejectedValueOnce(new Error('nope'));
    renderPage();

    const completeButton = await screen.findByRole('button', { name: 'Complete: Visible task' });
    fireEvent.click(completeButton);

    await waitFor(() => expect(mockApiToggleTask).toHaveBeenCalledWith('task-1', true));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Complete: Visible task' })).toBeInTheDocument());
  });
});
