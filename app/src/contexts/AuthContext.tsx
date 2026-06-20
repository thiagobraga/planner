import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { apiLogin, apiRegister, apiLogout, hasToken, getToken, type AuthUser } from '../api/client';
import { connectSocket, disconnectSocket } from '../utils/socket';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // If token exists in storage, treat as authenticated until first API call proves otherwise
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(hasToken());

  // Connect socket when authenticated, disconnect on logout
  useEffect(() => {
    if (isAuthenticated) {
      const token = getToken();
      if (token) connectSocket(token);
    } else {
      disconnectSocket();
    }
  }, [isAuthenticated]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
    setIsAuthenticated(true);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const u = await apiRegister(email, password, displayName);
    setUser(u);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

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
