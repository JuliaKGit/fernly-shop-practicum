import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch, TOKEN_KEY } from '../api/client';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setReady(true);
      return;
    }
    apiFetch<User>('/auth/me')
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setReady(true));
  }, []);

  const accept = useCallback(
    (result: { token: string; user: User }) => {
      localStorage.setItem(TOKEN_KEY, result.token);
      setUser(result.user);
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
    [queryClient],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      accept(await apiFetch<{ token: string; user: User }>('/auth/login', { method: 'POST', body: { email, password } }));
    },
    [accept],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      accept(await apiFetch<{ token: string; user: User }>('/auth/register', { method: 'POST', body: { name, email, password } }));
    },
    [accept],
  );

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    queryClient.removeQueries({ queryKey: ['cart'] });
    queryClient.removeQueries({ queryKey: ['orders'] });
  }, [queryClient]);

  const value = useMemo(() => ({ user, ready, signIn, register, signOut }), [user, ready, signIn, register, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
