// src/context/ThemeContext.tsx
// Gestion du thème light/dark/auto de l'application.
// - 'auto' : suit prefers-color-scheme du système (supprime la clé localStorage)
// - 'light' / 'dark' : choix explicite persisté sous 'phila-theme'
// - Migration transparente depuis l'ancienne clé 'phila_theme' (underscore)

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

export type Theme           = 'light' | 'dark';
export type ThemePreference = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'phila-theme';

interface ThemeContextValue {
  theme:              Theme;
  themePreference:    ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
  toggleTheme:        () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme:              'light',
  themePreference:    'auto',
  setThemePreference: () => {},
  toggleTheme:        () => {},
});

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredPreference(): ThemePreference {
  // Migrate old key 'phila_theme' → 'phila-theme'
  const old = localStorage.getItem('phila_theme');
  if (old === 'light' || old === 'dark') {
    localStorage.setItem(STORAGE_KEY, old);
    localStorage.removeItem('phila_theme');
    return old;
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'auto';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readStoredPreference);
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme);

  // Track system changes — relevant only when preference is 'auto'
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const theme: Theme = preference === 'auto' ? systemTheme : preference;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setThemePreference = useCallback((pref: ThemePreference) => {
    setPreference(pref);
    if (pref === 'auto') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, pref);
    }
  }, []);

  // Toggle switches between opposite of currently displayed theme (ignores 'auto' state)
  const toggleTheme = useCallback(() => {
    setThemePreference(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setThemePreference]);

  return (
    <ThemeContext.Provider value={{ theme, themePreference: preference, setThemePreference, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
