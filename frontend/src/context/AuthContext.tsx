// src/context/AuthContext.tsx
// Contexte d'authentification — fournit token JWT, infos utilisateur,
// et fonctions login/logout à toute l'application.
// Persiste le token dans localStorage sous la clé "phila_token".

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { User, LoginPayload, LoginResponse } from '../types';
import api from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user:    User | null;
  token:   string | null;
  loading: boolean;
  login:   (payload: LoginPayload) => Promise<void>;
  logout:  () => void;
  isAuthenticated: boolean;
}

// ─── Contexte ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'phila_token';
const USER_KEY  = 'phila_user';

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialisation depuis localStorage pour survivre aux rechargements de page
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
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback((): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, logout, isAuthenticated: !!token }}
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
