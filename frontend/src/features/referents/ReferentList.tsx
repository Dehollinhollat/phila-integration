// src/features/referents/ReferentList.tsx
// Vue de charge des référents - deux sections (Intégration / Église).
// Pour chaque référent : avatar, contacts assignés, barre de progression, actions.
// Alertes si un référent dépasse le seuil ou si des contacts n'ont pas de référent.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { referentsEndpoints } from '../../services/endpoints';
import type { ChargeReferent } from '../../services/endpoints';
import type { StatutContact } from '../../types';

// ─── Config ───────────────────────────────────────────────────────────────────

const SEUIL = 15; // Seuil recommandé de contacts par référent

const STATUT_COLORS: Record<StatutContact, string> = {
  nouveau:   '#60a5fa',
  contacte:  '#fb923c',
  en_suivi:  '#a78bfa',
  integre:   '#34d399',
  ouvrier:   '#2dd4bf',
  inactif:   '#9ca3af',
};

function barColor(count: number): string {
  const ratio = count / SEUIL;
  if (ratio >= 1)   return '#DC2626';
  if (ratio >= 0.8) return '#D97706';
  return 'var(--accent-teal)';
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ReferentList() {
  const navigate = useNavigate();

  const [data,    setData]    = useState<{ integration: ChargeReferent[]; eglise: ChargeReferent[]; sans_referent: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const [reassignTarget, setReassignTarget]  = useState<ChargeReferent | null>(null);
  const [reassignType,   setReassignType]    = useState<'integration' | 'eglise'>('integration');
  const [selectedIds,    setSelectedIds]     = useState<string[]>([]);
  const [newReferentId,  setNewReferentId]   = useState('');
  const [saving,         setSaving]          = useState(false);
  const [toast,          setToast]           = useState<string | null>(null);

  useEffect(() => {
    referentsEndpoints.charge()
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (reassignTarget) document.dispatchEvent(new CustomEvent('modal-opened'));
  }, [reassignTarget]);

  // ── Stats ────────────────────────────────────────────────────────────────────

  const allRefs = data ? [...data.integration, ...data.eglise] : [];
  const stats = {
    total:    allRefs.length,
    surcharge: allRefs.filter(r => r.count >= SEUIL).length,
    moyenne:  allRefs.length ? Math.round(allRefs.reduce((s, r) => s + r.count, 0) / allRefs.length * 10) / 10 : 0,
  };

  // ── Réassignment ─────────────────────────────────────────────────────────────

  function openReassign(ref: ChargeReferent, type: 'integration' | 'eglise') {
    setReassignTarget(ref);
    setReassignType(type);
    setSelectedIds([]);
    setNewReferentId('');
  }

  function toggleContact(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleReassign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reassignTarget || !newReferentId || selectedIds.length === 0) return;
    setSaving(true);
    try {
      const res = await referentsEndpoints.reassigner({
        contact_ids:       selectedIds,
        nouveau_referent_id: newReferentId,
        type:              reassignType,
      });
      showToast(`${res.data.reassigned} contact(s) réassigné(s)`);
      // Recharge les données
      const fresh = await referentsEndpoints.charge();
      setData(fresh.data);
      setReassignTarget(null);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg ?? 'Erreur lors de la réassignation');
    } finally { setSaving(false); }
  }

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(null), 4000);
  }

  // ─── Rendu ───────────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Chargement…</div>;
  }

  if (!data) return null;

  const surcharges = allRefs.filter(r => r.count >= SEUIL);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>

      {/* Titre */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Référents</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          Charge de suivi par référent intégration et référent église.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Référents actifs',      value: stats.total },
          { label: 'Moy. contacts/référent', value: stats.moyenne },
          { label: 'Au maximum (≥ 15)',       value: stats.surcharge },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)', borderRadius: 10, padding: '12px 20px', minWidth: 120 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Alertes */}
      {surcharges.length > 0 && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fee2e2', borderRadius: 10, border: '1px solid #fca5a5' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#b91c1c', marginBottom: 4 }}>
            ⚠️ {surcharges.length} référent(s) ont dépassé le seuil de {SEUIL} contacts
          </div>
          <div style={{ fontSize: 12, color: '#b91c1c' }}>
            {surcharges.map(r => `${r.prenom} ${r.nom} (${r.count})`).join(' · ')}
          </div>
        </div>
      )}

      {data.sans_referent > 0 && (
        <div
          onClick={() => navigate('/contacts?statut=nouveau')}
          style={{ marginBottom: 24, padding: '12px 16px', background: '#fef3c7', borderRadius: 10, border: '1px solid #fcd34d', cursor: 'pointer' }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, color: '#b45309' }}>
            📋 {data.sans_referent} contact(s) sans référent intégration → Voir les contacts
          </div>
        </div>
      )}

      {/* Section Intégration */}
      <Section
        title="Référents Intégration"
        referents={data.integration}
        type="integration"
        onReassign={openReassign}
        navigate={navigate}
      />

      {/* Section Église */}
      <Section
        title="Référents Église"
        referents={data.eglise}
        type="eglise"
        onReassign={openReassign}
        navigate={navigate}
      />

      {/* ── Modal Réassignation ── */}
      {reassignTarget && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setReassignTarget(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ background: 'var(--bg-card)', borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', position: 'relative', zIndex: 1001 }}>
            <form onSubmit={e => void handleReassign(e)}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--bg-card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                  Réassigner des contacts
                </span>
                <button type="button" onClick={() => setReassignTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-secondary)' }}>×</button>
              </div>

              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  De : <strong style={{ color: 'var(--text-primary)' }}>{reassignTarget.prenom} {reassignTarget.nom}</strong>
                  {' '}- {reassignTarget.count} contact(s) au total {reassignTarget.count > 5 && '(5 affichés)'}
                </div>

                {/* Sélection contacts */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Contacts à déplacer
                  </div>
                  {reassignTarget.contacts.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Aucun contact assigné</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {reassignTarget.contacts.map(c => (
                        <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, background: selectedIds.includes(c.id) ? 'var(--bg-secondary)' : 'transparent' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(c.id)}
                            onChange={() => toggleContact(c.id)}
                          />
                          <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{c.prenom} {c.nom}</span>
                          <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: STATUT_COLORS[c.statut] + '20', color: STATUT_COLORS[c.statut] }}>
                            {c.statut}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Nouveau référent */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Nouveau référent *
                  </div>
                  <select
                    required
                    value={newReferentId}
                    onChange={e => setNewReferentId(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid var(--bg-card-border)', borderRadius: 8, background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, width: '100%', fontFamily: 'inherit' }}
                  >
                    <option value="">Choisir un référent…</option>
                    {(reassignType === 'integration' ? data.integration : data.eglise)
                      .filter(r => r.id !== reassignTarget.id)
                      .map(r => (
                        <option key={r.id} value={r.id}>
                          {r.prenom} {r.nom} ({r.count} contacts)
                        </option>
                      ))
                    }
                  </select>
                </div>
              </div>

              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--bg-card-border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setReassignTarget(null)} style={btnSecondary} disabled={saving}>Annuler</button>
                <button type="submit" style={btnPrimary} disabled={saving || selectedIds.length === 0 || !newReferentId}>
                  {saving ? 'Réassignation…' : `Réassigner ${selectedIds.length > 0 ? `(${selectedIds.length})` : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)', borderRadius: 10, padding: '12px 20px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 600 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Section (Intégration ou Église) ─────────────────────────────────────────

function Section({
  title, referents, type, onReassign, navigate,
}: {
  title: string;
  referents: ChargeReferent[];
  type: 'integration' | 'eglise';
  onReassign: (r: ChargeReferent, t: 'integration' | 'eglise') => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (referents.length === 0) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        {type === 'integration' ? '🔗' : '⛪'} {title}
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>({referents.length})</span>
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {referents.map(ref => {
          const ratio   = Math.min(ref.count / SEUIL, 1);
          const color   = barColor(ref.count);
          const isOver  = ref.count >= SEUIL;

          return (
            <div key={ref.id} style={{
              background:   'var(--bg-card)',
              border:       `1px solid ${isOver ? '#fca5a5' : 'var(--bg-card-border)'}`,
              borderRadius: 12,
              padding:      '16px',
            }}>
              {/* En-tête carte */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                {/* Avatar */}
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent-teal)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                  {ref.prenom[0]}{ref.nom[0]}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ref.prenom} {ref.nom}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ref.email}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                    {ref.campus.map(c => c === 'paris' ? 'Paris' : 'Paris Nord').join(', ') || '-'}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color }}>
                    {ref.count}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>/{SEUIL}</span>
                </div>
              </div>

              {/* Barre de progression */}
              <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-secondary)', marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99, background: color, width: `${ratio * 100}%`, transition: '300ms ease' }} />
              </div>

              {/* 5 premiers contacts */}
              {ref.contacts.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {ref.contacts.map(c => (
                    <div
                      key={c.id}
                      onClick={() => navigate(`/contacts/${c.id}`)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', cursor: 'pointer', borderBottom: '1px solid var(--bg-card-border)' }}
                    >
                      <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {c.prenom} {c.nom}
                      </span>
                      <span style={{ fontSize: 10, marginLeft: 8, padding: '1px 5px', borderRadius: 4, background: STATUT_COLORS[c.statut] + '20', color: STATUT_COLORS[c.statut], flexShrink: 0 }}>
                        {c.statut}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {ref.count === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>Aucun contact assigné</div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => navigate(`/contacts?referent_id=${ref.id}`)}
                  style={{ ...btnAction, flex: 1 }}
                >
                  Voir ses contacts
                </button>
                {ref.count > 0 && (
                  <button
                    onClick={() => onReassign(ref, type)}
                    style={{ ...btnAction, color: 'var(--accent-teal)', borderColor: 'var(--accent-teal)' }}
                  >
                    Réassigner
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', background: 'var(--accent-teal)', color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};

const btnSecondary: React.CSSProperties = {
  padding: '8px 18px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
  border: '1px solid var(--bg-card-border)', borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};

const btnAction: React.CSSProperties = {
  padding: '6px 12px', background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--bg-card-border)', borderRadius: 7,
  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
