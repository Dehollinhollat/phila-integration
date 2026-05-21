// src/features/planning/MesPlannings.tsx
// Vue personnelle des affectations de service pour l'ouvrier connecté.
// Accessible aux rôles referent_integration et supérieurs.
// Permet d'accepter ou de décliner chaque affectation en attente.

import { useState, useEffect } from 'react';
import { affectationsEndpoints } from '../../services/endpoints';
import type { AffectationPlanning, StatutAffectation } from '../../types';

// ─── Constantes ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  identification:    'Identification',
  service_salle:     'Service en salle',
  preparation_salle: 'Préparation de salle',
  priere_lundi:      'Prière du lundi',
};

const STATUT_BADGE: Record<StatutAffectation, { bg: string; color: string; label: string }> = {
  en_attente: { bg: '#fef3c7', color: '#b45309', label: 'En attente' },
  accepte:    { bg: '#dcfce7', color: '#15803d', label: 'Accepté' },
  decline:    { bg: '#fee2e2', color: '#dc2626', label: 'Décliné' },
};

// ─── Composant ───────────────────────────────────────────────────────────────

export default function MesPlannings() {
  const [affectations, setAffectations] = useState<AffectationPlanning[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [responding,   setResponding]   = useState<string | null>(null);

  useEffect(() => {
    affectationsEndpoints.mes()
      .then(r => setAffectations(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleRespond(id: string, statut: 'accepte' | 'decline') {
    setResponding(id);
    try {
      const res = await affectationsEndpoints.respond(id, statut);
      setAffectations(prev =>
        prev.map(a => a.id === id ? { ...a, statut: res.data.statut, repondu_le: res.data.repondu_le } : a)
      );
    } catch (err) {
      console.error(err);
    } finally {
      setResponding(null);
    }
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid var(--border)', borderTopColor: 'var(--accent-teal)',
          animation: 'mp-spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes mp-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const now      = new Date();
  const upcoming = affectations.filter(a => a.planning && new Date(a.planning.date_dimanche) >= now);
  const past     = affectations.filter(a => !a.planning || new Date(a.planning.date_dimanche) < now);

  function renderCard(aff: AffectationPlanning) {
    const badge     = STATUT_BADGE[aff.statut] ?? STATUT_BADGE.en_attente;
    const dateLabel = aff.planning
      ? new Date(aff.planning.date_dimanche).toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
      : '-';
    const campusLabel = aff.planning?.campus === 'paris_nord' ? 'Paris Nord' : 'Paris';

    return (
      <div key={aff.id} style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '14px 18px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize', marginBottom: 3 }}>
            {dateLabel}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {campusLabel} · {ROLE_LABELS[aff.role_service] ?? aff.role_service}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: badge.bg, color: badge.color,
          }}>
            {badge.label}
          </span>
          {aff.statut === 'en_attente' && (
            <>
              <button
                onClick={() => handleRespond(aff.id, 'accepte')}
                disabled={responding === aff.id}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none',
                  background: '#16a34a', color: '#fff',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  opacity: responding === aff.id ? 0.6 : 1,
                }}
              >
                ✓ Accepter
              </button>
              <button
                onClick={() => handleRespond(aff.id, 'decline')}
                disabled={responding === aff.id}
                style={{
                  padding: '6px 14px', borderRadius: 6,
                  border: '1px solid #fca5a5', background: 'transparent',
                  color: '#dc2626',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  opacity: responding === aff.id ? 0.6 : 1,
                }}
              >
                × Décliner
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px) clamp(12px, 3vw, 32px)', maxWidth: 760, margin: '0 auto' }}>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Mon planning
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>
          Vos affectations aux équipes de service dominical
        </p>
      </div>

      {affectations.length === 0 ? (
        <div style={{
          padding: 48, textAlign: 'center',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, color: 'var(--text-secondary)', fontSize: 14,
        }}>
          Vous n'avez pas encore d'affectation.
          <br />
          <span style={{ fontSize: 12, marginTop: 6, display: 'block' }}>
            Les admins vous assigneront à des équipes depuis le planning.
          </span>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{
                fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px',
              }}>
                À venir
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {upcoming.map(renderCard)}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 style={{
                fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px',
              }}>
                Passés
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {past.map(renderCard)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
