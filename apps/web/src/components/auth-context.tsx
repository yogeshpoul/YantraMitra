'use client';
import type { MeDto } from '@yantramitra/shared-types';
import type { LoginInput, RegisterInput } from '@yantramitra/shared-validation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, onSessionLost } from '@/lib/client-api';

interface AuthState {
  user: MeDto | null;
  /** True until the stored session has been checked */
  loading: boolean;
  login: (input: LoginInput) => Promise<MeDto>;
  register: (input: RegisterInput) => Promise<MeDto>;
  logout: () => Promise<void>;
  setUser: (user: MeDto) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.auth.restore().then(
      (me) => alive && setUser(me),
      () => alive && setUser(null),
    ).finally(() => alive && setLoading(false));
    const off = onSessionLost(() => setUser(null));
    return () => { alive = false; off(); };
  }, []);

  const login = useCallback(async (input: LoginInput) => { const me = await api.auth.login(input); setUser(me); return me; }, []);
  const register = useCallback(async (input: RegisterInput) => { const me = await api.auth.register(input); setUser(me); return me; }, []);
  const logout = useCallback(async () => { try { await api.auth.logout(); } finally { setUser(null); } }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, setUser }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
