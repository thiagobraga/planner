import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';
import { apiLogin, apiRegister, apiLogout, setCurrentUserId } from '../../api/client';
import type { AuthUser } from '../../api/client';
import { connectSocket, disconnectSocket } from '../../utils/socket';
import { clearUserMutations } from '../../utils/offlineQueue';
import { queryClient } from '../../api/queryClient';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  apiLogin: vi.fn(),
  apiRegister: vi.fn(),
  apiLogout: vi.fn(),
  setCurrentUserId: vi.fn(),
}));

vi.mock('../../utils/socket', () => ({
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
}));

vi.mock('../../hooks/useOfflineQueueReplay', () => ({
  useOfflineQueueReplay: vi.fn(),
}));

vi.mock('../../utils/offlineQueue', () => ({
  clearUserMutations: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../api/queryClient', () => ({
  queryClient: { clear: vi.fn() },
}));

const mockUser: AuthUser = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
};

const mockUserJson = JSON.stringify({ user: mockUser });

const mockApiLogin = vi.mocked(apiLogin);
const mockApiRegister = vi.mocked(apiRegister);
const mockApiLogout = vi.mocked(apiLogout);
const mockSetCurrentUserId = vi.mocked(setCurrentUserId);
const mockConnectSocket = vi.mocked(connectSocket);
const mockDisconnectSocket = vi.mocked(disconnectSocket);
const mockClearUserMutations = vi.mocked(clearUserMutations);

function TestConsumer() {
  const auth = useAuth();
  return (
    <div data-testid="auth-state">
      {JSON.stringify({
        user: auth.user?.id ?? null,
        isAuthenticated: auth.isAuthenticated,
        isLoading: auth.isLoading,
      })}
    </div>
  );
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthContext', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    mockApiLogout.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows loading state initially before /me resolves', async () => {
    let resolveFetch!: (value: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByTestId('auth-state')).not.toBeInTheDocument();

    await act(async () => {
      resolveFetch(
        new Response(mockUserJson, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.getByTestId('auth-state')).toBeInTheDocument();
  });

  it('sets user and isAuthenticated on successful /me', async () => {
    fetchMock.mockResolvedValue(
      new Response(mockUserJson, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('"user":"user-1"');
      expect(screen.getByTestId('auth-state')).toHaveTextContent('"isAuthenticated":true');
    });

    expect(mockSetCurrentUserId).toHaveBeenCalledWith('user-1');
    expect(mockConnectSocket).toHaveBeenCalled();
  });

  it('sets user to null and isAuthenticated to false when /me rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('"user":null');
      expect(screen.getByTestId('auth-state')).toHaveTextContent('"isAuthenticated":false');
    });

    expect(mockSetCurrentUserId).not.toHaveBeenCalled();
    expect(mockConnectSocket).not.toHaveBeenCalled();
  });

  it('login() calls apiLogin and sets user', async () => {
    fetchMock.mockRejectedValue(new Error('no session'));
    mockApiLogin.mockResolvedValue(mockUser);

    let captured!: ReturnType<typeof useAuth>;
    function CaptureConsumer() {
      captured = useAuth();
      return <TestConsumer />;
    }

    render(
      <TestWrapper>
        <CaptureConsumer />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('"user":null');
    });

    await act(async () => {
      await captured.login('test@example.com', 'password');
    });

    expect(mockApiLogin).toHaveBeenCalledWith('test@example.com', 'password');
    expect(mockSetCurrentUserId).toHaveBeenCalledWith('user-1');
    expect(mockConnectSocket).toHaveBeenCalled();
    expect(screen.getByTestId('auth-state')).toHaveTextContent('"user":"user-1"');
    expect(screen.getByTestId('auth-state')).toHaveTextContent('"isAuthenticated":true');
  });

  it('login() failure throws error and does not set user', async () => {
    fetchMock.mockRejectedValue(new Error('no session'));
    mockApiLogin.mockRejectedValue(new Error('invalid credentials'));

    let captured!: ReturnType<typeof useAuth>;
    function CaptureConsumer() {
      captured = useAuth();
      return <TestConsumer />;
    }

    render(
      <TestWrapper>
        <CaptureConsumer />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('"user":null');
    });

    let error: Error | null = null;
    try {
      await act(async () => {
        await captured.login('test@example.com', 'wrong');
      });
    } catch (e) {
      error = e as Error;
    }

    expect(error).not.toBeNull();
    expect(error!.message).toBe('invalid credentials');
    expect(screen.getByTestId('auth-state')).toHaveTextContent('"user":null');
    expect(screen.getByTestId('auth-state')).toHaveTextContent('"isAuthenticated":false');
    expect(mockSetCurrentUserId).not.toHaveBeenCalledWith('user-1');
  });

  it('logout() calls apiLogout, clears user, and disconnects socket', async () => {
    fetchMock.mockResolvedValue(
      new Response(mockUserJson, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    let captured!: ReturnType<typeof useAuth>;
    function CaptureConsumer() {
      captured = useAuth();
      return <TestConsumer />;
    }

    render(
      <TestWrapper>
        <CaptureConsumer />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('"user":"user-1"');
    });

    act(() => {
      captured.logout();
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('"user":null');
      expect(screen.getByTestId('auth-state')).toHaveTextContent('"isAuthenticated":false');
    });

    expect(mockApiLogout).toHaveBeenCalled();
    expect(mockSetCurrentUserId).toHaveBeenCalledWith(null);
    expect(queryClient.clear).toHaveBeenCalled();
    expect(mockClearUserMutations).toHaveBeenCalledWith('user-1');
    expect(mockDisconnectSocket).toHaveBeenCalled();
  });

  it('register() calls apiRegister and sets user', async () => {
    fetchMock.mockRejectedValue(new Error('no session'));
    mockApiRegister.mockResolvedValue(mockUser);

    let captured!: ReturnType<typeof useAuth>;
    function CaptureConsumer() {
      captured = useAuth();
      return <TestConsumer />;
    }

    render(
      <TestWrapper>
        <CaptureConsumer />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('"user":null');
    });

    await act(async () => {
      await captured.register('new@example.com', 'password');
    });

    expect(mockApiRegister).toHaveBeenCalledWith('new@example.com', 'password');
    expect(mockSetCurrentUserId).toHaveBeenCalledWith('user-1');
    expect(mockConnectSocket).toHaveBeenCalled();
    expect(screen.getByTestId('auth-state')).toHaveTextContent('"user":"user-1"');
    expect(screen.getByTestId('auth-state')).toHaveTextContent('"isAuthenticated":true');
  });
});
