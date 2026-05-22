// src/pages/Login.tsx
// Page de connexion - point d'entrée de l'interface d'administration.
// Affiche le logo Phila, un formulaire email/mot de passe, et redirige
// vers /dashboard après authentification réussie.

import { useState, type FormEvent } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  colors, typography, spacing, radius, shadows, transitions,
} from '../components/ui/tokens';
import Logo from '../components/ui/Logo';
import Footer from '../components/common/Footer';
import axios from 'axios';

export default function Login() {
  const { login, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

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
    <>
    <style>{`
      .login-input::placeholder { color: #64748B !important; }
      .login-input { color: #0F172A !important; background: #F1F5F9 !important; border: 2px solid #94A3B8 !important; }
    `}</style>
    <div style={S.page}>
      <div style={S.inner}>
      <div style={S.card}>
        {/* Logo */}
        <div style={S.logoArea}>
          <Logo width={72} height={72} style={{ marginBottom: spacing[4] }} />
          <h1 style={S.title}>Phila Intégration</h1>
          <p style={S.subtitle}>Espace d'administration - Cité des Adorateurs</p>
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
              className="login-input"
              style={S.input}
            />
          </div>

          <div style={S.field}>
            <label htmlFor="password" style={S.label}>Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="login-input"
                style={{ ...S.input, paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                style={S.eyeBtn}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...S.submitBtn,
              opacity: loading ? 0.6 : 1,
              cursor:  loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>

          <div style={{ textAlign: 'center' }}>
            <Link to="/forgot-password" style={S.forgotLink}>
              Mot de passe oublié ?
            </Link>
          </div>
        </form>

        <p style={S.footer}>
          Accès réservé aux membres du département d'intégration
        </p>
      </div>
      </div>
      <Footer />
    </div>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
//
// Les couleurs de texte et de fond des inputs sont intentionnellement hardcodées
// en hex plutôt qu'en tokens ou CSS variables. Sur mobile (WebKit / Safari iOS),
// la page de login s'affiche en dehors du ProtectedLayout et peut ne pas hériter
// correctement du thème ; les CSS variables non résolues donnent du texte blanc
// sur fond blanc, rendant les champs invisibles en mode clair.
// Les valeurs hardcodées garantissent la lisibilité quelle que soit la résolution
// des variables CSS sur la plateforme cible.

const S = {
  page: {
    minHeight:      '100vh',
    display:        'flex',
    flexDirection:  'column' as const,
    background:     `linear-gradient(135deg, ${colors.primaryLight} 0%, ${colors.white} 60%)`,
  },
  inner: {
    flex:           1,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
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
  title: {
    margin:        0,
    // Hardcodé : les tokens primary peuvent résoudre en couleur sombre illisible sur certains
    // rendus mobiles ; #0F172A (slate-900) est toujours lisible sur fond blanc.
    fontSize:      '24px',
    fontWeight:    700,
    color:         '#0F172A',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    margin:   `${spacing[1]} 0 0`,
    fontSize: '14px',
    color:    '#475569', // slate-600 — contraste suffisant sur fond blanc (WCAG AA)
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
    display:      'block',
    marginBottom: '6px',
    fontSize:     '14px',
    fontWeight:   600,
    color:        '#1E293B', // slate-800 — lisible sur fond blanc sans dépendre des variables
  },
  input: {
    // Fond et texte hardcodés : évite le fond blanc + texte blanc sur mobile mode clair
    // quand les CSS variables --bg-input / --text-primary ne sont pas encore résolues.
    width:        '100%',
    padding:      '14px 16px',
    borderRadius: '8px',
    border:       '2px solid #94A3B8',   // slate-400 — bordure plus visible sur mobile
    background:   '#F1F5F9',             // slate-100 — fond clairement distinct du blanc pur
    color:        '#0F172A',             // slate-900 — texte très sombre, contraste élevé
    fontSize:     '16px',               // 16px minimum évite le zoom automatique iOS
    outline:      'none',
    transition:   transitions.fast,
    boxSizing:    'border-box' as const,
  },
  eyeBtn: {
    position:   'absolute' as const,
    right:      '12px',
    top:        '50%',
    transform:  'translateY(-50%)',
    background: 'none',
    border:     'none',
    cursor:     'pointer',
    color:      colors.gray500,
    padding:    '4px',
    display:    'flex',
    alignItems: 'center',
    lineHeight: 1,
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
  forgotLink: {
    fontSize:       typography.fontSize.sm,
    color:          colors.primary,
    textDecoration: 'none',
  },
  footer: {
    marginTop: spacing[6],
    textAlign: 'center' as const,
    fontSize:  '12px',
    color:     '#64748B', // slate-500 — note de bas de page, contraste suffisant sur fond blanc
  },
} as const;
