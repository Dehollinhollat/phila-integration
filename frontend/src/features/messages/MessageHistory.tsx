// src/features/messages/MessageHistory.tsx
// Page historique des messages WhatsApp envoyés par le système.
// Affiche une table paginée avec filtres (type, statut, campus, période)
// et une modal de détail pour chaque message.
// Accessible aux admin_campus et super_admin.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { messagesEndpoints } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import { ROLE_RANK } from '../../utils/constants';
import type { Message } from '../../types';

const PAGE_SIZE = 50;

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh   = String(d.getHours()).padStart(2, '0');
  const min  = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

// ─── Badge Type ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    bienvenue: { bg: 'var(--badge-enligne-bg)',        color: 'var(--badge-enligne-text)',    label: 'Bienvenue' },
    evenement: { bg: 'rgba(139,92,246,0.12)',           color: 'var(--accent-violet)',          label: 'Événement' },
    actu:      { bg: 'var(--accent-gold-light, #fef3c7)', color: 'var(--accent-gold)',          label: 'Actualité' },
  };
  const s = styles[type] ?? { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)', label: type };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px',
      borderRadius: '12px', fontSize: '11px', fontWeight: 600,
      background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

// ─── Badge Statut ─────────────────────────────────────────────────────────────

function StatutBadge({ statut }: { statut: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    envoye:     { bg: 'rgba(34,197,94,0.12)',  color: '#16a34a', label: 'Envoyé' },
    en_attente: { bg: 'var(--accent-gold-light, #fef3c7)', color: 'var(--accent-gold)', label: 'En attente' },
    echoue:     { bg: 'rgba(239,68,68,0.12)',  color: 'var(--accent-red)',  label: 'Échoué' },
  };
  const s = styles[statut] ?? { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)', label: statut };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px',
      borderRadius: '12px', fontSize: '11px', fontWeight: 600,
      background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

// ─── Modal détail ─────────────────────────────────────────────────────────────

function MessageModal({ message, onClose }: { message: Message & { contact?: { prenom: string; nom: string } | null }; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', boxSizing: 'border-box',
      }}
    >
      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(520px, calc(100% - 32px))',
          maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--bg-card-solid, #1a2332)', border: '1px solid var(--bg-card-border)',
          borderRadius: '12px', padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <TypeBadge type={message.type} />
            <StatutBadge statut={message.statut} />
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-tertiary)', fontSize: '20px', lineHeight: 1,
              padding: '0 4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Destinataire */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            Destinataire
          </div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {message.contact ? `${message.contact.prenom} ${message.contact.nom}` : 'Broadcast'}
          </div>
        </div>

        {/* Canal */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            Canal
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>WhatsApp</div>
        </div>

        {/* Date */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            Date
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>{formatDate(message.created_at as unknown as string)}</div>
        </div>

        {/* Contenu */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Contenu
          </div>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px',
            color: 'var(--text-primary)', fontSize: '0.875rem', lineHeight: 1.6,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {message.contenu}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type MessageWithContact = Message & {
  contact?: { id: string; prenom: string; nom: string; telephone: string } | null;
};

export default function MessageHistory() {
  const navigate  = useNavigate();
  const { user }  = useAuth();

  const [messages, setMessages]   = useState<MessageWithContact[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);

  // Filtres
  const [type,    setType]    = useState('');
  const [statut,  setStatut]  = useState('');
  const [campus,  setCampus]  = useState('');
  const [periode, setPeriode] = useState('');

  // Modal
  const [selected, setSelected] = useState<MessageWithContact | null>(null);

  useEffect(() => {
    if (selected) document.dispatchEvent(new CustomEvent('modal-opened'));
  }, [selected]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Flash succès (depuis MessageCompose)
  const [flash, setFlash] = useState('');

  const isAdmin     = user ? ROLE_RANK[user.role] >= ROLE_RANK['admin_campus'] : false;
  // Envoi restreint aux super_admin et admin_campus — les référents voient uniquement l'historique
  const peutEnvoyer = user?.role === 'super_admin' || user?.role === 'admin_campus';

  useEffect(() => {
    const msg = localStorage.getItem('compose_success');
    if (msg) {
      setFlash(msg);
      localStorage.removeItem('compose_success');
      const t = setTimeout(() => setFlash(''), 4000);
      return () => clearTimeout(t);
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page };
      if (type)    params.type    = type;
      if (statut)  params.statut  = statut;
      if (campus)  params.campus  = campus;
      if (periode) params.periode = periode;

      const { data } = await messagesEndpoints.list(params as Parameters<typeof messagesEndpoints.list>[0]);
      setMessages(data.messages as MessageWithContact[]);
      setTotal(data.total);
    } catch {
      // silencieux — l'état loading=false suffit
    } finally {
      setLoading(false);
    }
  }, [type, statut, campus, periode, page]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  function resetFilters() {
    setType('');
    setStatut('');
    setCampus('');
    setPeriode('');
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // KPI depuis les messages chargés (approximatif — la page courante)
  const kpiEnvoye    = messages.filter((m) => m.statut === 'envoye').length;
  const kpiAttente   = messages.filter((m) => m.statut === 'en_attente').length;
  const kpiEchoue    = messages.filter((m) => m.statut === 'echoue').length;

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px) clamp(12px, 3vw, 32px)', fontFamily: 'inherit' }}>
      {/* Flash */}
      {flash && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', borderRadius: '8px',
          background: 'rgba(34,197,94,0.12)', color: '#16a34a',
          border: '1px solid rgba(34,197,94,0.3)', fontSize: '0.875rem',
        }}>
          {flash}
        </div>
      )}

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Messagerie
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {total} message{total !== 1 ? 's' : ''} au total
          </p>
        </div>
        {peutEnvoyer && (
          <button
            onClick={() => navigate('/messagerie/nouveau')}
            style={{
              padding: '9px 18px', borderRadius: '8px',
              background: 'var(--accent-teal)', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600,
            }}
          >
            + Nouveau message
          </button>
        )}
      </div>

      {/* KPI */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Envoyés',    value: kpiEnvoye,  color: '#16a34a', bg: 'rgba(34,197,94,0.08)' },
          { label: 'En attente', value: kpiAttente, color: 'var(--accent-gold)', bg: 'var(--accent-gold-light, #fef3c7)' },
          { label: 'Échoués',    value: kpiEchoue,  color: 'var(--accent-red)', bg: 'rgba(239,68,68,0.08)' },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              flex: 1, padding: '16px 20px', borderRadius: '10px',
              background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
            }}
          >
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{
        display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center',
        marginBottom: '20px', padding: '14px 16px',
        background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)', borderRadius: '10px',
      }}>
        <select
          value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}
          style={selectStyle}
        >
          <option value="">Tous les types</option>
          <option value="bienvenue">Bienvenue</option>
          <option value="evenement">Événement</option>
          <option value="actu">Actualité</option>
        </select>

        <select
          value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1); }}
          style={selectStyle}
        >
          <option value="">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="envoye">Envoyé</option>
          <option value="echoue">Échoué</option>
        </select>

        {isAdmin && (
          <select
            value={campus} onChange={(e) => { setCampus(e.target.value); setPage(1); }}
            style={selectStyle}
          >
            <option value="">Tous les campus</option>
            <option value="paris">Paris</option>
            <option value="paris_nord">Paris Nord</option>
          </select>
        )}

        <select
          value={periode} onChange={(e) => { setPeriode(e.target.value); setPage(1); }}
          style={selectStyle}
        >
          <option value="">Toute la période</option>
          <option value="ce_mois">Ce mois</option>
          <option value="ce_trimestre">Ce trimestre</option>
        </select>

        <button
          onClick={resetFilters}
          style={{
            padding: '7px 14px', borderRadius: '6px',
            background: 'none', border: '1px solid var(--bg-card-border)',
            color: 'var(--text-secondary)', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '0.8rem',
          }}
        >
          Réinitialiser
        </button>
      </div>

      {/* Tableau */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
        borderRadius: '12px', overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⏳</div>
            Chargement…
          </div>
        ) : messages.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💬</div>
            Aucun message trouvé
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', display: 'block' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                {(isMobile
                  ? ['Destinataire', 'Contenu', 'Statut', '']
                  : ['Type', 'Destinataire', 'Contenu', 'Canal', 'Statut', 'Date', '']
                ).map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: '10px 14px', textAlign: 'left',
                      fontSize: '11px', fontWeight: 600,
                      color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em',
                      borderBottom: '1px solid var(--bg-card-border)',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {messages.map((msg) => (
                <tr
                  key={msg.id}
                  style={{ borderBottom: '1px solid var(--bg-card-border)', transition: '80ms' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  {!isMobile && <td style={tdStyle}><TypeBadge type={msg.type} /></td>}
                  <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {msg.contact ? `${msg.contact.prenom} ${msg.contact.nom}` : 'Broadcast'}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)', maxWidth: isMobile ? '160px' : '260px' }}>
                    {truncate(msg.contenu, isMobile ? 30 : 80)}
                  </td>
                  {!isMobile && <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>WhatsApp</td>}
                  <td style={tdStyle}><StatutBadge statut={msg.statut} /></td>
                  {!isMobile && (
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDate(msg.created_at as unknown as string)}
                    </td>
                  )}
                  <td style={tdStyle}>
                    <button
                      onClick={() => setSelected(msg)}
                      style={{
                        padding: '5px 12px', borderRadius: '6px',
                        background: 'none', border: '1px solid var(--bg-card-border)',
                        color: 'var(--text-secondary)', cursor: 'pointer',
                        fontFamily: 'inherit', fontSize: '0.8rem',
                      }}
                    >
                      Voir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '20px' }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={paginationBtn(page === 1)}
          >
            ← Précédent
          </button>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={paginationBtn(page === totalPages)}
          >
            Suivant →
          </button>
        </div>
      )}

      {/* Modal */}
      {selected && <MessageModal message={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ─── Styles utilitaires ───────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', borderRadius: '6px',
  border: '1px solid var(--bg-card-border)',
  background: 'var(--bg-card)', color: 'var(--text-primary)',
  fontFamily: 'inherit', fontSize: '0.8rem', cursor: 'pointer',
};

const tdStyle: React.CSSProperties = {
  padding: '11px 14px', fontSize: '0.875rem', verticalAlign: 'middle',
};

function paginationBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '7px 16px', borderRadius: '6px',
    border: '1px solid var(--bg-card-border)',
    background: disabled ? 'var(--bg-secondary)' : 'var(--bg-card)',
    color: disabled ? 'var(--text-tertiary)' : 'var(--text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', fontSize: '0.875rem',
    opacity: disabled ? 0.5 : 1,
  };
}
