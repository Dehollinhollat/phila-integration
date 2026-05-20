// src/features/auth/Onboarding.tsx
// Guide de première connexion — affiché une seule fois quand onboarding_complete = false.
// Les étapes sont filtrées par rôle ; après le dernier pas, PATCH /users/me/onboarding
// met onboarding_complete = true et redirige vers /dashboard.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileEndpoints } from '../../services/endpoints';
import type { Role } from '../../types';

// ─── Définition des étapes ────────────────────────────────────────────────────

interface Step {
  id: string;
  roles: Role[] | 'all';
  title: string;
  content: React.ReactNode;
}

function buildSteps(role: Role): Step[] {
  const allSteps: Step[] = [
    {
      id: 'bienvenue',
      roles: 'all',
      title: 'Bienvenue sur Phila Intégration',
      content: (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 72, marginBottom: 24 }}>🙏</div>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
            Cette application vous permet de <strong style={{ color: 'var(--text-primary)' }}>suivre
            et accompagner</strong> les nouveaux membres et visiteurs de l'église Phila Cité des Adorateurs.
          </p>
        </div>
      ),
    },
    {
      id: 'navigation',
      roles: 'all',
      title: 'Navigation',
      content: (
        <div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 0 }}>
            La barre latérale à gauche vous donne accès à toutes les fonctionnalités selon votre rôle.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            {getSectionsByRole(role).map(s => (
              <div key={s.label} style={{
                display:      'flex',
                alignItems:   'center',
                gap:          12,
                padding:      '10px 14px',
                borderRadius: 10,
                background:   'var(--bg-secondary)',
                border:       '1px solid var(--bg-card-border)',
              }}>
                <span style={{ fontSize: 20 }}>{s.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'referent-integration',
      roles: ['referent_integration'],
      title: 'Vos contacts assignés',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <InfoBlock icon="👥" text="Vos contacts assignés apparaissent dans la section Contacts." />
          <InfoBlock icon="✅" text="Cliquez sur un contact pour voir sa fiche et cocher les étapes de son parcours d'intégration." />
          <InfoBlock icon="🔔" text="Vous recevrez une notification à chaque nouveau contact qui vous est assigné." />
        </div>
      ),
    },
    {
      id: 'referent-eglise',
      roles: ['referent_eglise'],
      title: 'Votre rôle pastoral',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <InfoBlock icon="📋" text="Vous pouvez consulter les notes des référents d'intégration et ajouter vos propres notes pastorales." />
          <InfoBlock icon="🔒" text="Vos notes sont confidentielles et non visibles par les référents d'intégration." />
        </div>
      ),
    },
    {
      id: 'admin',
      roles: ['admin_campus', 'super_admin'],
      title: 'Administration',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <InfoBlock icon="🏛️" text="Vous gérez les contacts, les référents et les plannings de votre campus." />
          <InfoBlock icon="📊" text="Le dashboard vous donne une vue complète des statistiques et des alertes." />
          <InfoBlock icon="🔑" text="Pensez à changer votre mot de passe depuis votre profil si c'est votre première connexion." />
        </div>
      ),
    },
    {
      id: 'password',
      roles: 'all',
      title: 'Sécurité du compte',
      content: (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 24 }}>
            Pour votre sécurité, nous vous recommandons de <strong style={{ color: 'var(--text-primary)' }}>changer
            votre mot de passe</strong> si vous n'en avez pas encore défini un personnel.
          </p>
        </div>
      ),
    },
  ];

  return allSteps.filter(s => s.roles === 'all' || s.roles.includes(role));
}

function getSectionsByRole(role: Role) {
  const all = [
    { icon: '📊', label: 'Dashboard',    desc: 'Vue d\'ensemble et KPIs' },
    { icon: '👥', label: 'Contacts',     desc: 'Suivi des nouveaux membres' },
    { icon: '📋', label: 'Checklist',    desc: 'Parcours d\'intégration' },
    { icon: '🔔', label: 'Notifications', desc: 'Alertes et rappels' },
  ];
  const admin = [
    { icon: '👤', label: 'Référents',   desc: 'Gestion des référents' },
    { icon: '📅', label: 'Planning',    desc: 'Planning dominical' },
    { icon: '💬', label: 'Messagerie',  desc: 'Messages WhatsApp' },
    { icon: '⚙️', label: 'Admin',       desc: 'Gestion des comptes' },
  ];
  if (role === 'super_admin' || role === 'admin_campus') return [...all, ...admin];
  return all;
}

function InfoBlock({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'flex-start',
      gap:          12,
      padding:      '12px 14px',
      borderRadius: 10,
      background:   'var(--bg-secondary)',
      border:       '1px solid var(--bg-card-border)',
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{text}</p>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function Onboarding() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    document.dispatchEvent(new CustomEvent('modal-opened'));
  }, []);

  const role = user?.role ?? 'lecteur';
  const steps = buildSteps(role as Role);
  const current = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const isPasswordStep = current?.id === 'password';

  async function finish() {
    setCompleting(true);
    try {
      await profileEndpoints.completeOnboarding();
      updateUser({ onboarding_complete: true });
    } catch { /* silently complete — onboarding is non-blocking */ }
    navigate('/dashboard', { replace: true });
  }

  function next() {
    if (isLast) { finish(); return; }
    setStepIndex(i => i + 1);
  }

  function goToProfile() {
    finish(); // mark complete then redirect to profile
    // navigation happens in finish() → /dashboard; user can go to /profil themselves
    navigate('/profil', { replace: true });
  }

  if (!current) return null;

  return (
    <div style={{
      position:        'fixed',
      inset:           0,
      zIndex:          1000,
      background:      'rgba(0, 0, 0, 0.65)',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         '16px',
      backdropFilter:  'blur(4px)',
    }}>
      {/*
        Structure flex column :
        - progress bar   → flexShrink: 0 (hauteur fixe)
        - zone contenu   → flex: 1 1 auto + overflowY: auto (scrollable)
        - footer boutons → flexShrink: 0 (toujours visible en bas)
        Le bouton "Passer" est position: absolute avec zIndex élevé pour
        rester ancré en haut-droite même quand le contenu défile.
      */}
      <div style={{
        width:          '100%',
        maxWidth:       600,
        maxHeight:      '90vh',   // ← limite la hauteur totale du modal
        background:     'var(--bg-card)',
        borderRadius:   20,
        boxShadow:      '0 32px 80px rgba(0,0,0,0.35)',
        overflow:       'hidden',
        position:       'relative',
        display:        'flex',   // ← structure flex column pour le scroll interne
        flexDirection:  'column',
        animation:      'fadeIn 0.2s ease',
      }}>

        {/* Bouton "Passer le guide" — ancré en haut-droite de la card, zIndex au-dessus du scroll */}
        <button
          onClick={finish}
          disabled={completing}
          style={{
            position:     'absolute',
            top:          16,
            right:        20,
            zIndex:       10,       // ← au-dessus de la zone scrollable
            background:   'none',
            border:       'none',
            cursor:       completing ? 'not-allowed' : 'pointer',
            fontSize:     12,
            color:        'var(--text-tertiary)',
            padding:      '4px 8px',
            borderRadius: 6,
          }}
        >
          Passer le guide →
        </button>

        {/* Barre de progression — hors du scroll, hauteur fixe */}
        <div style={{ height: 4, background: 'var(--progress-bg)', flexShrink: 0 }}>
          <div style={{
            height:       '100%',
            background:   'var(--accent-teal)',
            width:        `${((stepIndex + 1) / steps.length) * 100}%`,
            transition:   'width 0.3s ease',
            borderRadius: '0 2px 2px 0',
          }} />
        </div>

        {/* Zone scrollable — absorbe l'espace disponible et défile si nécessaire */}
        <div style={{
          flex:       '1 1 auto',
          overflowY:  'auto',
          padding:    '36px 40px 8px',
        }}>
          {/* paddingTop: 36 laisse la place au bouton "Passer" positionné à top: 16 */}
          <div style={{ marginBottom: 8, paddingTop: 8 }}>
            <span style={{
              fontSize:      11,
              fontWeight:    600,
              color:         'var(--accent-teal)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Étape {stepIndex + 1} sur {steps.length}
            </span>
          </div>
          <h2 style={{
            margin:     '0 0 24px',
            fontSize:   22,
            fontWeight: 700,
            color:      'var(--text-primary)',
            lineHeight: 1.2,
          }}>
            {current.title}
          </h2>

          <div style={{ minHeight: 160 }}>
            {current.content}
          </div>
        </div>

        {/* Footer navigation — flexShrink: 0 + fond opaque pour rester visible en bas */}
        <div style={{
          flexShrink:     0,
          position:       'sticky',
          bottom:         0,
          background:     'var(--bg-card)',
          padding:        '16px 40px',
          borderTop:      '1px solid var(--bg-card-border)',
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          gap:            12,
        }}>
          <button
            onClick={() => setStepIndex(i => i - 1)}
            disabled={stepIndex === 0}
            style={{
              padding:      '9px 18px',
              background:   'var(--bg-secondary)',
              color:        'var(--text-secondary)',
              border:       '1px solid var(--bg-card-border)',
              borderRadius: 10,
              fontSize:     13,
              fontWeight:   600,
              cursor:       stepIndex === 0 ? 'not-allowed' : 'pointer',
              opacity:      stepIndex === 0 ? 0.4 : 1,
              fontFamily:   'inherit',
            }}
          >
            ← Précédent
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            {isPasswordStep && (
              <button
                onClick={goToProfile}
                style={{
                  padding:      '9px 18px',
                  background:   'var(--bg-secondary)',
                  color:        'var(--text-secondary)',
                  border:       '1px solid var(--bg-card-border)',
                  borderRadius: 10,
                  fontSize:     13,
                  fontWeight:   600,
                  cursor:       'pointer',
                  fontFamily:   'inherit',
                }}
              >
                Changer maintenant
              </button>
            )}
            <button
              onClick={next}
              disabled={completing}
              style={{
                padding:      '9px 20px',
                background:   'var(--accent-teal)',
                color:        '#fff',
                border:       'none',
                borderRadius: 10,
                fontSize:     13,
                fontWeight:   700,
                cursor:       completing ? 'not-allowed' : 'pointer',
                opacity:      completing ? 0.7 : 1,
                fontFamily:   'inherit',
              }}
            >
              {completing ? 'Chargement…' : isLast ? 'Accéder au dashboard →' : 'Suivant →'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
