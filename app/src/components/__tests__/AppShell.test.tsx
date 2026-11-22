import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { useLocation } from 'react-router';
import { AppShell } from '../AppShell';
import { useTaskDetailStore } from '../../stores/taskDetailStore';
import { useTaskSelectionStore } from '../../stores/taskSelectionStore';
import { QuickAdd } from '../QuickAdd';
import { apiCreateTask } from '../../api/client';
import { updateDocumentThemeColor } from '../../utils/theme';
import { useSync } from '../../hooks/useSync';
import { matchKey } from '../../hooks/shortcuts';

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockInvalidateQueries = vi.hoisted(() => vi.fn());
const mockRemoveQueries = vi.hoisted(() => vi.fn());

vi.mock('react-router', () => ({
  Outlet: vi.fn(() => <div data-testid="outlet-content">Outlet content</div>),
  useNavigate: vi.fn(() => vi.fn()),
  useLocation: vi.fn(() => ({ pathname: '/daily' })),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mockUseQuery,
  useQueryClient: vi.fn(() => ({
    invalidateQueries: mockInvalidateQueries,
    removeQueries: mockRemoveQueries,
    setQueryData: vi.fn(),
  })),
  QueryClient: vi.fn(),
  QueryClientProvider: vi.fn(({ children }: { children: React.ReactNode }) => <>{children}</>),
}));

vi.mock('../../contexts/PlannerDragContext', () => ({
  PlannerDragProvider: vi.fn(({ children }: { children: React.ReactNode }) => <>{children}</>),
}));

vi.mock('../../api/client', () => ({
  fetchPreferences: vi.fn(),
  fetchCollections: vi.fn(),
  apiCreateTask: vi.fn(),
}));

vi.mock('../nav/TopBar', () => ({
  TopBar: vi.fn(() => <div data-testid="topbar" />),
  NAV_ITEMS: [
    { to: '/daily', labelKey: 'nav.daily', Icon: () => null },
    { to: '/inbox', labelKey: 'nav.inbox', Icon: () => null },
    { to: '/habits', labelKey: 'nav.habits', Icon: () => null },
    { to: '/monthly', labelKey: 'nav.monthly', Icon: () => null },
  ],
}));

vi.mock('../QuickAdd', () => ({
  QuickAdd: vi.fn(() => null),
}));

vi.mock('../detail/TaskDetailHost', () => ({ TaskDetailHost: () => null }));

vi.mock('../SearchOverlay', () => ({
  SearchOverlay: vi.fn(() => null),
}));

vi.mock('../../hooks/useSync', () => ({
  useSync: vi.fn(),
}));

// The real hook starts a REST version check at module scope, which fetches
// /api/v1/version against happy-dom's localhost:3000 and logs ECONNREFUSED
// noise. The page shell has no use for the update banner here.
vi.mock('../../hooks/useVersionCheck', () => ({
  useVersionCheck: () => false,
}));

vi.mock('../../utils/fontLoader', () => ({
  ensureFontLoaded: vi.fn(),
}));

vi.mock('../../utils/theme', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/theme')>()),
  updateDocumentThemeColor: vi.fn(),
}));

vi.mock('../../hooks/shortcuts', () => ({
  matchKey: vi.fn(() => ({ action: null, nextState: {} })),
  createMatcherState: vi.fn(() => ({})),
  DEFAULT_BINDINGS: {},
}));

const defaultPreferences = {
  userId: 'user-1',
  timeZone: 'UTC',
  weekStart: 'monday',
  theme: 'light',
  notificationsEnabled: false,
  font: 'lora',
  showDots: true,
  background: 'beige',
  smallCaps: false,
  hideCompletedTasks: false,
  showNotes: true,
};

describe('AppShell', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({ data: defaultPreferences });
    vi.mocked(useLocation).mockReturnValue({ pathname: '/daily' } as ReturnType<typeof useLocation>);
    vi.mocked(apiCreateTask).mockResolvedValue({} as Awaited<ReturnType<typeof apiCreateTask>>);
  });

  it('adds a quick task to the current collection and refreshes its view', async () => {
    vi.mocked(useLocation).mockReturnValue({ pathname: '/collection/collection-1' } as ReturnType<typeof useLocation>);
    render(<AppShell />);

    await act(async () => {
      vi.mocked(QuickAdd).mock.lastCall?.[0].onSubmit('Buy paper');
    });

    expect(apiCreateTask).toHaveBeenCalledWith({
      title: 'Buy paper',
      dueDate: undefined,
      recurrenceRule: undefined,
      type: undefined,
      collectionId: 'collection-1',
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['collection', 'collection-1'] });
  });

  it('keeps quick tasks in the inbox outside a collection', async () => {
    vi.mocked(useLocation).mockReturnValue({ pathname: '/inbox' } as ReturnType<typeof useLocation>);
    render(<AppShell />);

    await act(async () => {
      vi.mocked(QuickAdd).mock.lastCall?.[0].onSubmit('Buy paper');
    });

    expect(apiCreateTask).toHaveBeenCalledWith({
      title: 'Buy paper',
      dueDate: undefined,
      recurrenceRule: undefined,
      type: undefined,
    });
  });

  it('renders without crashing', () => {
    render(<AppShell />);
    expect(screen.getByTestId('outlet-content')).toBeInTheDocument();
  });

  it("refreshes a task's comment thread when another session comments on it", async () => {
    render(<AppShell />);
    const handler = vi.mocked(useSync).mock.lastCall?.[0];

    await act(async () => {
      handler?.({
        id: 'e1',
        entityType: 'comment',
        eventType: 'created',
        entityId: 'c1',
        userId: 'user-2',
        collectionId: 'col-1',
        payload: { taskId: 'task-9' },
        emittedAt: '2026-11-19T00:00:00.000Z',
      });
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['comments', 'task-9'] });
  });

  it("refreshes a task's document when another session updates the task", async () => {
    render(<AppShell />);
    const handler = vi.mocked(useSync).mock.lastCall?.[0];

    await act(async () => {
      handler?.({
        id: 'e2',
        entityType: 'task',
        eventType: 'updated',
        entityId: 'task-9',
        userId: 'user-2',
        collectionId: 'col-1',
        emittedAt: '2026-11-19T00:00:00.000Z',
      });
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['document', 'task-9'] });
  });

  it("drops a task's cached document when the task is deleted", async () => {
    render(<AppShell />);
    const handler = vi.mocked(useSync).mock.lastCall?.[0];

    await act(async () => {
      handler?.({
        id: 'e3',
        entityType: 'task',
        eventType: 'deleted',
        entityId: 'task-9',
        userId: 'user-2',
        collectionId: 'col-1',
        emittedAt: '2026-11-19T00:00:00.000Z',
      });
    });

    expect(mockRemoveQueries).toHaveBeenCalledWith({ queryKey: ['document', 'task-9'] });
  });

  it('pins the shell to the viewport so the mobile bottom bar stays visible', () => {
    const { container } = render(<AppShell />);
    const shell = container.querySelector('.app-shell');
    expect(shell).toHaveClass('fixed', 'inset-0');
    expect(shell).not.toHaveClass('h-dvh');
  });

  it('renders the Outlet content', () => {
    render(<AppShell />);
    expect(screen.getByText('Outlet content')).toBeInTheDocument();
  });

  it('centers every page in one 720px column', () => {
    render(<AppShell />);
    const column = screen.getByTestId('outlet-content').parentElement;
    expect(column).toHaveClass('page-container', 'mx-auto', 'w-full', 'max-w-page');
    expect(column?.parentElement?.tagName).toBe('MAIN');
  });

  it('applies font class from preferences', () => {
    mockUseQuery.mockReturnValue({
      data: { ...defaultPreferences, font: 'hubballi' },
    });
    const { unmount } = render(<AppShell />);
    expect(document.body).toHaveClass('font-hubballi');
    unmount();
    expect(document.body).not.toHaveClass('font-hubballi');
  });

  it('renders TopBar', () => {
    render(<AppShell />);
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
  });

  it('closes task details and clears selection on outside click and Escape, but ignores clicks inside the panel or card', () => {
    const close = vi.fn();
    useTaskDetailStore.setState({ taskId: 'task-1', navigator: { open: vi.fn(), close }, origin: null, leaveGuard: null });
    useTaskSelectionStore.getState().selectTask('task-1', false);

    render(<AppShell />);

    const card = document.createElement('div');
    card.dataset.cardId = 'task-1';
    document.body.appendChild(card);
    const panel = document.createElement('aside');
    panel.className = 'detail-panel';
    document.body.appendChild(panel);
    try {
      fireEvent.pointerDown(card, { button: 0 });
      fireEvent.pointerDown(panel, { button: 0 });
      expect(close).not.toHaveBeenCalled();
      expect(useTaskSelectionStore.getState().selectedTaskIds.has('task-1')).toBe(true);

      fireEvent.pointerDown(screen.getByTestId('outlet-content'), { button: 0 });
      expect(close).toHaveBeenCalledTimes(1);
      expect(useTaskSelectionStore.getState().selectedTaskIds.size).toBe(0);

      useTaskSelectionStore.getState().selectTask('task-1', false);
      vi.mocked(matchKey).mockReturnValueOnce({ action: 'dialog:close', nextState: { pendingChord: null } });
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(close).toHaveBeenCalledTimes(2);
      expect(useTaskSelectionStore.getState().selectedTaskIds.size).toBe(0);
    } finally {
      card.remove();
      panel.remove();
      useTaskDetailStore.setState({ taskId: null, navigator: null, origin: null, leaveGuard: null });
      useTaskSelectionStore.getState().clearSelection();
    }
  });

  describe('theme', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('puts the chosen theme on <html> and the browser chrome', () => {
      mockUseQuery.mockReturnValue({ data: { ...defaultPreferences, background: 'dark' } });

      render(<AppShell />);

      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
      expect(updateDocumentThemeColor).toHaveBeenLastCalledWith('dark');
    });

    it.each(['dark', 'nord-light', 'nord-dark'])('removes %s on unmount so logged-out screens stay beige', (background) => {
      mockUseQuery.mockReturnValue({ data: { ...defaultPreferences, background } });

      const { unmount } = render(<AppShell />);
      unmount();

      expect(document.documentElement).not.toHaveAttribute('data-theme');
      expect(updateDocumentThemeColor).toHaveBeenLastCalledWith('beige');
    });

    it.each(['dark', 'nord-light', 'nord-dark'])('uses cached %s until preferences load', (background) => {
      localStorage.setItem('planner_background', background);
      mockUseQuery.mockReturnValue({ data: undefined });

      render(<AppShell />);

      expect(document.documentElement).toHaveAttribute('data-theme', background);
    });

    it('caches the loaded background for the next reload', () => {
      mockUseQuery.mockReturnValue({ data: { ...defaultPreferences, background: 'white' } });

      render(<AppShell />);

      expect(localStorage.getItem('planner_background')).toBe('white');
    });

    it('switches themes without flashing beige in between', () => {
      mockUseQuery.mockReturnValue({ data: { ...defaultPreferences, background: 'dark' } });
      const { rerender } = render(<AppShell />);
      vi.mocked(updateDocumentThemeColor).mockClear();

      mockUseQuery.mockReturnValue({ data: { ...defaultPreferences, background: 'nord-dark' } });
      rerender(<AppShell />);

      expect(updateDocumentThemeColor).toHaveBeenCalledTimes(1);
      expect(updateDocumentThemeColor).toHaveBeenCalledWith('nord-dark');
      expect(document.documentElement).toHaveAttribute('data-theme', 'nord-dark');
    });
  });
});
