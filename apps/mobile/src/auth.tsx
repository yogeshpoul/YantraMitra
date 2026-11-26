import type { MeDto } from '@yantramitra/shared-types';
import type { LoginInput, RegisterInput } from '@yantramitra/shared-validation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, onSessionLost } from './api';

interface AuthState {
  user: MeDto | null;
  loading: boolean;
  login: (i: LoginInput) => Promise<MeDto>;
  register: (i: RegisterInput) => Promise<MeDto>;
  logout: () => Promise<void>;
  setUser: (u: MeDto) => void;
}
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth.restore().then(setUser, () => setUser(null)).finally(() => setLoading(false));
    return onSessionLost(() => setUser(null));
  }, []);

  const login = useCallback(async (i: LoginInput) => { const me = await api.auth.login(i); setUser(me); return me; }, []);
  const register = useCallback(async (i: RegisterInput) => { const me = await api.auth.register(i); setUser(me); return me; }, []);
  const logout = useCallback(async () => { try { await api.auth.logout(); } finally { setUser(null); } }, []);
  const value = useMemo(() => ({ user, loading, login, register, logout, setUser }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
