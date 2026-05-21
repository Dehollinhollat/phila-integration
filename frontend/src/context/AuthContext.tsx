// src/context/AuthContext.tsx
// Contexte d'authentification — fournit access token, refresh token, infos utilisateur,
// et fonctions login/logout à toute l'application.
// Persiste les tokens dans localStorage sous "phila_token" et "phila_refresh_token".

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { User, LoginPayload, LoginResponse } from '../types';
import api from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user:    User | null;
  token:   string | null;
  loading: boolean;
  login:   (payload: LoginPayload) => Promise<void>;
  logout:  () => void;
  updateUser: (updates: Partial<User>) => void;
  isAuthenticated: boolean;
}

// ─── Contexte ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY         = 'phila_token';
const REFRESH_TOKEN_KEY = 'phila_refresh_token';
const USER_KEY          = 'phila_user';

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(TOKEN_KEY)
  );
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? (JSON.parse(stored) as User) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (payload: LoginPayload): Promise<void> => {
    setLoading(true);
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', payload);
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setToken(data.accessToken);
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback((): void => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    // Révocation asynchrone — on ne bloque pas la déconnexion UI
    if (refreshToken) {
      api.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<User>): void => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, logout, updateUser, isAuthenticated: !!token }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
