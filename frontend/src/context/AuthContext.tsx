import {
  createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode,
} from 'react';
import { setToken } from '../api/client';
import * as authApi from '../api/auth';
import type { AuthUser, UserRole } from '../api/types';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const result = await authApi.refresh();
        setToken(result.accessToken);
        const user = await authApi.getMe();
        if (mounted) setState({ user, token: result.accessToken, loading: false });
      } catch {
        setToken(null);
        if (mounted) setState({ user: null, token: null, loading: false });
      }
    })();
    return () => { mounted = false; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    setToken(result.accessToken);
    setState({ user: result.user, token: result.accessToken, loading: false });
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    setToken(null);
    setState({ user: null, token: null, loading: false });
  }, []);

  const isRole = useCallback((...roles: UserRole[]) => {
    return state.user ? roles.includes(state.user.role) : false;
  }, [state.user]);

  const value = useMemo<AuthContextValue>(
    () => ({ user: state.user, token: state.token, loading: state.loading, login, logout, isRole }),
    [state.user, state.token, state.loading, login, logout, isRole]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

export type { AuthUser, UserRole };
