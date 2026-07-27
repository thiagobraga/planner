import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminDashboardPage } from '../AdminDashboardPage';
import {
  apiGetAdminCounts,
  apiGetAdminHealth,
  apiGetAdminAuthStats,
} from '../../../api/client';

const mockCounts = vi.mocked(apiGetAdminCounts);
const mockHealth = vi.mocked(apiGetAdminHealth);
const mockAuthStats = vi.mocked(apiGetAdminAuthStats);

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/client')>()),
  apiGetAdminCounts: vi.fn(),
  apiGetAdminHealth: vi.fn(),
  apiGetAdminAuthStats: vi.fn(),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <AdminDashboardPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockCounts.mockReset();
  mockHealth.mockReset();
  mockAuthStats.mockReset();

  mockCounts.mockResolvedValue({
    users: 12,
    activeUsers: 11,
    disabledUsers: 1,
    admins: 2,
    tasks: 340,
    completedTasks: 128,
    collections: 9,
    habits: 6,
  });
  mockHealth.mockResolvedValue({
    database: { status: 'up', totalConnections: 4, idleConnections: 3, waitingRequests: 0 },
    redis: { status: 'up' },
    process: { uptimeSeconds: 93_600, memoryRssBytes: 157_286_400, nodeVersion: 'v24.4.0' },
  });
  mockAuthStats.mockResolvedValue({
    activeSessions: 7,
    sessionsLastDay: 3,
    usersOnlineLastHour: 2,
    throttledAccounts: 1,
    throttledIps: 0,
    failedLoginAttempts: 5,
  });
});

describe('AdminDashboardPage', () => {
  it('renders the page title and subtitle', async () => {
    renderPage();

    const title = await screen.findByText('Dashboard');
    expect(title.tagName.toLowerCase()).toBe('h1');
    expect(screen.getByText('Counts, system health and auth activity')).toBeInTheDocument();
  });

  it('renders the three panels once data arrives', async () => {
    renderPage();

    expect(await screen.findByText('Counts')).toBeInTheDocument();
    expect(screen.getByText('System health')).toBeInTheDocument();
    expect(screen.getByText('Authentication')).toBeInTheDocument();
  });

  it('shows the count tiles', async () => {
    renderPage();

    await screen.findByText('Counts');
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('340')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
  });

  it('renders database and Redis status', async () => {
    renderPage();

    await screen.findByText('System health');
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('Redis')).toBeInTheDocument();
    expect(screen.getAllByText('Up')).toHaveLength(2);
  });

  it('renders a down dependency as Down', async () => {
    mockHealth.mockResolvedValue({
      database: { status: 'up', totalConnections: 4, idleConnections: 3, waitingRequests: 0 },
      redis: { status: 'down' },
      process: { uptimeSeconds: 60, memoryRssBytes: 1024, nodeVersion: 'v24.4.0' },
    });
    renderPage();

    expect(await screen.findByText('Down')).toBeInTheDocument();
  });

  it('formats uptime and memory into human units', async () => {
    renderPage();

    await screen.findByText('System health');
    expect(screen.getByText('1d 2h')).toBeInTheDocument();
    expect(screen.getByText('150 MB')).toBeInTheDocument();
  });

  it('renders the auth stats', async () => {
    renderPage();

    await screen.findByText('Authentication');
    expect(screen.getByText('Active sessions')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Failed logins (window)')).toBeInTheDocument();
  });

  it('explains that failed-login figures cover the live window only', async () => {
    renderPage();

    expect(
      await screen.findByText(
        'Failed-login figures cover the live 15-minute rate-limit window, not all time.',
      ),
    ).toBeInTheDocument();
  });

  it('refetches every panel when Refresh is clicked', async () => {
    renderPage();

    await screen.findByText('Counts');
    expect(mockCounts).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(mockCounts).toHaveBeenCalledTimes(2);
      expect(mockHealth).toHaveBeenCalledTimes(2);
      expect(mockAuthStats).toHaveBeenCalledTimes(2);
    });
  });

  it('surfaces a load failure', async () => {
    mockCounts.mockRejectedValue(new Error('nope'));
    renderPage();

    expect(await screen.findByText('Could not load this data.')).toBeInTheDocument();
  });
});
