import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const loadedModules = vi.hoisted(() => [] as string[]);
const testRoute = vi.hoisted(() => ({ current: '/daily' }));
const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
  user: null as { role: string } | null,
}));

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
vi.mock('../pages/HabitsPage', () => {
  loadedModules.push('habits');
  return { HabitsPage: () => <div>HabitsPage</div> };
});
vi.mock('../pages/SettingsPage', () => {
  loadedModules.push('settings');
  return { SettingsPage: () => <div>SettingsPage</div> };
});
vi.mock('../pages/StyleguidePage', () => {
  loadedModules.push('styleguide');
  return { StyleguidePage: () => <div>StyleguidePage</div> };
});
vi.mock('../pages/HelpPage', () => {
  loadedModules.push('help');
  return { HelpPage: () => <div>HelpPage</div> };
});
vi.mock('../pages/CollectionsLayout', async () => {
  loadedModules.push('collections');
  const { Outlet } = await import('react-router');
  return {
    CollectionsLayout: () => <Outlet />,
    CollectionsLanding: () => <div>CollectionsLanding</div>,
    CollectionsDetailRoute: () => <div>CollectionsDetailRoute</div>,
  };
});
vi.mock('../pages/LoginPage', () => ({ LoginPage: () => <div>LoginPage</div> }));

vi.mock('../components/AppShell', async () => {
  const { Link, Outlet } = await import('react-router');
  return {
    AppShell: () => <div data-testid="app-shell"><Link to="/settings/general">Open settings</Link><Outlet /></div>,
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
    user: authState.user,
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
    authState.user = null;
    testRoute.current = '/daily';
  });

  it('does not load secondary route modules on the Daily screen', () => {
    authState.isAuthenticated = true;
    testRoute.current = '/daily/list';
    render(<App />);
    expect(screen.getByText('DailyPage')).toBeInTheDocument();
    expect(loadedModules).toEqual([]);
  });

  it('renders DailyPage when authenticated on /daily/list', () => {
    authState.isAuthenticated = true;
    testRoute.current = '/daily/list';
    render(<App />);
    expect(screen.getByText('DailyPage')).toBeInTheDocument();
  });

  it('sends /daily to the last used view', () => {
    authState.isAuthenticated = true;
    testRoute.current = '/daily';
    render(<App />);
    expect(screen.getByText('redirect:/daily/list')).toBeInTheDocument();
  });

  it('keeps the shell visible while loading a route selected from navigation', async () => {
    authState.isAuthenticated = true;
    testRoute.current = '/daily/list';
    render(<App />);
    const shell = screen.getByTestId('app-shell');
    fireEvent.click(screen.getByRole('link', { name: 'Open settings' }));
    expect(screen.getByTestId('app-shell')).toBe(shell);
    expect(await screen.findByText('SettingsPage')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByTestId('app-shell')).toBe(shell);
  });

  it('announces loading for a direct visit to an unloaded route', async () => {
    authState.isAuthenticated = true;
    testRoute.current = '/habits';
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.getByTestId('app-shell')).toBeVisible();
    expect(await screen.findByText('HabitsPage')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders CollectionsLanding when authenticated on /collections', async () => {
    authState.isAuthenticated = true;
    testRoute.current = '/collections';
    render(<App />);
    expect(await screen.findByText('CollectionsLanding')).toBeInTheDocument();
  });

  it('renders StyleguidePage when an admin is authenticated on /styleguide', async () => {
    authState.isAuthenticated = true;
    authState.user = { role: 'admin' };
    testRoute.current = '/styleguide';
    render(<App />);
    expect(await screen.findByText('StyleguidePage')).toBeInTheDocument();
  });

  it('redirects a non-admin away from /styleguide', () => {
    authState.isAuthenticated = true;
    authState.user = { role: 'user' };
    testRoute.current = '/styleguide';
    render(<App />);
    expect(screen.getByText('redirect:/daily')).toBeInTheDocument();
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
