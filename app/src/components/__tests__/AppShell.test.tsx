import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { AppShell } from '../AppShell';

const mockUseQuery = vi.hoisted(() => vi.fn());

vi.mock('react-router', () => ({
  Outlet: vi.fn(() => <div data-testid="outlet-content">Outlet content</div>),
  useNavigate: vi.fn(() => vi.fn()),
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

vi.mock('../../utils/theme', () => ({
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
  hideOldNotes: false,
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
});
