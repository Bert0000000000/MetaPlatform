/**
 * 认证 Context Provider
 *
 * 提供全局认证状态：当前用户、登录态、登录/登出方法。
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import {
  getToken,
  getUser,
  removeToken,
  setToken,
  setUser as persistUser,
  setRefreshToken,
  isLoggedIn as checkLoggedIn,
  type AuthUser,
} from './token';

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (user: AuthUser, accessToken: string, refreshToken?: string) => void;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getUser());
  const [token, setTokenState] = useState<string | null>(() => getToken());

  const login = useCallback((newUser: AuthUser, accessToken: string, refreshToken?: string) => {
    setToken(accessToken);
    if (refreshToken) setRefreshToken(refreshToken);
    persistUser(newUser);
    setUser(newUser);
    setTokenState(accessToken);
  }, []);

  const logout = useCallback(() => {
    removeToken();
    setUser(null);
    setTokenState(null);
  }, []);

  const refreshUser = useCallback(() => {
    setUser(getUser());
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!token && checkLoggedIn(),
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
