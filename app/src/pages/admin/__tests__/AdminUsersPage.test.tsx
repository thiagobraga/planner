import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminUsersPage } from '../AdminUsersPage';
import {
  apiListUsers,
  apiDisableUser,
  apiEnableUser,
  apiRevokeSessions,
  type AdminUser,
} from '../../../api/client';

const mockApiListUsers = vi.mocked(apiListUsers);
const mockApiDisableUser = vi.mocked(apiDisableUser);
const mockApiEnableUser = vi.mocked(apiEnableUser);
const mockApiRevokeSessions = vi.mocked(apiRevokeSessions);

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/client')>()),
  apiListUsers: vi.fn(),
  apiDisableUser: vi.fn(),
  apiEnableUser: vi.fn(),
  apiRevokeSessions: vi.fn(),
}));

// The page reads the signed-in admin's id to spot their own row.
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } }),
}));

function user(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'u1',
    email: 'ana@example.com',
    displayName: 'Ana',
    role: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
    disabledAt: null,
    lastSeenAt: '2026-02-01T10:00:00.000Z',
    activeSessions: 2,
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <AdminUsersPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockApiListUsers.mockReset();
  mockApiDisableUser.mockReset();
  mockApiEnableUser.mockReset();
  mockApiRevokeSessions.mockReset();
  mockApiListUsers.mockResolvedValue({ users: [user()], nextCursor: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AdminUsersPage', () => {
  it('renders the page title and subtitle', async () => {
    renderPage();

    const title = await screen.findByText('Users');
    expect(title.tagName.toLowerCase()).toBe('h1');
    expect(screen.getByText('Accounts, access and sessions')).toBeInTheDocument();
  });

  it('lists users returned by the API', async () => {
    renderPage();

    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
  });

  it('shows the empty state when nothing matches', async () => {
    mockApiListUsers.mockResolvedValue({ users: [], nextCursor: null });
    renderPage();

    expect(await screen.findByText('No users match this search.')).toBeInTheDocument();
  });

  it('marks an active account as Active and a disabled one as Disabled', async () => {
    mockApiListUsers.mockResolvedValue({
      users: [
        user(),
        user({ id: 'u2', email: 'bob@example.com', displayName: null, disabledAt: '2026-03-01T00:00:00.000Z' }),
      ],
      nextCursor: null,
    });
    renderPage();

    expect(await screen.findByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('flags admin accounts with a role badge', async () => {
    mockApiListUsers.mockResolvedValue({
      users: [user({ role: 'admin' })],
      nextCursor: null,
    });
    renderPage();

    expect(await screen.findByText('admin')).toBeInTheDocument();
  });

  it('debounces the search before querying', async () => {
    renderPage();
    await screen.findByText('ana@example.com');
    mockApiListUsers.mockClear();

    fireEvent.change(screen.getByLabelText('Search users'), { target: { value: 'bob' } });
    expect(mockApiListUsers).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(400));

    await waitFor(() => {
      expect(mockApiListUsers).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'bob' }),
      );
    });
  });

  it('asks for confirmation before disabling and then calls the API', async () => {
    mockApiDisableUser.mockResolvedValue(user({ disabledAt: '2026-03-01T00:00:00.000Z' }));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Disable' }));

    expect(
      screen.getByText(
        'Disable ana@example.com? They will be signed out everywhere and cannot log back in.',
      ),
    ).toBeInTheDocument();
    expect(mockApiDisableUser).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: 'Disable' })[1]!);

    await waitFor(() => expect(mockApiDisableUser).toHaveBeenCalledWith('u1'));
  });

  it('does not disable when the confirmation is cancelled', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Disable' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockApiDisableUser).not.toHaveBeenCalled();
  });

  it('enables a disabled account without a confirmation step', async () => {
    mockApiListUsers.mockResolvedValue({
      users: [user({ disabledAt: '2026-03-01T00:00:00.000Z' })],
      nextCursor: null,
    });
    mockApiEnableUser.mockResolvedValue(user());
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Enable' }));

    await waitFor(() => expect(mockApiEnableUser).toHaveBeenCalledWith('u1'));
  });

  it('confirms before revoking sessions', async () => {
    mockApiRevokeSessions.mockResolvedValue(user({ activeSessions: 0 }));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Revoke sessions' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Revoke sessions' })[1]!);

    await waitFor(() => expect(mockApiRevokeSessions).toHaveBeenCalledWith('u1'));
  });

  it('disables the revoke button for a user with no active sessions', async () => {
    mockApiListUsers.mockResolvedValue({
      users: [user({ activeSessions: 0 })],
      nextCursor: null,
    });
    renderPage();

    expect(await screen.findByRole('button', { name: 'Revoke sessions' })).toBeDisabled();
  });

  it('surfaces a failed action instead of failing silently', async () => {
    mockApiEnableUser.mockRejectedValue(new Error('nope'));
    mockApiListUsers.mockResolvedValue({
      users: [user({ disabledAt: '2026-03-01T00:00:00.000Z' })],
      nextCursor: null,
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Enable' }));

    expect(await screen.findByText('That action failed. Try again.')).toBeInTheDocument();
  });

  it('surfaces a failed list load', async () => {
    mockApiListUsers.mockRejectedValue(new Error('nope'));
    renderPage();

    expect(await screen.findByText('Could not load this data.')).toBeInTheDocument();
  });

  it('fetches the next page from the cursor when Load more is clicked', async () => {
    mockApiListUsers.mockResolvedValueOnce({ users: [user()], nextCursor: 'cursor-2' });
    mockApiListUsers.mockResolvedValueOnce({
      users: [user({ id: 'u2', email: 'bob@example.com', displayName: null })],
      nextCursor: null,
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('bob@example.com')).toBeInTheDocument();
    expect(mockApiListUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-2' }),
    );
  });

  it("blocks the signed-in admin from disabling their own row", async () => {
    mockApiListUsers.mockResolvedValue({
      users: [user({ id: 'admin-1', email: 'admin@example.com', role: 'admin' })],
      nextCursor: null,
    });
    renderPage();

    const disable = await screen.findByRole('button', { name: 'Disable' });
    expect(disable).toBeDisabled();
    expect(disable).toHaveAttribute('title', 'You cannot disable your own account');
  });

  it('still allows disabling other admins', async () => {
    mockApiListUsers.mockResolvedValue({
      users: [user({ id: 'admin-2', email: 'other@example.com', role: 'admin' })],
      nextCursor: null,
    });
    renderPage();

    expect(await screen.findByRole('button', { name: 'Disable' })).toBeEnabled();
  });

  it('offers no Load more button on the last page', async () => {
    renderPage();

    await screen.findByText('ana@example.com');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });
});
