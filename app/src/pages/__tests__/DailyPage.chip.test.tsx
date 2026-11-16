import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DailyRoute } from '../DailyRoutes';
import { dailyView } from '../../test/dailyFixtures';
import { I18nProvider } from '../../i18n/I18nContext';
import { useSync, type SyncEvent } from '../../hooks/useSync';
import { fetchDaily, fetchPreferences, fetchCollections, fetchSections } from '../../api/client';
import type { ApiTask, Preferences } from '../../types/api';
import type { Task } from '../../components/TaskItem';

const mockFetchDaily = vi.mocked(fetchDaily);
const mockFetchPreferences = vi.mocked(fetchPreferences);
const mockFetchCollections = vi.mocked(fetchCollections);
const mockFetchSections = vi.mocked(fetchSections);
const mockUseSync = vi.mocked(useSync);

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchDaily: vi.fn(),
  fetchPreferences: vi.fn(),
  fetchCollections: vi.fn(),
  fetchSections: vi.fn(),
  fetchCollectionView: vi.fn(() => new Promise(() => {})),
  apiUpdateTask: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));
vi.mock('../../hooks/useTaskDrag', () => ({ useTaskDrag: () => ({ activeDragId: null }) }));
vi.mock('../../hooks/useSync', () => ({ useSync: vi.fn() }));
vi.mock('../../hooks/useMidnightTimer', () => ({ useMidnightTimer: vi.fn() }));
vi.mock('../../utils/phrases', () => ({ getPhrase: () => 'Make today count' }));
vi.mock('../../components/TaskList', () => ({
  TaskList: ({ tasks, renderBadge, onRightClick }: {
    tasks: Task[];
    renderBadge?: (task: Task) => ReactNode;
    onRightClick?: (id: string, position: { x: number; y: number }, visible: Task[], scope: unknown) => void;
  }) => (
    <div>
      {tasks.map((task) => (
        <div key={task.id} data-testid={`task-${task.id}`} onContextMenu={() => onRightClick?.(task.id, { x: 0, y: 0 }, tasks, undefined)}>
          {task.title}
          {renderBadge?.(task)}
        </div>
      ))}
    </div>
  ),
}));

const prefs: Preferences = {
  userId: 'user-1', locale: 'en', timeZone: 'UTC', weekStart: 'monday', theme: 'light', notificationsEnabled: true,
  font: 'lora', showDots: true, background: 'beige', smallCaps: false, hideCompletedTasks: false, showNotes: true,
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const sectioned: ApiTask = {
  id: 't1', title: 'Pay rent', priority: 4, collectionId: 'col-1', sectionId: 'sec-1', isCompleted: false,
  orderValue: 0, depth: 0, type: 'task', dueDate: todayKey(),
  collectionName: 'finance', collectionColor: '#c9483b', collectionIsInbox: false, sectionName: 'Bills',
};
const inboxTask: ApiTask = {
  id: 't2', title: 'Loose', priority: 4, collectionId: 'inbox-1', isCompleted: false,
  orderValue: 1, depth: 0, type: 'task', dueDate: todayKey(),
  collectionName: 'Inbox', collectionColor: '#bababa', collectionIsInbox: true,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/daily/list']}>
          <Routes><Route path="/daily/:view" element={<DailyRoute />} /></Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

function lastSyncHandler(): (event: SyncEvent) => void {
  return mockUseSync.mock.calls[mockUseSync.mock.calls.length - 1][0];
}

function syncEvent(overrides: Partial<SyncEvent>): SyncEvent {
  return { id: crypto.randomUUID(), entityType: 'task', eventType: 'updated', entityId: 't1', userId: 'user-1', emittedAt: '', ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockFetchDaily.mockResolvedValue(dailyView({ today: [sectioned, inboxTask] }));
  mockFetchPreferences.mockResolvedValue(prefs);
  mockFetchCollections.mockResolvedValue([]);
});

describe('DailyPage collection chip', () => {
  it('renders the chip from task fields without fetching collections or sections', async () => {
    renderPage();

    const row = await screen.findByTestId('task-t1');
    expect(row).toHaveTextContent('finance');
    expect(row).toHaveTextContent('Bills');
    expect(screen.getByTestId('task-t2')).not.toHaveTextContent('Inbox');
    expect(mockFetchCollections).not.toHaveBeenCalled();
    expect(mockFetchSections).not.toHaveBeenCalled();
  });

  it('loads collections when the task menu opens', async () => {
    renderPage();

    fireEvent.contextMenu(await screen.findByTestId('task-t1'));

    await waitFor(() => expect(mockFetchCollections).toHaveBeenCalledTimes(1));
  });

  it('keeps the chip when a synced update carries no names', async () => {
    renderPage();
    await screen.findByText('finance');

    const bare: ApiTask = { ...sectioned, title: 'Pay rent today' };
    for (const key of ['collectionName', 'collectionColor', 'collectionIsInbox', 'sectionName'] as const) delete bare[key];
    act(() => lastSyncHandler()(syncEvent({ payload: bare })));

    const row = await screen.findByText('Pay rent today');
    expect(row).toHaveTextContent('finance');
    expect(row).toHaveTextContent('Bills');
  });

  it('refetches the daily view when a collection or section is renamed', async () => {
    renderPage();
    await screen.findByText('finance');
    const before = mockFetchDaily.mock.calls.length;

    act(() => lastSyncHandler()(syncEvent({ entityType: 'collection', entityId: 'col-1' })));
    act(() => lastSyncHandler()(syncEvent({ entityType: 'section', entityId: 'sec-1', eventType: 'deleted' })));

    await waitFor(() => expect(mockFetchDaily.mock.calls.length).toBeGreaterThan(before));
  });
});
