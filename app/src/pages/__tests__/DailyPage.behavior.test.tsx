import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DailyPage } from '../DailyPage';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
import { apiToggleTask, fetchCollections, fetchPreferences, fetchTodayTasks } from '../../api/client';

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
}));

const mockFetchTodayTasks = vi.mocked(fetchTodayTasks);
const mockFetchCollections = vi.mocked(fetchCollections);
const mockFetchPreferences = vi.mocked(fetchPreferences);
const mockApiToggleTask = vi.mocked(apiToggleTask);

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
});

describe('DailyPage behavior visibility', () => {
  it('removes a completed task immediately when hide completed tasks is on', async () => {
    renderPage();

    const completeButton = await screen.findByRole('button', { name: 'Complete: Visible task' });
    fireEvent.click(completeButton);

    expect(mockApiToggleTask).toHaveBeenCalledWith('task-1', true);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Complete: Visible task' })).not.toBeInTheDocument());
  });

  it('does not let an older unfiltered load overwrite the filtered daily view', async () => {
    const firstLoad = deferred<Awaited<ReturnType<typeof fetchTodayTasks>>>();
    const secondLoad = deferred<Awaited<ReturnType<typeof fetchTodayTasks>>>();

    mockFetchTodayTasks
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(secondLoad.promise);

    renderPage();

    await waitFor(() => expect(mockFetchTodayTasks).toHaveBeenCalledTimes(2));

    secondLoad.resolve({
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

    await screen.findByRole('button', { name: 'Complete: Open task' });

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
        {
          id: 'task-done',
          title: 'Hidden completed task',
          priority: 4,
          collectionId: 'collection-1',
          isCompleted: true,
          orderValue: 2,
          type: 'task',
          dueDate: '2026-07-20',
          createdAt: '2026-07-20T12:00:00Z',
        },
      ],
    });

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Reopen: Hidden completed task' })).not.toBeInTheDocument(),
    );
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
