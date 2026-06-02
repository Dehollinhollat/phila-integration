// src/pages/MonTableauDeBord.tsx
// Tableau de bord personnalisé pour les référents d'intégration et d'église.
// Affiche les contacts assignés avec un badge d'urgence calculé côté serveur :
//   en_retard   -contact actif sans interaction depuis >14 jours
//   a_contacter -statut nouveau depuis >3 jours
//   a_jour      -tout va bien

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { contactsEndpoints } from '../services/endpoints';
import { useAuth } from '../context/AuthContext';
import { STATUT_LABELS, CAMPUS_LABELS } from '../utils/constants';
import type { ContactAvecBadge, ContactBadge } from '../types';

// ─── Config badges ────────────────────────────────────────────────────────────

const BADGE_CFG: Record<ContactBadge, { label: string; bg: string; color: string }> = {
  en_retard:   { label: 'En retard',    bg: 'rgba(239,68,68,0.12)',   color: '#EF4444' },
  a_contacter: { label: 'À contacter',  bg: 'rgba(212,162,78,0.15)',  color: '#D4A24E' },
  a_jour:      { label: 'À jour',       bg: 'rgba(16,185,129,0.12)', color: '#10B981' },
};

const STATUT_COLOR: Record<string, string> = {
  nouveau:   '#6366F1',
  contacte:  '#3B82F6',
  en_suivi:  '#D4A24E',
  integre:   '#10B981',
  ouvrier:   '#8B5CF6',
  inactif:   '#9CA3AF',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MonTableauDeBord() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contacts,  setContacts]  = useState<ContactAvecBadge[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<ContactBadge | 'tous'>('tous');

  useEffect(() => {
    contactsEndpoints.mesContacts()
      .then(r => setContacts(r.data))
      .catch(err => console.error('[MonTableauDeBord]', err))
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  const displayed = filter === 'tous' ? contacts : contacts.filter(c => c.badge === filter);
  const countByBadge = (b: ContactBadge) => contacts.filter(c => c.badge === b).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>

      {/* ── En-tête ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          {greeting}, {user.prenom} 👋
        </h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
          Voici vos contacts assignés et leur état de suivi.
        </p>
      </div>

      {/* ── Tuiles récapitulatifs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <SummaryCard
          label="Total assignés"
          value={contacts.length}
          color="var(--accent, #1A56B0)"
          onClick={() => setFilter('tous')}
          active={filter === 'tous'}
        />
        <SummaryCard
          label="En retard"
          value={countByBadge('en_retard')}
          color="#EF4444"
          onClick={() => setFilter(filter === 'en_retard' ? 'tous' : 'en_retard')}
          active={filter === 'en_retard'}
        />
        <SummaryCard
          label="À contacter"
          value={countByBadge('a_contacter')}
          color="#D4A24E"
          onClick={() => setFilter(filter === 'a_contacter' ? 'tous' : 'a_contacter')}
          active={filter === 'a_contacter'}
        />
        <SummaryCard
          label="À jour"
          value={countByBadge('a_jour')}
          color="#10B981"
          onClick={() => setFilter(filter === 'a_jour' ? 'tous' : 'a_jour')}
          active={filter === 'a_jour'}
        />
      </div>

      {/* ── Liste des contacts ── */}
      <div style={{
        background:   'var(--bg-card)',
        border:       '1px solid var(--border-color)',
        borderRadius: 16,
        overflow:     'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {filter === 'tous' ? 'Tous mes contacts' : `Contacts : ${BADGE_CFG[filter].label}`}
          </h2>
          {filter !== 'tous' && (
            <button
              onClick={() => setFilter('tous')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}
            >
              Réinitialiser ✕
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
            Chargement…
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
            {filter === 'tous' ? 'Aucun contact assigné.' : 'Aucun contact dans cette catégorie.'}
          </div>
        ) : (
          <div>
            {displayed.map((c, i) => {
              const badge = BADGE_CFG[c.badge];
              const sinceDate = c.derniere_interaction ?? c.date_inscription;
              const daysSince = Math.floor((Date.now() - new Date(sinceDate).getTime()) / 86_400_000);

              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/contacts/${c.id}`)}
                  style={{
                    display:       'flex',
                    alignItems:    'center',
                    gap:           16,
                    padding:       '14px 20px',
                    borderBottom:  i < displayed.length - 1 ? '1px solid var(--border-color)' : 'none',
                    cursor:        'pointer',
                    background:    'transparent',
                    transition:    '120ms ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover, rgba(0,0,0,0.02))')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Avatar initiales */}
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: STATUT_COLOR[c.statut] ?? '#6B7280',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}>
                    {c.prenom[0]}{c.nom[0]}
                  </div>

                  {/* Nom + infos */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.prenom} {c.nom}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {CAMPUS_LABELS[c.campus] ?? c.campus} · {c.telephone ?? '—'}
                    </div>
                  </div>

                  {/* Statut */}
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: `${STATUT_COLOR[c.statut]}20`,
                    color: STATUT_COLOR[c.statut] ?? 'var(--text-secondary)',
                    flexShrink: 0,
                  }}>
                    {STATUT_LABELS[c.statut as keyof typeof STATUT_LABELS] ?? c.statut}
                  </span>

                  {/* Jours sans interaction */}
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0, minWidth: 48, textAlign: 'right' }}>
                    {daysSince}j
                  </span>

                  {/* Badge urgence */}
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: badge.bg, color: badge.color, flexShrink: 0,
                  }}>
                    {badge.label}
                  </span>

                  <span style={{ color: 'var(--text-tertiary)', fontSize: 16, flexShrink: 0 }}>›</span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function SummaryCard({
  label, value, color, onClick, active,
}: {
  label: string; value: number; color: string;
  onClick: () => void; active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background:   active ? `${color}18` : 'var(--bg-card)',
        border:       `1px solid ${active ? color : 'var(--border-color)'}`,
        borderRadius: 12,
        padding:      '16px 12px',
        textAlign:    'center',
        cursor:       'pointer',
        transition:   '120ms ease',
        fontFamily:   'inherit',
      }}
    >
      <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color }}>
        {value}
      </p>
    </button>
  );
}
