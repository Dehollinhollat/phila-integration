// src/pages/ForgotPassword.tsx
// Page de demande de réinitialisation de mot de passe.
// Envoie un email avec un lien temporaire (1h) via le backend.

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import axios from 'axios';
import {
  colors, typography, spacing, radius, shadows, transitions,
} from '../components/ui/tokens';
import Logo from '../components/ui/Logo';
import Footer from '../components/common/Footer';

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message ?? 'Une erreur est survenue');
      } else {
        setError('Impossible de contacter le serveur');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.inner}>
        <div style={S.card}>
          <div style={S.logoArea}>
            <Logo width={56} height={56} style={{ marginBottom: spacing[3] }} />
            <h1 style={S.title}>Phila Intégration</h1>
          </div>

          {sent ? (
            <div style={S.successBox}>
              <p style={S.successText}>
                Si cette adresse est associée à un compte actif, vous recevrez un email avec les
                instructions dans quelques minutes.
              </p>
              <p style={{ ...S.successText, marginTop: spacing[2] }}>
                Pensez à vérifier votre dossier spam.
              </p>
            </div>
          ) : (
            <>
              <h2 style={S.heading}>Mot de passe oublié</h2>
              <p style={S.description}>
                Saisissez votre adresse email et nous vous enverrons un lien pour
                réinitialiser votre mot de passe.
              </p>

              <form onSubmit={handleSubmit} style={S.form} noValidate>
                {error && (
                  <div style={S.errorBanner} role="alert">{error}</div>
                )}

                <div style={S.field}>
                  <label htmlFor="email" style={S.label}>Adresse email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="email"
                    placeholder="votre@email.com"
                    style={S.input}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  style={{
                    ...S.submitBtn,
                    opacity: loading || !email ? 0.6 : 1,
                    cursor:  loading || !email ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Envoi en cours…' : 'Envoyer le lien'}
                </button>
              </form>
            </>
          )}

          <div style={S.backLink}>
            <Link to="/login" style={S.link}>← Retour à la connexion</Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    marginBottom: spacing[6],
  },
  title: {
    margin:      0,
    fontSize:    typography.fontSize['2xl'],
    fontWeight:  typography.fontWeight.bold,
    color:       colors.primary,
    letterSpacing: '-0.5px',
  },
  heading: {
    margin:       `0 0 ${spacing[2]}`,
    fontSize:     typography.fontSize.xl,
    fontWeight:   typography.fontWeight.bold,
    color:        colors.gray900,
  },
  description: {
    margin:       `0 0 ${spacing[6]}`,
    fontSize:     typography.fontSize.sm,
    color:        colors.gray500,
    lineHeight:   '1.6',
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
  successBox: {
    background:   colors.successLight,
    borderRadius: radius.md,
    padding:      `${spacing[4]} ${spacing[5]}`,
    border:       `1px solid ${colors.success}33`,
    marginBottom: spacing[4],
  },
  successText: {
    margin:     0,
    fontSize:   typography.fontSize.sm,
    color:      colors.success,
    lineHeight: '1.6',
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
  },
  backLink: {
    marginTop:  spacing[6],
    textAlign:  'center' as const,
  },
  link: {
    fontSize:       typography.fontSize.sm,
    color:          colors.primary,
    textDecoration: 'none',
  },
} as const;
