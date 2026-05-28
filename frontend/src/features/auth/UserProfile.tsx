// src/features/auth/UserProfile.tsx
// Page profil utilisateur - accessible à tous les utilisateurs connectés (/profil).
//
// Trois sections :
//   1. Informations personnelles (prénom/nom modifiables, email/rôle/campus en lecture)
//   2. Changement de mot de passe avec indicateur de force temps réel
//   3. Préférences (thème clair/sombre + toggle notifications in-app)

import { useState, useEffect } from 'react';
import { profileEndpoints } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { ThemePreference } from '../../context/ThemeContext';
import { ROLE_LABELS, CAMPUS_LABELS } from '../../utils/constants';
import type { User } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NOTIF_KEY = 'phila_notif_enabled';

function passwordScore(pwd: string): { score: number; criteria: boolean[] } {
  const criteria = [
    pwd.length >= 8,
    /[A-Z]/.test(pwd),
    /[0-9]/.test(pwd),
    /[^A-Za-z0-9]/.test(pwd),
  ];
  return { score: criteria.filter(Boolean).length, criteria };
}

function strengthLabel(score: number): { label: string; color: string } {
  if (score <= 1) return { label: 'Faible',  color: '#DC2626' };
  if (score <= 2) return { label: 'Moyen',   color: '#D97706' };
  if (score === 3) return { label: 'Bon',    color: '#2563EB' };
  return               { label: 'Fort',     color: '#16a34a' };
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function UserProfile() {
  const { user, updateUser } = useAuth();
  const { theme, themePreference, setThemePreference } = useTheme();

  // ── Section 1 : infos personnelles ──────────────────────────────────────────
  const [prenom,      setPrenom]      = useState(user?.prenom     ?? '');
  const [nom,         setNom]         = useState(user?.nom        ?? '');
  const [telephone,   setTelephone]   = useState(user?.telephone  ?? '');
  const [infoSaving,  setInfoSaving]  = useState(false);
  const [infoToast,   setInfoToast]   = useState<string | null>(null);

  // ── Section 2 : mot de passe ─────────────────────────────────────────────────
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [pwdSaving,   setPwdSaving]   = useState(false);
  const [pwdToast,    setPwdToast]    = useState<string | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Section 3 : préférences ──────────────────────────────────────────────────
  const [notifEnabled, setNotifEnabled] = useState(
    () => localStorage.getItem(NOTIF_KEY) !== 'false'
  );

  // Sync prénom/nom/téléphone si l'user change dans le contexte
  useEffect(() => {
    if (user) { setPrenom(user.prenom); setNom(user.nom); setTelephone(user.telephone ?? ''); }
  }, [user]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!prenom.trim() || !nom.trim()) return;
    setInfoSaving(true);
    try {
      const res = await profileEndpoints.update({
        prenom:    prenom.trim(),
        nom:       nom.trim(),
        telephone: telephone.trim() || undefined,
      });
      updateUser({ prenom: res.data.prenom, nom: res.data.nom, telephone: res.data.telephone });
      toast(setInfoToast, 'Profil mis à jour');
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(setInfoToast, msg ?? 'Erreur lors de la sauvegarde');
    } finally { setInfoSaving(false); }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd !== confirmPwd) { toast(setPwdToast, 'Les mots de passe ne correspondent pas'); return; }
    const { score } = passwordScore(newPwd);
    if (score < 2) { toast(setPwdToast, 'Mot de passe trop faible'); return; }
    setPwdSaving(true);
    try {
      await profileEndpoints.changePassword({ current_password: currentPwd, new_password: newPwd });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      toast(setPwdToast, 'Mot de passe modifié avec succès');
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(setPwdToast, msg ?? 'Erreur lors du changement');
    } finally { setPwdSaving(false); }
  }

  function toggleNotif() {
    const next = !notifEnabled;
    setNotifEnabled(next);
    localStorage.setItem(NOTIF_KEY, String(next));
  }

  if (!user) return null;

  const { score, criteria } = passwordScore(newPwd);
  const strength = newPwd ? strengthLabel(score) : null;
  const initials = `${user.prenom[0]}${user.nom[0]}`.toUpperCase();

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px) clamp(12px, 3vw, 32px)', maxWidth: 640, margin: '0 auto' }}>

      <h1 style={{ margin: '0 0 28px', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
        Mon profil
      </h1>

      {/* ── Section 1 : Informations personnelles ── */}
      <Section title="Informations personnelles">
        <form onSubmit={e => void handleSaveInfo(e)}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 24 }}>
            {/* Grand avatar */}
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: '#1D4ED8',
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800, flexShrink: 0,
              letterSpacing: '-0.5px',
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                {user.prenom} {user.nom}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {user.email}
              </div>
              <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <RoleBadge role={user} />
                {user.campus.map(c => (
                  <span key={c} style={campusBadge}>{CAMPUS_LABELS[c]}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Prénom *">
              <input
                required value={prenom}
                onChange={e => setPrenom(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Nom *">
              <input
                required value={nom}
                onChange={e => setNom(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Numéro WhatsApp" style={{ gridColumn: '1 / -1' }}>
              <input
                type="tel"
                value={telephone}
                onChange={e => setTelephone(e.target.value)}
                placeholder="+33612345678"
                style={inputStyle}
              />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                Format international E.164 (ex: +33612345678). Utilisé pour recevoir les réponses WhatsApp de vos contacts.
              </span>
            </Field>
            <Field label="Email" style={{ gridColumn: '1 / -1' }}>
              <input value={user.email} readOnly disabled style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                L'email est votre identifiant de connexion et ne peut pas être modifié ici.
              </span>
            </Field>
            <Field label="Rôle">
              <input value={ROLE_LABELS[user.role]} readOnly disabled style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} />
            </Field>
            <Field label="Campus">
              <input value={user.campus.map(c => CAMPUS_LABELS[c]).join(', ') || '-'} readOnly disabled style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} />
            </Field>
          </div>

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" disabled={infoSaving} style={btnPrimary}>
              {infoSaving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
            {infoToast && <span style={{ fontSize: 13, color: infoToast.includes('rreur') ? '#DC2626' : '#16a34a' }}>{infoToast}</span>}
          </div>
        </form>
      </Section>

      {/* ── Section 2 : Mot de passe ── */}
      <Section title="Changer le mot de passe">
        <form onSubmit={e => void handleChangePassword(e)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <Field label="Mot de passe actuel *">
              <PasswordInput value={currentPwd} onChange={setCurrentPwd} show={showCurrent} onToggle={() => setShowCurrent(s => !s)} placeholder="Mot de passe actuel" />
            </Field>

            <Field label="Nouveau mot de passe *">
              <PasswordInput value={newPwd} onChange={setNewPwd} show={showNew} onToggle={() => setShowNew(s => !s)} placeholder="Au moins 8 caractères" />

              {/* Indicateur de force */}
              {newPwd && strength && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} style={{
                        flex: 1, height: 4, borderRadius: 2,
                        background: i <= score ? strength.color : 'var(--bg-secondary)',
                        transition: '200ms ease',
                      }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: strength.color, marginBottom: 6 }}>
                    {strength.label}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                    {[
                      ['8 caractères minimum',    criteria[0]],
                      ['1 majuscule',             criteria[1]],
                      ['1 chiffre',               criteria[2]],
                      ['1 caractère spécial',     criteria[3]],
                    ].map(([label, met]) => (
                      <span key={label as string} style={{ fontSize: 11, color: met ? '#16a34a' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        {met ? '✓' : '○'} {label as string}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Field>

            <Field label="Confirmer le nouveau mot de passe *">
              <PasswordInput
                value={confirmPwd}
                onChange={setConfirmPwd}
                show={showConfirm}
                onToggle={() => setShowConfirm(s => !s)}
                placeholder="Répétez le nouveau mot de passe"
                error={confirmPwd !== '' && confirmPwd !== newPwd}
              />
              {confirmPwd && confirmPwd !== newPwd && (
                <span style={{ fontSize: 11, color: '#DC2626' }}>Les mots de passe ne correspondent pas</span>
              )}
            </Field>
          </div>

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="submit"
              disabled={pwdSaving || !currentPwd || newPwd !== confirmPwd || score < 2}
              style={{ ...btnPrimary, opacity: (!currentPwd || newPwd !== confirmPwd || score < 2) ? 0.5 : 1 }}
            >
              {pwdSaving ? 'Modification…' : 'Changer le mot de passe'}
            </button>
            {pwdToast && <span style={{ fontSize: 13, color: pwdToast.includes('rreur') || pwdToast.includes('ncorrect') ? '#DC2626' : '#16a34a' }}>{pwdToast}</span>}
          </div>
        </form>
      </Section>

      {/* ── Section 3 : Préférences ── */}
      <Section title="Préférences">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0' }}>
            <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>
              {theme === 'dark' ? '🌙' : themePreference === 'auto' ? '🔄' : '☀️'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Thème de l'interface</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                {themePreference === 'auto' ? 'Suit le thème système' : themePreference === 'dark' ? 'Mode sombre' : 'Mode clair'}
              </div>
            </div>
            <select
              value={themePreference}
              onChange={e => setThemePreference(e.target.value as ThemePreference)}
              style={{
                padding: '6px 10px', borderRadius: 8,
                border: '1px solid var(--bg-card-border)',
                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <option value="auto">Automatique</option>
              <option value="light">Clair</option>
              <option value="dark">Sombre</option>
            </select>
          </div>

          <div style={{ height: 1, background: 'var(--bg-card-border)', margin: '4px 0' }} />

          <ToggleRow
            label="Notifications in-app"
            description="Recevoir des alertes dans l'application (badge cloche)"
            icon="🔔"
            checked={notifEnabled}
            onChange={toggleNotif}
          />
        </div>
      </Section>
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
      borderRadius: 12, marginBottom: 20, overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bg-card-border)', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
        {title}
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}

function PasswordInput({ value, onChange, show, onToggle, placeholder, error }: {
  value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; placeholder?: string; error?: boolean;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        required value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, paddingRight: 40, borderColor: error ? '#DC2626' : undefined }}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', display: 'flex', alignItems: 'center', lineHeight: 1 }}
      >
        {show ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  );
}

function ToggleRow({ label, description, icon, checked, onChange }: {
  label: string; description: string; icon: string;
  checked: boolean; onChange: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0' }}>
      <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{description}</div>
      </div>
      <button
        type="button" onClick={onChange}
        style={{
          width: 44, height: 24, borderRadius: 12,
          background: checked ? 'var(--accent-teal)' : 'var(--bg-secondary)',
          border: '2px solid ' + (checked ? 'var(--accent-teal)' : 'var(--bg-card-border)'),
          cursor: 'pointer', position: 'relative', transition: '200ms ease', flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: checked ? 22 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: checked ? '#fff' : 'var(--text-tertiary)',
          transition: '200ms ease',
        }} />
      </button>
    </div>
  );
}

function RoleBadge({ role }: { role: User }) {
  const ROLE_CFG: Record<string, { bg: string; text: string }> = {
    super_admin:           { bg: 'var(--badge-integre-bg)',   text: 'var(--badge-integre-text)' },
    admin_campus:          { bg: 'var(--badge-contacte-bg)',  text: 'var(--badge-contacte-text)' },
    referent_eglise:       { bg: 'var(--badge-ensuivi-bg)',   text: 'var(--badge-ensuivi-text)' },
    referent_integration:  { bg: 'var(--badge-nouveau-bg)',   text: 'var(--badge-nouveau-text)' },
    lecteur:               { bg: 'var(--badge-inactif-bg)',   text: 'var(--badge-inactif-text)' },
  };
  const cfg = ROLE_CFG[role.role] ?? { bg: 'var(--bg-secondary)', text: 'var(--text-secondary)' };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: cfg.bg, color: cfg.text }}>
      {ROLE_LABELS[role.role]}
    </span>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid var(--bg-card-border)',
  borderRadius: 8, background: 'var(--bg-primary)', color: 'var(--text-primary)',
  fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
};

const btnPrimary: React.CSSProperties = {
  padding: '9px 20px', background: 'var(--accent-teal)', color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};

const campusBadge: React.CSSProperties = {
  fontSize: 11, padding: '2px 7px', borderRadius: 4,
  background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
};

function toast(set: React.Dispatch<React.SetStateAction<string | null>>, msg: string) {
  set(msg);
  setTimeout(() => set(null), 4000);
}
