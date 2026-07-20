import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { apiLogin, apiRegister, apiLogout, setCurrentUserId, type AuthUser } from '../api/client';
import { queryClient } from '../api/queryClient';
import { connectSocket, disconnectSocket } from '../utils/socket';
import { useOfflineQueueReplay } from '../hooks/useOfflineQueueReplay';
import { clearUserMutations } from '../utils/offlineQueue';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
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

  const register = useCallback(async (email: string, password: string) => {
    const u = await apiRegister(email, password);
    setUser(u);
    setIsAuthenticated(true);
    setCurrentUserId(u.id);
  }, []);

  const logout = useCallback(() => {
    const uid = user?.id;
    apiLogout()
      .catch(() => {})
      .finally(() => {
        setUser(null);
        setIsAuthenticated(false);
        setCurrentUserId(null);
        queryClient.clear();
        if (uid) {
          clearUserMutations(uid).catch(() => {});
        }
      });
  }, [user]);

  if (initializing) {
    return <div className="flex items-center justify-center h-screen text-ink-light">Loading...</div>;
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
