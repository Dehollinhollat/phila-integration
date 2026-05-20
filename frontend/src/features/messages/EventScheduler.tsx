// src/features/messages/EventScheduler.tsx
// Liste des événements avec filtres, stats, actions (voir / supprimer / envoyer maintenant).
// Le bouton "Nouvel événement" navigue vers /evenements/nouveau → MessageCompose.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { evenementsEndpoints } from '../../services/endpoints';
import type { Evenement, Campus, StatutEvenement, DestinataireEvenement } from '../../types';

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUT_CFG: Record<StatutEvenement, { label: string; bg: string; text: string }> = {
  brouillon: { label: 'Brouillon', bg: 'var(--bg-secondary)',   text: 'var(--text-secondary)' },
  planifie:  { label: 'Planifié',  bg: '#fef3c7',               text: '#b45309' },
  envoye:    { label: 'Envoyé',    bg: '#dcfce7',               text: '#15803d' },
};

const DESTINATAIRE_LABELS: Record<DestinataireEvenement, string> = {
  tous:                  'Tous',
  profil_membre_phila:   'Membres Phila',
  profil_visiteur:       'Visiteurs',
  campus_paris:          'Paris',
  campus_paris_nord:     'Paris Nord',
};

const CAMPUS_LABELS: Record<string, string> = {
  paris:      'Paris',
  paris_nord: 'Paris Nord',
};

function fmtDate(s?: string | null): string {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isThisMonth(s?: string | null): boolean {
  if (!s) return false;
  const d = new Date(s), now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isInPeriod(ev: Evenement, periode: string): boolean {
  const ref = ev.envoye_le ?? ev.planifie_le ?? ev.created_at;
  if (!ref) return true;
  const d = new Date(ref), now = new Date();
  if (periode === 'ce_mois') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (periode === 'ce_trimestre') {
    const q = Math.floor(now.getMonth() / 3);
    return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear();
  }
  if (periode === '3_mois') {
    const limit = new Date(now); limit.setMonth(limit.getMonth() - 3);
    return d >= limit;
  }
  return true;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function EventScheduler() {
  const navigate = useNavigate();

  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [loading,    setLoading]    = useState(true);

  const [filterStatut, setFilterStatut]   = useState<StatutEvenement | ''>('');
  const [filterCampus, setFilterCampus]   = useState<Campus | ''>('');
  const [filterPeriode, setFilterPeriode] = useState('');

  const [detail,    setDetail]    = useState<Evenement | null>(null);
  const [toDelete,  setToDelete]  = useState<Evenement | null>(null);
  const [sending,   setSending]   = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState(false);
  const [toast,     setToast]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    evenementsEndpoints.list()
      .then(r => setEvenements(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (detail || toDelete) document.dispatchEvent(new CustomEvent('modal-opened'));
  }, [detail, toDelete]);

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = {
    envoyes:    evenements.filter(e => e.statut === 'envoye' && isThisMonth(e.envoye_le)).length,
    planifies:  evenements.filter(e => e.statut === 'planifie').length,
    brouillons: evenements.filter(e => e.statut === 'brouillon').length,
  };

  // ── Filtrage ─────────────────────────────────────────────────────────────────

  const visible = evenements.filter(ev => {
    if (filterStatut && ev.statut !== filterStatut) return false;
    if (filterCampus && ev.campus !== filterCampus) return false;
    if (filterPeriode && !isInPeriod(ev, filterPeriode)) return false;
    return true;
  });

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function handleEnvoyer(ev: Evenement) {
    setSending(ev.id);
    try {
      const res = await evenementsEndpoints.envoyer(ev.id);
      setEvenements(prev => prev.map(e => e.id === ev.id ? res.data.evenement : e));
      showToast(`Envoi terminé - ${res.data.sent}/${res.data.total} message(s) envoyé(s)`);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg ?? 'Erreur lors de l\'envoi');
    } finally { setSending(null); }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await evenementsEndpoints.delete(toDelete.id);
      setEvenements(prev => prev.filter(e => e.id !== toDelete.id));
      showToast('Événement supprimé');
      setToDelete(null);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg ?? 'Erreur lors de la suppression');
    } finally { setDeleting(false); }
  }

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(null), 4000);
  }

  // ─── Rendu ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1120 }}>

      {/* Titre + bouton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Événements</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Envois groupés WhatsApp planifiés ou immédiats.
          </p>
        </div>
        <button onClick={() => navigate('/evenements/nouveau')} style={btnPrimary}>
          + Nouvel événement
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Envoyés ce mois', value: stats.envoyes,    color: '#15803d' },
          { label: 'Planifiés',       value: stats.planifies,  color: '#b45309' },
          { label: 'Brouillons',      value: stats.brouillons, color: 'var(--text-secondary)' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
            borderRadius: 10, padding: '12px 20px', minWidth: 120,
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value as StatutEvenement | '')} style={selectStyle}>
          <option value="">Tous les statuts</option>
          <option value="brouillon">Brouillon</option>
          <option value="planifie">Planifié</option>
          <option value="envoye">Envoyé</option>
        </select>
        <select value={filterCampus} onChange={e => setFilterCampus(e.target.value as Campus | '')} style={selectStyle}>
          <option value="">Tous les campus</option>
          <option value="paris">Paris</option>
          <option value="paris_nord">Paris Nord</option>
        </select>
        <select value={filterPeriode} onChange={e => setFilterPeriode(e.target.value)} style={selectStyle}>
          <option value="">Toutes les périodes</option>
          <option value="ce_mois">Ce mois</option>
          <option value="ce_trimestre">Ce trimestre</option>
          <option value="3_mois">3 derniers mois</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Chargement…</div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)', borderRadius: 12, overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ ...rowStyle, background: 'var(--bg-secondary)', fontWeight: 700, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <span style={{ flex: 3 }}>Titre</span>
            <span style={{ flex: 1 }}>Campus</span>
            <span style={{ flex: 1 }}>Destinataires</span>
            <span style={{ flex: 1 }}>Date événement</span>
            <span style={{ flex: 1, textAlign: 'center' }}>Statut</span>
            <span style={{ flex: 1 }}>Date envoi</span>
            <span style={{ flex: '0 0 60px', textAlign: 'center' }}>Messages</span>
            <span style={{ flex: 2, textAlign: 'right' }}>Actions</span>
          </div>

          {visible.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              Aucun événement trouvé
            </div>
          ) : (
            visible.map((ev, i) => {
              const sc = STATUT_CFG[ev.statut];
              return (
                <div key={ev.id} style={{
                  ...rowStyle,
                  borderTop: i === 0 ? 'none' : '1px solid var(--bg-card-border)',
                  alignItems: 'center',
                }}>
                  {/* Titre + créateur */}
                  <div style={{ flex: 3, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.titre}
                    </div>
                    {ev.createur && (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                        {ev.createur.prenom} {ev.createur.nom}
                      </div>
                    )}
                  </div>

                  {/* Campus */}
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {ev.campus ? CAMPUS_LABELS[ev.campus] ?? ev.campus : 'Tous'}
                  </span>

                  {/* Destinataires */}
                  <span style={{ flex: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                      {DESTINATAIRE_LABELS[ev.destinataires] ?? ev.destinataires}
                    </span>
                  </span>

                  {/* Date événement */}
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {fmtDate(ev.date_evenement)}
                  </span>

                  {/* Statut */}
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: sc.bg, color: sc.text }}>
                      {sc.label}
                    </span>
                  </div>

                  {/* Date envoi planifié ou réel */}
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {ev.statut === 'envoye' ? fmtDate(ev.envoye_le) : fmtDate(ev.planifie_le)}
                  </span>

                  {/* Nombre messages */}
                  <span style={{ flex: '0 0 60px', textAlign: 'center', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                    {ev._count?.messages ?? 0}
                  </span>

                  {/* Actions */}
                  <div style={{ flex: 2, display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button onClick={() => setDetail(ev)} style={btnSmall}>Voir</button>

                    {ev.statut !== 'envoye' && (
                      <button onClick={() => navigate(`/evenements/nouveau`)} style={btnSmall}>Modifier</button>
                    )}

                    {ev.statut === 'brouillon' && (
                      <button onClick={() => setToDelete(ev)} style={{ ...btnSmall, color: '#DC2626', borderColor: '#fca5a5' }}>
                        Supprimer
                      </button>
                    )}

                    {ev.statut === 'planifie' && (
                      <button
                        onClick={() => void handleEnvoyer(ev)}
                        disabled={sending === ev.id}
                        style={{ ...btnSmall, color: '#15803d', borderColor: '#86efac', fontWeight: 700 }}
                      >
                        {sending === ev.id ? '…' : 'Envoyer →'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Modal Détail ── */}
      {detail && (
        <ModalOverlay onClose={() => setDetail(null)}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--bg-card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{detail.titre}</span>
            <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-secondary)', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <DetailRow label="Statut">
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: STATUT_CFG[detail.statut].bg, color: STATUT_CFG[detail.statut].text }}>
                {STATUT_CFG[detail.statut].label}
              </span>
            </DetailRow>
            <DetailRow label="Destinataires">{DESTINATAIRE_LABELS[detail.destinataires]}</DetailRow>
            <DetailRow label="Campus">{detail.campus ? CAMPUS_LABELS[detail.campus] ?? detail.campus : 'Tous'}</DetailRow>
            <DetailRow label="Date événement">{fmtDate(detail.date_evenement)}</DetailRow>
            {detail.planifie_le && <DetailRow label="Envoi planifié">{fmtDate(detail.planifie_le)}</DetailRow>}
            {detail.envoye_le   && <DetailRow label="Envoyé le">{fmtDate(detail.envoye_le)}</DetailRow>}
            <DetailRow label="Messages envoyés">{detail._count?.messages ?? 0}</DetailRow>
            {detail.createur && <DetailRow label="Créé par">{detail.createur.prenom} {detail.createur.nom}</DetailRow>}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Template message</div>
              <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                {detail.message_template}
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Confirmation suppression ── */}
      {toDelete && (
        <ModalOverlay onClose={() => setToDelete(null)}>
          <div style={{ padding: '24px' }}>
            <p style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Supprimer l'événement ?</p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)' }}>
              "{toDelete.titre}" sera définitivement supprimé. Cette action est irréversible.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setToDelete(null)} style={btnSecondary} disabled={deleting}>Annuler</button>
              <button
                onClick={() => void handleDelete()}
                disabled={deleting}
                style={{ ...btnPrimary, background: '#DC2626' }}
              >
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
          borderRadius: 10, padding: '12px 20px',
          fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 600,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', position: 'relative', zIndex: 1001 }}>
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 130 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{children}</span>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const rowStyle: React.CSSProperties = {
  display: 'flex', gap: 10, padding: '11px 16px', alignItems: 'stretch',
};

const selectStyle: React.CSSProperties = {
  padding: '7px 11px', borderRadius: 8,
  border: '1px solid var(--bg-card-border)',
  background: 'var(--bg-primary)', color: 'var(--text-primary)',
  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', background: 'var(--accent-teal)', color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
};

const btnSecondary: React.CSSProperties = {
  padding: '8px 18px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
  border: '1px solid var(--bg-card-border)', borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};

const btnSmall: React.CSSProperties = {
  padding: '4px 10px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
  border: '1px solid var(--bg-card-border)', borderRadius: 6,
  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
};
