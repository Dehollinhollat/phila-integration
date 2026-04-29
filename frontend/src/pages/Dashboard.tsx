// src/pages/Dashboard.tsx
// Tableau de bord principal — KPIs, alertes J+2 sans référent, et accès rapides.
//
// KPIs affichés :
//   - Total contacts inscrits
//   - Nouveaux contacts (statut = nouveau)
//   - Contacts en suivi actif
//   - Contacts intégrés
//   - Alertes : contacts sans référent depuis ≥ 2 jours

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { contactsEndpoints } from '../services/endpoints';
import {
  colors, typography, spacing, radius, shadows, layout,
} from '../components/ui/tokens';
import {
  STATUT_LABELS, STATUT_COLORS, CAMPUS_LABELS,
} from '../utils/constants';
import type { ContactRow, DashboardAlerts, ContactStats } from '../types';
import axios from 'axios';

// ─── Composant KPI card ───────────────────────────────────────────────────────

function KpiCard({
  label, value, color, icon, onClick,
}: {
  label: string;
  value: number | string;
  color: string;
  icon:  string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background:   colors.white,
        border:       layout.cardBorder,
        borderRadius: radius.lg,
        padding:      spacing[6],
        boxShadow:    shadows.sm,
        cursor:       onClick ? 'pointer' : 'default',
        display:      'flex',
        alignItems:   'center',
        gap:          spacing[4],
        transition:   '0.15s ease',
      }}
    >
      <div
        style={{
          width:          '48px',
          height:         '48px',
          borderRadius:   radius.md,
          background:     `${color}18`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       '22px',
          flexShrink:     0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.bold, color, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: typography.fontSize.sm, color: colors.gray500, marginTop: spacing[1] }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats,   setStats]   = useState<ContactStats | null>(null);
  const [alerts,  setAlerts]  = useState<DashboardAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contactsRes, alertsRes] = await Promise.all([
        contactsEndpoints.list({ limit: 1000 }),
        contactsEndpoints.alerts(),
      ]);

      const contacts: ContactRow[] = contactsRes.data.contacts ?? [];

      // Calcul des stats par statut côté client
      const s: ContactStats = {
        total:    contactsRes.data.total,
        nouveau:  contacts.filter(c => c.statut === 'nouveau').length,
        contacte: contacts.filter(c => c.statut === 'contacte').length,
        en_suivi: contacts.filter(c => c.statut === 'en_suivi').length,
        integre:  contacts.filter(c => c.statut === 'integre').length,
        ouvrier:  contacts.filter(c => c.statut === 'ouvrier').length,
        inactif:  contacts.filter(c => c.statut === 'inactif').length,
      };
      setStats(s);
      setAlerts(alertsRes.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message ?? 'Erreur de chargement');
      } else {
        setError('Erreur de connexion au serveur');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  })();

  return (
    <div style={{ maxWidth: layout.contentMaxWidth }}>
      {/* En-tête */}
      <div style={{ marginBottom: spacing[8] }}>
        <h1 style={{
          margin: 0,
          fontSize: typography.fontSize['2xl'],
          fontWeight: typography.fontWeight.bold,
          color: colors.gray900,
        }}>
          {greeting}, {user?.prenom} 👋
        </h1>
        <p style={{ margin: `${spacing[1]} 0 0`, color: colors.gray500, fontSize: typography.fontSize.base }}>
          Vue d'ensemble de l'intégration
          {user?.campus.map(c => ` · ${CAMPUS_LABELS[c]}`).join('')}
        </p>
      </div>

      {/* Erreur */}
      {error && (
        <div style={{
          background: colors.dangerLight, color: colors.danger,
          borderRadius: radius.md, padding: `${spacing[3]} ${spacing[4]}`,
          marginBottom: spacing[6], fontSize: typography.fontSize.sm,
        }}>
          {error}
        </div>
      )}

      {/* KPIs */}
      {loading ? (
        <div style={{ color: colors.gray400, textAlign: 'center', padding: spacing[12] }}>
          Chargement…
        </div>
      ) : stats && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: spacing[4],
            marginBottom: spacing[8],
          }}>
            <KpiCard
              label="Total contacts"
              value={stats.total}
              color={colors.primary}
              icon="👥"
              onClick={() => navigate('/contacts')}
            />
            <KpiCard
              label="Nouveaux"
              value={stats.nouveau}
              color={colors.info}
              icon="🆕"
              onClick={() => navigate('/contacts?statut=nouveau')}
            />
            <KpiCard
              label="En suivi"
              value={stats.en_suivi}
              color={colors.secondary}
              icon="🔄"
              onClick={() => navigate('/contacts?statut=en_suivi')}
            />
            <KpiCard
              label="Intégrés"
              value={stats.integre}
              color={colors.success}
              icon="✅"
              onClick={() => navigate('/contacts?statut=integre')}
            />
            <KpiCard
              label={`Alerte${(alerts?.contacts.length ?? 0) > 1 ? 's' : ''} J+2`}
              value={alerts?.contacts.length ?? 0}
              color={colors.danger}
              icon="⚠️"
            />
          </div>

          {/* Répartition par statut */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: spacing[6],
            marginBottom: spacing[6],
          }}>
            <div style={S.card}>
              <h2 style={S.cardTitle}>Répartition par statut</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
                {(Object.keys(STATUT_LABELS) as (keyof typeof STATUT_LABELS)[]).map((statut) => {
                  const count  = stats[statut as keyof ContactStats] as number;
                  const pct    = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                  const badge  = STATUT_COLORS[statut];
                  return (
                    <div key={statut} style={{ display: 'flex', alignItems: 'center', gap: spacing[3] }}>
                      <span style={{
                        fontSize: typography.fontSize.xs,
                        padding: `2px ${spacing[2]}`,
                        borderRadius: radius.full,
                        background: badge.bg,
                        color: badge.text,
                        minWidth: '80px',
                        textAlign: 'center',
                      }}>
                        {STATUT_LABELS[statut]}
                      </span>
                      <div style={{
                        flex: 1, height: '6px', background: colors.gray100,
                        borderRadius: radius.full, overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${pct}%`, height: '100%',
                          background: badge.text, borderRadius: radius.full,
                          transition: '0.4s ease',
                        }} />
                      </div>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.gray500, minWidth: '28px' }}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Alertes J+2 */}
            <div style={{ ...S.card, borderLeft: `3px solid ${colors.danger}` }}>
              <h2 style={{ ...S.cardTitle, color: colors.danger }}>
                ⚠️ Sans référent depuis ≥ 2 jours
              </h2>
              {!alerts?.contacts.length ? (
                <p style={{ color: colors.success, fontSize: typography.fontSize.sm }}>
                  ✅ Aucune alerte — tous les contacts ont un référent
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2], maxHeight: '240px', overflowY: 'auto' }}>
                  {alerts.contacts.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => navigate(`/contacts/${c.id}`)}
                      style={{
                        display:      'flex',
                        alignItems:   'center',
                        justifyContent: 'space-between',
                        padding:      `${spacing[2]} ${spacing[3]}`,
                        background:   colors.dangerLight,
                        borderRadius: radius.md,
                        cursor:       'pointer',
                        fontSize:     typography.fontSize.sm,
                      }}
                    >
                      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.gray800 }}>
                        {c.prenom} {c.nom}
                      </span>
                      <span style={{ color: colors.gray500, fontSize: typography.fontSize.xs }}>
                        {CAMPUS_LABELS[c.campus]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Styles partagés ──────────────────────────────────────────────────────────

const S = {
  card: {
    background:   colors.white,
    border:       layout.cardBorder,
    borderRadius: radius.lg,
    padding:      spacing[6],
    boxShadow:    shadows.sm,
  },
  cardTitle: {
    margin:       `0 0 ${spacing[4]}`,
    fontSize:     typography.fontSize.md,
    fontWeight:   typography.fontWeight.semibold,
    color:        colors.gray800,
  },
} as const;
