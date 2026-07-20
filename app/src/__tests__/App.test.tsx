import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const testRoute = vi.hoisted(() => ({ current: '/daily' }));
const authState = vi.hoisted(() => ({ isAuthenticated: false, isLoading: false }));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => (
      <actual.MemoryRouter initialEntries={[testRoute.current]}>{children}</actual.MemoryRouter>
    ),
    Navigate: ({ to }: { to: string }) => <div>redirect:{to}</div>,
  };
});

vi.mock('../pages/DailyPage', () => ({ DailyPage: () => <div>DailyPage</div> }));
vi.mock('../pages/InboxPage', () => ({ InboxPage: () => <div>InboxPage</div> }));
vi.mock('../pages/MonthlyPage', () => ({ MonthlyPage: () => <div>MonthlyPage</div> }));
vi.mock('../pages/HabitsPage', () => ({ HabitsPage: () => <div>HabitsPage</div> }));
vi.mock('../pages/SettingsPage', () => ({ SettingsPage: () => <div>SettingsPage</div> }));
vi.mock('../pages/StyleguidePage', () => ({ StyleguidePage: () => <div>StyleguidePage</div> }));
vi.mock('../pages/HelpPage', () => ({ HelpPage: () => <div>HelpPage</div> }));
vi.mock('../pages/CollectionsPage', () => ({ CollectionsPage: () => <div>CollectionsPage</div> }));
vi.mock('../pages/LoginPage', () => ({ LoginPage: () => <div>LoginPage</div> }));

vi.mock('../components/AppShell', async () => {
  const { Outlet } = await import('react-router');
  return {
    AppShell: () => <div data-testid="app-shell"><Outlet /></div>,
  };
});

vi.mock('../components/OfflineIndicator', () => ({
  OfflineIndicator: () => null,
}));

vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => {
    if (authState.isLoading) return <div>Loading...</div>;
    return <>{children}</>;
  },
  useAuth: () => ({
    isAuthenticated: authState.isAuthenticated,
    user: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('../api/queryClient', () => ({ queryClient: {} }));

vi.mock('@tanstack/react-query', () => ({
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import App from '../App';

describe('App', () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.isLoading = false;
    testRoute.current = '/daily';
  });

  it('renders DailyPage when authenticated on /daily', () => {
    authState.isAuthenticated = true;
    testRoute.current = '/daily';
    render(<App />);
    expect(screen.getByText('DailyPage')).toBeInTheDocument();
  });

  it('redirects to /login when not authenticated on protected route', () => {
    authState.isAuthenticated = false;
    testRoute.current = '/daily';
    render(<App />);
    expect(screen.getByText('redirect:/login')).toBeInTheDocument();
  });

  it('renders login page without auth guard', () => {
    authState.isAuthenticated = false;
    testRoute.current = '/login';
    render(<App />);
    expect(screen.getByText('LoginPage')).toBeInTheDocument();
  });

  it('shows loading spinner when AuthProvider is initializing', () => {
    authState.isLoading = true;
    testRoute.current = '/daily';
    render(<App />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
