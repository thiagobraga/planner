import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { useLocation } from 'react-router';
import { AppShell } from '../AppShell';
import { QuickAdd } from '../QuickAdd';
import { apiCreateTask } from '../../api/client';
import { updateDocumentThemeColor } from '../../utils/theme';

const mockUseQuery = vi.hoisted(() => vi.fn());

vi.mock('react-router', () => ({
  Outlet: vi.fn(() => <div data-testid="outlet-content">Outlet content</div>),
  useNavigate: vi.fn(() => vi.fn()),
  useLocation: vi.fn(() => ({ pathname: '/daily' })),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mockUseQuery,
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
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

vi.mock('../Sidebar', () => ({
  Sidebar: vi.fn(() => <div data-testid="sidebar" />),
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

vi.mock('../SearchOverlay', () => ({
  SearchOverlay: vi.fn(() => null),
}));

vi.mock('../../hooks/useSync', () => ({
  useSync: vi.fn(),
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
  });

  it('keeps quick tasks in the inbox outside a collection', async () => {
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

  it('renders the Outlet content', () => {
    render(<AppShell />);
    expect(screen.getByText('Outlet content')).toBeInTheDocument();
  });

  it('applies font class from preferences', () => {
    mockUseQuery.mockReturnValue({
      data: { ...defaultPreferences, font: 'hubballi' },
    });
    const { container } = render(<AppShell />);
    const shell = container.querySelector('.app-shell');
    expect(shell?.className).toContain('font-hubballi');
  });

  it('renders Sidebar', () => {
    render(<AppShell />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
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

    it('removes the theme on unmount so logged-out screens stay beige', () => {
      mockUseQuery.mockReturnValue({ data: { ...defaultPreferences, background: 'dark' } });

      const { unmount } = render(<AppShell />);
      unmount();

      expect(document.documentElement).not.toHaveAttribute('data-theme');
      expect(updateDocumentThemeColor).toHaveBeenLastCalledWith('beige');
    });

    it('uses the cached background until preferences load', () => {
      localStorage.setItem('planner_background', 'dark');
      mockUseQuery.mockReturnValue({ data: undefined });

      render(<AppShell />);

      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    });

    it('caches the loaded background for the next reload', () => {
      mockUseQuery.mockReturnValue({ data: { ...defaultPreferences, background: 'white' } });

      render(<AppShell />);

      expect(localStorage.getItem('planner_background')).toBe('white');
    });
  });
});
