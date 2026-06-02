// src/features/contacts/ContactDetail.tsx
// Fiche détail 3 colonnes : identité | checklist + commentaires | référents + historique + messages

import type { ReactNode } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Star, User as UserIcon, Edit2, Trash2, GraduationCap, Lightbulb } from 'lucide-react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { contactsEndpoints, checklistEndpoints, messagesEndpoints, referentsEndpoints, ouvriersEndpoints, auditEndpoints } from '../../services/endpoints';
import type {
  Contact, Commentaire, HistoriqueStatut, Message,
  ChecklistItem, EtapeIntegration, StatutContact, User, AuditLog, AuditAction, SuggestionReferent, Intention,
} from '../../types';
import {
  ROLE_RANK,
  STATUT_LABELS, STATUT_COLORS,
  ROLE_LABELS,
  PROFIL_BADGE, PROFIL_LABELS,
  CANAL_LABELS, CANAL_BADGE,
  CAMPUS_LABELS,
  STATUT_OPTIONS,
  STATUT_PHILA_LABELS,
  ETAT_CIVIL_LABELS,
  DISPO_LABELS,
  BESOIN_LABELS,
  SOUHAIT_LABELS,
  INTERET_CELLULE_LABELS,
  GENRE_LABELS,
  INTENTION_LABELS,
  INTENTION_COLORS,
} from '../../utils/constants';

// ─── Constants ────────────────────────────────────────────────────────────────

const ETAPES_ORDER: EtapeIntegration[] = [
  'message_bienvenue_envoye',
  'premier_appel_effectue',
  'inscription_cellule',
  'journee_integration',
  'cours_antioche_valides',
  'service_departement',
  'integration_confirmee',
];

const ETAPE_LABELS: Record<EtapeIntegration, string> = {
  message_bienvenue_envoye: 'SMS/WhatsApp de bienvenue envoyé',
  premier_appel_effectue:   'Premier appel téléphonique effectué',
  inscription_cellule:      'Inscrit en cellule de prière',
  journee_integration:      "Participation à la journée d'intégration",
  cours_antioche_valides:   'Cours Antioche validés',
  service_departement:      'Affecté à un département de service',
  integration_confirmee:    'Intégration confirmée',
};

const PROMOTE_SERVICES = [
  { value: 'accueil',        label: 'Accueil' },
  { value: 'intercession',   label: 'Intercession' },
  { value: 'integration',    label: 'Intégration' },
  { value: 'medias',         label: 'Médias' },
  { value: 'louange',        label: 'Louange' },
  { value: 'ecodim',         label: 'Ecodim' },
  { value: 'administration', label: 'Administration' },
  { value: 'securite',       label: 'Sécurité' },
  { value: 'restauration',   label: 'Restauration' },
  { value: 'communication',  label: 'Communication' },
  { value: 'evangelisation', label: 'Évangélisation' },
  { value: 'familial',       label: 'Familial' },
  { value: 'sante',          label: 'Santé' },
  { value: 'social',         label: 'Social' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--bg-card-border)',
      borderRadius: 8,
      padding: 20,
    }}>
      {title && (
        <h3 style={{
          margin: '0 0 16px',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function Badge({ bg, text, children }: { bg: string; text: string; children: React.ReactNode }) {
  return (
    <span style={{
      background: bg,
      color: text,
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 600,
    }}>
      {children}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 8,
      fontSize: 13,
      padding: '6px 0',
      borderBottom: '1px solid var(--bg-card-border)',
    }}>
      <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: '3px solid var(--bg-card-border)',
        borderTopColor: 'var(--accent-teal)',
        animation: 'cd-spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes cd-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ReferentField({
  label, current, allUsers, canEdit, saving, onChange,
}: {
  label: string;
  current: { id: string; prenom: string; nom: string } | null | undefined;
  allUsers: User[];
  canEdit: boolean;
  saving: boolean;
  onChange: (id: string | null) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
      {canEdit ? (
        <select
          value={current?.id ?? ''}
          disabled={saving}
          onChange={e => onChange(e.target.value || null)}
          style={{
            width: '100%',
            padding: '6px 8px',
            borderRadius: 6,
            border: '1px solid var(--bg-card-border)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            fontSize: 13,
          }}
        >
          <option value="">Non assigné</option>
          {allUsers.map(u => (
            <option key={u.id} value={u.id}>
              {u.prenom} {u.nom}
            </option>
          ))}
        </select>
      ) : (
        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
          {current ? `${current.prenom} ${current.nom}` : 'Non assigné'}
        </div>
      )}
    </div>
  );
}

// ─── Audit Timeline helpers ───────────────────────────────────────────────────

const AUDIT_ICONS: Record<AuditAction, ReactNode> = {
  creation:            <Star size={13} />,
  changement_statut:   '→',
  assignation_referent:<UserIcon size={13} />,
  checklist_cochee:    '✓',
  modification:        <Edit2 size={13} />,
  suppression:         <Trash2 size={13} />,
};

const AUDIT_COLORS: Record<AuditAction, string> = {
  creation:            '#0EA5E9', // teal
  changement_statut:   '#3B82F6', // bleu
  assignation_referent:'#D97706', // doré
  checklist_cochee:    '#10B981', // vert
  modification:        '#6B7280', // gris
  suppression:         '#EF4444', // rouge
};

function dateRelative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'hier';
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [contact, setContact]       = useState<Contact | null>(null);
  const [checklist, setChecklist]   = useState<ChecklistItem[]>([]);
  const [commentaires, setCommentaires] = useState<Commentaire[]>([]);
  const [historique, setHistorique] = useState<HistoriqueStatut[]>([]);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [auditLogs, setAuditLogs]   = useState<AuditLog[]>([]);
  const [allUsers, setAllUsers]     = useState<User[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [newComment, setNewComment]       = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [statutSaving, setStatutSaving]   = useState(false);
  const [refIntSaving, setRefIntSaving]   = useState(false);
  const [refEglSaving, setRefEglSaving]   = useState(false);
  const [suggestion,   setSuggestion]     = useState<SuggestionReferent | null>(null);
  const [suggLoading,  setSuggLoading]    = useState(false);

  // Promotion ouvrier
  const [isOuvrier,        setIsOuvrier]        = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);

  useEffect(() => {
    if (showPromoteModal) document.dispatchEvent(new CustomEvent('modal-opened'));
  }, [showPromoteModal]);
  const [promoteCampus,    setPromoteCampus]    = useState('');
  const [promoteServices,  setPromoteServices]  = useState<string[]>([]);
  const [promoteDate,      setPromoteDate]      = useState('');
  const [promoteSaving,    setPromoteSaving]    = useState(false);
  const [promoteError,     setPromoteError]     = useState<string | null>(null);

  const canEdit  = user && ROLE_RANK[user.role] >= ROLE_RANK['admin_campus'];
  const canWrite = user && ROLE_RANK[user.role] >= ROLE_RANK['referent_integration'];

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [cRes, clRes, coRes, hRes, mRes, auditRes] = await Promise.all([
        contactsEndpoints.get(id),
        checklistEndpoints.byContact(id),
        contactsEndpoints.listCommentaires(id),
        contactsEndpoints.historique(id),
        messagesEndpoints.byContact(id),
        auditEndpoints.byContact(id).catch(() => ({ data: [] })),
      ]);
      setContact(cRes.data);
      setIsOuvrier(!!cRes.data.ouvrier);
      setPromoteCampus(cRes.data.campus);
      if (clRes.data.length === 0) {
        const initRes = await contactsEndpoints.initChecklist(id);
        setChecklist(initRes.data.items);
      } else {
        setChecklist(clRes.data);
      }
      setCommentaires(coRes.data);
      setHistorique(hRes.data);
      setMessages(mRes.data);
      setAuditLogs(auditRes.data);
    } catch {
      setError('Impossible de charger la fiche contact.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!canEdit) return;
    referentsEndpoints.list().then(r => setAllUsers(r.data)).catch(() => {});
  }, [canEdit]);

  async function handleStatutChange(statut: StatutContact) {
    if (!id) return;
    setStatutSaving(true);
    try {
      const res = await contactsEndpoints.updateStatut(id, statut);
      setContact(prev => prev ? { ...prev, statut: res.data.statut } : prev);
    } catch { /* silent */ } finally { setStatutSaving(false); }
  }

  async function handleChecklistToggle(etape: EtapeIntegration, currentComplete: boolean) {
    if (!id || !canWrite) return;
    const item = checklist.find(i => i.etape === etape);
    if (!item) return;
    const next = !currentComplete;
    setChecklist(prev => prev.map(i => i.etape === etape ? { ...i, complete: next } : i));
    try {
      const res = await contactsEndpoints.patchChecklist(id, etape, next);
      setChecklist(prev => prev.map(i => i.etape === etape ? res.data : i));
      if (etape === 'integration_confirmee' && next) {
        const cRes = await contactsEndpoints.get(id);
        setContact(cRes.data);
      }
    } catch {
      setChecklist(prev => prev.map(i => i.etape === etape ? { ...i, complete: currentComplete } : i));
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !newComment.trim()) return;
    setCommentSaving(true);
    try {
      const res = await contactsEndpoints.createCommentaire(id, newComment.trim());
      setCommentaires(prev => [...prev, res.data]);
      setNewComment('');
    } catch { /* silent */ } finally { setCommentSaving(false); }
  }

  async function handleRefIntChange(refId: string | null) {
    if (!id) return;
    setRefIntSaving(true);
    try {
      const res = await contactsEndpoints.patchReferents(id, refId, undefined);
      setContact(prev => prev ? {
        ...prev,
        referent_integration_id: res.data.referent_integration_id,
        referent_integration: res.data.referent_integration,
      } : prev);
    } catch { /* silent */ } finally { setRefIntSaving(false); }
  }

  async function handleRefEglChange(refId: string | null) {
    if (!id) return;
    setRefEglSaving(true);
    try {
      const res = await contactsEndpoints.patchReferents(id, undefined, refId);
      setContact(prev => prev ? {
        ...prev,
        referent_eglise_id: res.data.referent_eglise_id,
        referent_eglise: res.data.referent_eglise,
      } : prev);
    } catch { /* silent */ } finally { setRefEglSaving(false); }
  }

  async function handlePromote(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !contact) return;
    setPromoteError(null);
    setPromoteSaving(true);
    try {
      await ouvriersEndpoints.create({
        contact_id:          id,
        prenom:              contact.prenom,
        nom:                 contact.nom,
        telephone:           contact.telephone,
        email:               contact.email,
        campus:              promoteCampus,
        services:            promoteServices,
        date_debut_service:  promoteDate || undefined,
        inscription_directe: false,
      });
      setIsOuvrier(true);
      setShowPromoteModal(false);
      const cRes = await contactsEndpoints.get(id);
      setContact(cRes.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPromoteError(msg ?? 'Une erreur est survenue.');
    } finally {
      setPromoteSaving(false);
    }
  }

  if (loading) return <Spinner />;
  if (error || !contact) return (
    <div style={{ padding: 32, color: 'var(--text-secondary)', fontSize: 14 }}>
      {error ?? 'Contact introuvable.'}
    </div>
  );

  const completedCount = checklist.filter(i => i.complete).length;
  const avatarColor    = contact.profil === 'membre_phila' ? 'var(--accent-teal)'
    : contact.profil === 'visiteur_avec_eglise' ? 'var(--accent-violet)'
    : 'var(--accent-gold)';
  const initials       = `${contact.prenom[0]}${contact.nom[0]}`.toUpperCase();

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 24px) clamp(12px, 3vw, 32px)', maxWidth: 1400, margin: '0 auto' }}>

      {/* Back */}
      <button
        onClick={() => navigate('/contacts')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--accent-teal)', fontSize: 14, marginBottom: 20,
          padding: 0, display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        ← Retour aux contacts
      </button>

      {/* 3-column grid — 1 colonne sur mobile */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1.4fr 1fr',
        gap: 20,
        alignItems: 'start',
      }}>

        {/* ── LEFT: Identité ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <Card>
            {/* Avatar + nom */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 8,
                background: avatarColor, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700, flexShrink: 0,
              }}>
                {initials}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>
                  {GENRE_LABELS[contact.genre]} {contact.prenom} {contact.nom}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {contact.telephone}
                </div>
                {contact.email && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {contact.email}
                  </div>
                )}
              </div>
            </div>

            {/* Badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
              <Badge bg={PROFIL_BADGE[contact.profil].bg} text={PROFIL_BADGE[contact.profil].text}>
                {PROFIL_LABELS[contact.profil]}
              </Badge>
              <Badge bg={STATUT_COLORS[contact.statut].bg} text={STATUT_COLORS[contact.statut].text}>
                {STATUT_LABELS[contact.statut]}
              </Badge>
              <Badge bg={CANAL_BADGE[contact.canal].bg} text={CANAL_BADGE[contact.canal].text}>
                {CANAL_LABELS[contact.canal]}
              </Badge>
            </div>

            {/* Campus + date */}
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 16 }}>
              {CAMPUS_LABELS[contact.campus]}
              {' · Inscrit le '}
              {new Date(contact.date_inscription).toLocaleDateString('fr-FR')}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {canEdit && (
                <Link
                  to={`/contacts/${id}/edit`}
                  style={{
                    display: 'block', textAlign: 'center',
                    padding: '8px 0', borderRadius: 6,
                    background: 'var(--accent-teal)', color: '#fff',
                    textDecoration: 'none', fontWeight: 600, fontSize: 14,
                  }}
                >
                  Modifier
                </Link>
              )}
              {canWrite && (
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Changer le statut
                  </label>
                  <select
                    value={contact.statut}
                    disabled={statutSaving}
                    onChange={e => handleStatutChange(e.target.value as StatutContact)}
                    style={{
                      width: '100%', padding: '6px 8px', borderRadius: 6,
                      border: '1px solid var(--bg-card-border)',
                      background: 'var(--bg-card)', color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  >
                    {STATUT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {canWrite && (
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Intention
                  </label>
                  <select
                    value={contact.intention ?? 'souhaite_integrer'}
                    onChange={async e => {
                      const intention = e.target.value as Intention;
                      await contactsEndpoints.update(contact.id, { intention });
                      setContact(prev => prev ? { ...prev, intention } : prev);
                    }}
                    style={{
                      width: '100%', padding: '6px 8px', borderRadius: 6,
                      border: `2px solid ${INTENTION_COLORS[contact.intention ?? 'souhaite_integrer']}`,
                      background: 'var(--bg-card)', color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  >
                    {(Object.keys(INTENTION_LABELS) as Intention[]).map(key => (
                      <option key={key} value={key}>{INTENTION_LABELS[key]}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Certificat d'intégration */}
              {(contact.statut === 'integre' || contact.statut === 'ouvrier') && (
                <button
                  onClick={async () => {
                    const response = await fetch(
                      `${(import.meta as unknown as { env: Record<string, string> }).env.VITE_API_URL}/contacts/${contact.id}/certificat`,
                      { headers: { Authorization: `Bearer ${localStorage.getItem('phila_token')}` } },
                    );
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `certificat-${contact.prenom}-${contact.nom}.pdf`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{
                    background: '#D4A24E', color: 'white', border: 'none', borderRadius: '8px',
                    padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    width: '100%', justifyContent: 'center',
                  }}
                >
                  <GraduationCap size={16} /> Télécharger le certificat PDF
                </button>
              )}

              {/* Promotion ouvrier */}
              {canEdit && contact.statut === 'integre' && (
                isOuvrier ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 6, padding: '8px 0', borderRadius: 6,
                    background: 'var(--badge-nouveau-bg)',
                    color: 'var(--badge-nouveau-text)',
                    fontSize: 13, fontWeight: 600,
                  }}>
                    ✓ Ouvrier actif
                  </div>
                ) : (
                  <button
                    onClick={() => { setShowPromoteModal(true); setPromoteError(null); }}
                    style={{
                      width: '100%', padding: '8px 0', borderRadius: 6,
                      border: '1px solid var(--accent-teal)',
                      background: 'transparent', color: 'var(--accent-teal)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Promouvoir en ouvrier
                  </button>
                )
              )}
            </div>
          </Card>

          {/* Infos formulaire */}
          <Card title="Informations">
            <InfoRow label="Genre"       value={GENRE_LABELS[contact.genre]} />
            <InfoRow label="Statut Phila" value={STATUT_PHILA_LABELS[contact.statut_phila]} />
            <InfoRow label="État civil"  value={ETAT_CIVIL_LABELS[contact.etat_civil]} />
            <InfoRow label="Ville"       value={contact.ville} />
            <InfoRow label="Date de naissance" value={
              contact.date_naissance
                ? (() => {
                    const d   = new Date(contact.date_naissance);
                    const age = new Date().getFullYear() - d.getFullYear() -
                      (new Date() < new Date(new Date().getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
                    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) + ` (${age} ans)`;
                  })()
                : 'Non renseignée'
            } />
            {contact.disponibilite_suivi && (
              <InfoRow label="Disponibilité" value={DISPO_LABELS[contact.disponibilite_suivi]} />
            )}
            <InfoRow label="RDV pasteur" value={contact.rdv_pasteur ? 'Oui' : 'Non'} />
            {contact.profil === 'membre_phila' && contact.interet_cellule && (
              <InfoRow label="Intérêt cellule" value={INTERET_CELLULE_LABELS[contact.interet_cellule]} />
            )}
            {contact.profil === 'membre_phila' && contact.comment_connu && (
              <InfoRow label="Comment connu" value={contact.comment_connu} />
            )}
            {contact.profil !== 'membre_phila' && contact.souhait && (
              <InfoRow label="Souhait" value={SOUHAIT_LABELS[contact.souhait]} />
            )}
            {contact.profil !== 'membre_phila' && contact.besoins?.length > 0 && (
              <InfoRow label="Besoins" value={contact.besoins.map(b => BESOIN_LABELS[b]).join(', ')} />
            )}
            {contact.profil !== 'membre_phila' && contact.autre_eglise && (
              <InfoRow label="Autre église" value={contact.nom_autre_eglise ?? 'Oui'} />
            )}
          </Card>
        </div>

        {/* ── CENTER: Checklist + Commentaires ──────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <Card title={`Checklist d'intégration (${completedCount}/${ETAPES_ORDER.length})`}>
            {/* Progress bar */}
            <div style={{
              height: 6, borderRadius: 3,
              background: 'var(--bg-card-border)',
              marginBottom: 18, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: completedCount === ETAPES_ORDER.length ? '#22c55e' : 'var(--accent-teal)',
                width: `${(completedCount / ETAPES_ORDER.length) * 100}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ETAPES_ORDER.map(etape => {
                const item       = checklist.find(i => i.etape === etape);
                const isComplete = item?.complete ?? false;
                return (
                  <div
                    key={etape}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px', borderRadius: 6,
                      background: isComplete ? 'var(--surface-hover)' : 'transparent',
                      border: '1px solid var(--bg-card-border)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isComplete}
                      disabled={!canWrite || !item}
                      onChange={() => handleChecklistToggle(etape, isComplete)}
                      style={{
                        marginTop: 2,
                        accentColor: 'var(--accent-teal)',
                        cursor: canWrite && item ? 'pointer' : 'default',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 500,
                        color: isComplete ? 'var(--text-secondary)' : 'var(--text-primary)',
                        textDecoration: isComplete ? 'line-through' : 'none',
                      }}>
                        {ETAPE_LABELS[etape]}
                      </div>
                      {isComplete && item?.complete_par && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {item.complete_par.prenom} {item.complete_par.nom}
                          {item.complete_le && ` · ${new Date(item.complete_le).toLocaleDateString('fr-FR')}`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Commentaires">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {commentaires.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
                  Aucun commentaire.
                </p>
              )}
              {commentaires.map(c => (
                <div
                  key={c.id}
                  style={{
                    padding: '10px 12px', borderRadius: 6,
                    background: 'var(--surface-hover)',
                    border: '1px solid var(--bg-card-border)',
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {c.auteur.prenom} {c.auteur.nom}
                    </strong>
                    {' · '}
                    {new Date(c.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {c.contenu}
                  </div>
                </div>
              ))}
            </div>

            {canWrite && (
              <form onSubmit={handleAddComment} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Ajouter un commentaire…"
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 10px',
                    borderRadius: 6, border: '1px solid var(--bg-card-border)',
                    background: 'var(--bg-card)', color: 'var(--text-primary)',
                    fontSize: 13, resize: 'vertical', boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="submit"
                  disabled={commentSaving || !newComment.trim()}
                  style={{
                    alignSelf: 'flex-end',
                    padding: '6px 16px', borderRadius: 6, border: 'none',
                    background: 'var(--accent-teal)', color: '#fff',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    opacity: commentSaving || !newComment.trim() ? 0.6 : 1,
                  }}
                >
                  {commentSaving ? 'Envoi…' : 'Ajouter'}
                </button>
              </form>
            )}
          </Card>
        </div>

        {/* ── RIGHT: Référents + Historique + Messages ──────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <Card title="Référents">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <ReferentField
                label="Référent intégration"
                current={contact.referent_integration ?? null}
                allUsers={allUsers}
                canEdit={!!canEdit}
                saving={refIntSaving}
                onChange={handleRefIntChange}
              />

              {/* Suggestion automatique — visible aux admins uniquement */}
              {canEdit && (
                <div>
                  <button
                    onClick={async () => {
                      setSuggLoading(true);
                      try {
                        const res = await contactsEndpoints.suggererReferent(contact.id);
                        setSuggestion(res.data.suggestion);
                      } catch { /* silent */ } finally { setSuggLoading(false); }
                    }}
                    disabled={suggLoading}
                    style={{
                      padding: '5px 12px', fontSize: 12, fontWeight: 600,
                      borderRadius: 6, border: '1px solid var(--bg-card-border)',
                      background: 'none', color: 'var(--text-secondary)',
                      cursor: suggLoading ? 'default' : 'pointer',
                      opacity: suggLoading ? 0.6 : 1, fontFamily: 'inherit',
                    }}
                  >
                    {suggLoading ? '…' : <><Lightbulb size={14} /> Suggérer un référent</>}
                  </button>

                  {suggestion && (
                    <div style={{
                      background: 'var(--bg-card)', marginTop: 8, padding: 12,
                      borderRadius: 8, border: '1px solid var(--accent-teal)',
                    }}>
                      <p style={{ margin: '0 0 8px', fontSize: 13 }}>
                        <strong>Suggestion :</strong>{' '}
                        {suggestion.prenom} {suggestion.nom}
                        <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                          ({suggestion.nb_contacts} contact{suggestion.nb_contacts !== 1 ? 's' : ''} assigné{suggestion.nb_contacts !== 1 ? 's' : ''})
                        </span>
                      </p>
                      <button
                        onClick={() => { handleRefIntChange(suggestion.id); setSuggestion(null); }}
                        style={{
                          padding: '5px 12px', fontSize: 12, fontWeight: 600,
                          borderRadius: 6, border: 'none',
                          background: 'var(--accent-teal)', color: '#fff',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        Assigner ce référent
                      </button>
                    </div>
                  )}
                </div>
              )}
              <ReferentField
                label="Référent église"
                current={contact.referent_eglise ?? null}
                allUsers={allUsers}
                canEdit={!!canEdit}
                saving={refEglSaving}
                onChange={handleRefEglChange}
              />
              {contact.date_attribution_referent && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Attribué le {new Date(contact.date_attribution_referent).toLocaleDateString('fr-FR')}
                </div>
              )}
            </div>
          </Card>

          <Card title="Historique des statuts">
            {historique.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
                Aucun changement de statut.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {historique.map((h, i) => (
                <div key={h.id} style={{ display: 'flex', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--accent-teal)', flexShrink: 0, marginTop: 5,
                    }} />
                    {i < historique.length - 1 && (
                      <div style={{ width: 1, flex: 1, background: 'var(--bg-card-border)', minHeight: 16 }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: 14 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                      <span style={{ textDecoration: 'line-through', color: 'var(--text-secondary)' }}>
                        {STATUT_LABELS[h.statut_avant]}
                      </span>
                      {' → '}
                      <strong>{STATUT_LABELS[h.statut_apres]}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {h.change_par.prenom} {h.change_par.nom}
                      {' · '}
                      {new Date(h.created_at).toLocaleDateString('fr-FR')}
                    </div>
                    {h.commentaire && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 2 }}>
                        {h.commentaire}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Messages envoyés">
            {messages.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
                Aucun message envoyé.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {messages.slice(0, 5).map(m => (
                <div
                  key={m.id}
                  style={{
                    padding: '8px 10px', borderRadius: 6,
                    border: '1px solid var(--bg-card-border)',
                    background: 'var(--surface-hover)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {m.type === 'bienvenue' ? 'Bienvenue' : m.type === 'evenement' ? 'Événement' : 'Actualité'}
                    </span>
                    <span style={{
                      fontSize: 11,
                      color: m.statut === 'envoye' ? '#22c55e' : m.statut === 'echoue' ? '#ef4444' : 'var(--text-secondary)',
                    }}>
                      {m.statut === 'envoye' ? 'Envoyé' : m.statut === 'echoue' ? 'Échoué' : 'En attente'}
                    </span>
                  </div>
                  {m.envoye_le && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {new Date(m.envoye_le).toLocaleDateString('fr-FR')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* ── Historique des modifications (Audit) ──────────────────── */}
          <Card title="Historique des modifications">
            {auditLogs.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
                Aucune modification enregistrée.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {auditLogs.map((log, i) => {
                  const color = AUDIT_COLORS[log.action];
                  const icon  = AUDIT_ICONS[log.action];
                  return (
                    <div key={log.id} style={{ display: 'flex', gap: 10 }}>
                      {/* Ligne verticale de timeline */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%',
                          background: `${color}20`,
                          border: `2px solid ${color}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, color, flexShrink: 0,
                        }}>
                          {icon}
                        </div>
                        {i < auditLogs.length - 1 && (
                          <div style={{ width: 1, flex: 1, background: 'var(--bg-card-border)', minHeight: 12 }} />
                        )}
                      </div>

                      {/* Contenu */}
                      <div style={{ paddingBottom: 14, minWidth: 0, flex: 1 }}>
                        {/* Description */}
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 }}>
                          {log.description}
                        </div>

                        {/* ancienne → nouvelle valeur */}
                        {(log.ancienne_valeur || log.nouvelle_valeur) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                            {log.ancienne_valeur && (
                              <span style={{
                                padding: '1px 6px', borderRadius: 3,
                                background: 'var(--surface-hover)',
                                border: '1px solid var(--bg-card-border)',
                                fontSize: 11, color: 'var(--text-secondary)',
                                textDecoration: 'line-through',
                              }}>
                                {log.ancienne_valeur}
                              </span>
                            )}
                            {log.ancienne_valeur && log.nouvelle_valeur && (
                              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>→</span>
                            )}
                            {log.nouvelle_valeur && (
                              <span style={{
                                padding: '1px 6px', borderRadius: 3,
                                background: `${color}15`,
                                border: `1px solid ${color}40`,
                                fontSize: 11, color,
                              }}>
                                {log.nouvelle_valeur}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Auteur + date */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          marginTop: 4, flexWrap: 'wrap',
                        }}>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {log.auteur.prenom} {log.auteur.nom}
                          </span>
                          <span style={{
                            padding: '0 5px', borderRadius: 3,
                            background: 'var(--surface-hover)',
                            border: '1px solid var(--bg-card-border)',
                            fontSize: 10, color: 'var(--text-secondary)',
                          }}>
                            {ROLE_LABELS[log.auteur.role]}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            {dateRelative(log.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

      </div>

      {/* ── Promotion modal ───────────────────────────────────────────────── */}
      {showPromoteModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowPromoteModal(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px', boxSizing: 'border-box',
          }}
        >
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12,
            border: '1px solid var(--bg-card-border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            padding: 24, width: 'min(640px, calc(100% - 32px))', maxHeight: '90vh',
            overflowY: 'auto', boxSizing: 'border-box',
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              Promouvoir en ouvrier
            </h2>

            {promoteError && (
              <div style={{
                marginBottom: 14, padding: '8px 12px', borderRadius: 6,
                background: '#fef2f2', border: '1px solid #fca5a5',
                color: '#b91c1c', fontSize: 13,
              }}>
                {promoteError}
              </div>
            )}

            <form onSubmit={handlePromote} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Campus */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Campus
                </label>
                <select
                  value={promoteCampus}
                  onChange={e => setPromoteCampus(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6,
                    border: '1px solid var(--bg-card-border)',
                    background: 'var(--bg-card)', color: 'var(--text-primary)',
                    fontSize: 14,
                  }}
                >
                  <option value="paris">Paris</option>
                  <option value="paris_nord">Paris Nord</option>
                </select>
              </div>

              {/* Services */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Services
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: '8px 14px',
                  padding: '12px 14px', borderRadius: 6,
                  border: '1px solid var(--bg-card-border)',
                  background: 'var(--surface-hover)',
                }}>
                  {PROMOTE_SERVICES.map(s => (
                    <label
                      key={s.value}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={promoteServices.includes(s.value)}
                        onChange={() =>
                          setPromoteServices(prev =>
                            prev.includes(s.value) ? prev.filter(x => x !== s.value) : [...prev, s.value]
                          )
                        }
                        style={{ accentColor: 'var(--accent-teal)', cursor: 'pointer' }}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Date début */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Date de début de service
                </label>
                <input
                  type="date"
                  value={promoteDate}
                  onChange={e => setPromoteDate(e.target.value)}
                  style={{
                    padding: '8px 10px', borderRadius: 6,
                    border: '1px solid var(--bg-card-border)',
                    background: 'var(--bg-card)', color: 'var(--text-primary)',
                    fontSize: 14, width: 200,
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShowPromoteModal(false)}
                  style={{
                    flex: 1, minWidth: '100px',
                    padding: '8px 18px', borderRadius: 6,
                    border: '1px solid var(--bg-card-border)',
                    background: 'var(--bg-card)', color: 'var(--text-primary)',
                    fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={promoteSaving}
                  style={{
                    flex: 1, minWidth: '100px',
                    padding: '8px 22px', borderRadius: 6, border: 'none',
                    background: 'var(--accent-teal)', color: '#fff',
                    fontSize: 14, fontWeight: 600,
                    cursor: promoteSaving ? 'not-allowed' : 'pointer',
                    opacity: promoteSaving ? 0.7 : 1,
                  }}
                >
                  {promoteSaving ? 'Enregistrement…' : 'Confirmer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
