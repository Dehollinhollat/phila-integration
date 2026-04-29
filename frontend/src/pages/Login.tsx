// src/pages/Login.tsx
// Page de connexion — point d'entrée de l'interface d'administration.
// Affiche le logo Phila, un formulaire email/mot de passe, et redirige
// vers /dashboard après authentification réussie.

import { useState, FormEvent } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  colors, typography, spacing, radius, shadows, transitions,
} from '../components/ui/tokens';
import axios from 'axios';

export default function Login() {
  const { login, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);

  // Redirige si déjà authentifié
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await login({ email, password });
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.message as string | undefined;
        setError(msg ?? 'Identifiants invalides');
      } else {
        setError('Impossible de contacter le serveur');
      }
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Logo */}
        <div style={S.logoArea}>
          <img
            src="/src/assets/images/LOGO-PHILA-BLEU.png"
            alt="Phila Cité des Adorateurs"
            style={S.logo}
          />
          <h1 style={S.title}>Phila Intégration</h1>
          <p style={S.subtitle}>Espace d'administration — Cité des Adorateurs</p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} style={S.form} noValidate>
          {error && (
            <div style={S.errorBanner} role="alert">
              {error}
            </div>
          )}

          <div style={S.field}>
            <label htmlFor="email" style={S.label}>Adresse email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              placeholder="votre@email.com"
              style={S.input}
            />
          </div>

          <div style={S.field}>
            <label htmlFor="password" style={S.label}>Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={S.input}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              ...S.submitBtn,
              opacity:    loading || !email || !password ? 0.6 : 1,
              cursor:     loading || !email || !password ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p style={S.footer}>
          Accès réservé aux membres du département d'intégration
        </p>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight:      '100vh',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    background:     `linear-gradient(135deg, ${colors.primaryLight} 0%, ${colors.white} 60%)`,
    padding:        spacing[4],
  },
  card: {
    background:   colors.white,
    borderRadius: radius.xl,
    boxShadow:    shadows.xl,
    padding:      `${spacing[10]} ${spacing[8]}`,
    width:        '100%',
    maxWidth:     '400px',
    border:       `0.5px solid ${colors.gray200}`,
  },
  logoArea: {
    textAlign:    'center' as const,
    marginBottom: spacing[8],
  },
  logo: {
    width:        '72px',
    height:       'auto',
    marginBottom: spacing[4],
  },
  title: {
    margin:      0,
    fontSize:    typography.fontSize['2xl'],
    fontWeight:  typography.fontWeight.bold,
    color:       colors.primary,
    letterSpacing: '-0.5px',
  },
  subtitle: {
    margin:    `${spacing[1]} 0 0`,
    fontSize:  typography.fontSize.sm,
    color:     colors.gray500,
  },
  form: {
    display:       'flex',
    flexDirection: 'column' as const,
    gap:           spacing[4],
  },
  errorBanner: {
    background:   colors.dangerLight,
    color:        colors.danger,
    borderRadius: radius.md,
    padding:      `${spacing[3]} ${spacing[4]}`,
    fontSize:     typography.fontSize.sm,
    border:       `1px solid ${colors.danger}22`,
  },
  field: {
    display:       'flex',
    flexDirection: 'column' as const,
    gap:           spacing[1],
  },
  label: {
    fontSize:   typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color:      colors.gray700,
  },
  input: {
    padding:      `${spacing[3]} ${spacing[4]}`,
    border:       `1px solid ${colors.gray300}`,
    borderRadius: radius.md,
    fontSize:     typography.fontSize.base,
    color:        colors.gray900,
    background:   colors.white,
    outline:      'none',
    transition:   transitions.fast,
    width:        '100%',
    boxSizing:    'border-box' as const,
  },
  submitBtn: {
    padding:      `${spacing[3]} ${spacing[4]}`,
    background:   colors.primary,
    color:        colors.white,
    border:       'none',
    borderRadius: radius.md,
    fontSize:     typography.fontSize.md,
    fontWeight:   typography.fontWeight.semibold,
    transition:   transitions.normal,
    marginTop:    spacing[2],
  },
  footer: {
    marginTop:  spacing[6],
    textAlign:  'center' as const,
    fontSize:   typography.fontSize.xs,
    color:      colors.gray400,
  },
} as const;
