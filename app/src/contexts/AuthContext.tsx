import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { apiLogin, apiRegister, apiLogout, setCurrentUserId, type AuthUser } from '../api/client';
import { queryClient } from '../api/queryClient';
import { connectSocket, disconnectSocket } from '../utils/socket';
import { useOfflineQueueReplay } from '../hooks/useOfflineQueueReplay';
import { clearUserMutations } from '../utils/offlineQueue';
import { useI18n } from '../i18n/I18nContext';
import { setUnauthorizedHandler } from '../utils/authEvents';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [initializing, setInitializing] = useState(true);

  useOfflineQueueReplay(user?.id ?? null);

  useEffect(() => {
    fetchCurrentUser().then((u) => {
      if (u) {
        setUser(u);
        setIsAuthenticated(true);
        setCurrentUserId(u.id);
      }
      setInitializing(false);
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      connectSocket();
    } else {
      disconnectSocket();
    }
  }, [isAuthenticated]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
    setIsAuthenticated(true);
    setCurrentUserId(u.id);
  }, []);

  // POST /auth/register deliberately creates no session - /auth/login is the
  // only path that mints one. Chaining the two here keeps session creation in a
  // single place instead of growing a second, divergent code path on the server.
  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      await apiRegister(email, password, displayName);
      await login(email, password);
    },
    [login],
  );

  // Keeps the callbacks registered below pointed at the current user without
  // re-registering them on every render.
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Tears down everything this tab holds for the signed-in user. Idempotent, so
  // repeated 401s from requests already in flight collapse into one teardown.
  const endLocalSession = useCallback(() => {
    const uid = userRef.current?.id;
    if (!uid) return;
    // Cancel pending queries first so requests that land after the auth state
    // changes don't report their own 401s back through here.
    queryClient.cancelQueries();
    setUser(null);
    setIsAuthenticated(false);
    setCurrentUserId(null);
    queryClient.clear();
    clearUserMutations(uid).catch(() => {});
  }, []);

  const logout = useCallback(() => {
    if (!userRef.current) return;
    queryClient.cancelQueries();
    // Revoking server-side is best-effort: the local teardown below is what the
    // user sees, and it must happen whether or not the network call lands.
    apiLogout()
      .catch(() => {})
      .finally(endLocalSession);
  }, [endLocalSession]);

  // notifyUnauthorized() fires from client.ts (401 REST response) and
  // socket.ts (UNAUTHORIZED connect_error) - neither can import this context
  // directly, so they report through the authEvents registry instead.
  //
  // It clears local state only. The session is already gone server-side by
  // definition - that is what the 401 said - so calling POST /auth/logout here
  // would only add a second, guaranteed-to-fail request on top of the first.
  const endLocalSessionRef = useRef(endLocalSession);
  useEffect(() => {
    endLocalSessionRef.current = endLocalSession;
  }, [endLocalSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => endLocalSessionRef.current());
    return () => setUnauthorizedHandler(null);
  }, []);

  if (initializing) {
    return <div className="flex items-center justify-center h-screen text-ink-light">{t('settings.loading')}</div>;
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
