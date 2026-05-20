// src/pages/ResetPassword.tsx
// Page de définition d'un nouveau mot de passe.
// Le token est lu depuis le paramètre d'URL ?token=... (envoyé par email).

import { useState, FormEvent } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import axios from 'axios';
import {
  colors, typography, spacing, radius, shadows, transitions,
} from '../components/ui/tokens';
import Logo from '../components/ui/Logo';
import Footer from '../components/common/Footer';

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
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
  );
}

function passwordStrength(pwd: string): { score: number; label: string; color: string } {
  if (pwd.length === 0) return { score: 0, label: '', color: colors.gray200 };
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd))  score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const clamped = Math.min(score, 4);
  const labels  = ['', 'Faible', 'Moyen', 'Fort', 'Très fort'];
  const colorMap = [colors.gray200, colors.danger, colors.secondary, colors.success, colors.success];
  return { score: clamped, label: labels[clamped], color: colorMap[clamped] };
}

export default function ResetPassword() {
  const [searchParams]              = useSearchParams();
  const navigate                    = useNavigate();
  const token                       = searchParams.get('token') ?? '';

  const [password,     setPassword]     = useState('');
  const [confirm,      setConfirm]      = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [done,         setDone]         = useState(false);

  const strength = passwordStrength(password);
  const mismatch = confirm.length > 0 && password !== confirm;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
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

  if (!token) {
    return (
      <div style={S.page}>
        <div style={S.inner}>
          <div style={S.card}>
            <p style={{ color: colors.danger, textAlign: 'center' }}>
              Lien invalide ou expiré.{' '}
              <Link to="/forgot-password" style={S.link}>Faire une nouvelle demande</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.inner}>
        <div style={S.card}>
          <div style={S.logoArea}>
            <Logo width={56} height={56} style={{ marginBottom: spacing[3] }} />
            <h1 style={S.title}>Phila Intégration</h1>
          </div>

          {done ? (
            <div style={S.successBox}>
              <p style={S.successText}>
                Mot de passe modifié avec succès. Redirection vers la page de connexion…
              </p>
            </div>
          ) : (
            <>
              <h2 style={S.heading}>Nouveau mot de passe</h2>
              <p style={S.description}>
                Choisissez un nouveau mot de passe d'au moins 8 caractères.
              </p>

              <form onSubmit={handleSubmit} style={S.form} noValidate>
                {error && (
                  <div style={S.errorBanner} role="alert">{error}</div>
                )}

                <div style={S.field}>
                  <label htmlFor="password" style={S.label}>Nouveau mot de passe</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoFocus
                      autoComplete="new-password"
                      placeholder="••••••••"
                      style={{ ...S.input, paddingRight: '44px' }}
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Masquer' : 'Afficher'} style={S.eyeBtn}>
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div style={{ marginTop: spacing[1] }}>
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                        {[1, 2, 3, 4].map(i => (
                          <div
                            key={i}
                            style={{
                              flex: 1,
                              height: '4px',
                              borderRadius: '2px',
                              background: i <= strength.score ? strength.color : colors.gray200,
                              transition: transitions.fast,
                            }}
                          />
                        ))}
                      </div>
                      {strength.label && (
                        <span style={{ fontSize: typography.fontSize.xs, color: strength.color }}>
                          {strength.label}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div style={S.field}>
                  <label htmlFor="confirm" style={S.label}>Confirmer le mot de passe</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="confirm"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="••••••••"
                      style={{
                        ...S.input,
                        paddingRight:  '44px',
                        borderColor: mismatch ? colors.danger : colors.gray300,
                      }}
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? 'Masquer' : 'Afficher'} style={S.eyeBtn}>
                      <EyeIcon open={showConfirm} />
                    </button>
                  </div>
                  {mismatch && (
                    <span style={{ fontSize: typography.fontSize.xs, color: colors.danger }}>
                      Les mots de passe ne correspondent pas
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || password.length < 8 || password !== confirm}
                  style={{
                    ...S.submitBtn,
                    opacity: loading || password.length < 8 || password !== confirm ? 0.6 : 1,
                    cursor:  loading || password.length < 8 || password !== confirm ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Modification…' : 'Modifier le mot de passe'}
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
    maxWidth:     '420px',
    border:       `0.5px solid ${colors.gray200}`,
  },
  logoArea: {
    textAlign:    'center' as const,
    marginBottom: spacing[6],
  },
  title: {
    margin:        0,
    fontSize:      typography.fontSize['2xl'],
    fontWeight:    typography.fontWeight.bold,
    color:         colors.primary,
    letterSpacing: '-0.5px',
  },
  heading: {
    margin:     `0 0 ${spacing[2]}`,
    fontSize:   typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color:      colors.gray900,
  },
  description: {
    margin:     `0 0 ${spacing[6]}`,
    fontSize:   typography.fontSize.sm,
    color:      colors.gray500,
    lineHeight: '1.6',
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
