// src/features/contacts/ContactList.tsx
// Liste paginée des contacts avec filtres, recherche, et actions (modifier/supprimer).
// Colonne Actions visible uniquement pour admin_campus et super_admin.
// La suppression ouvre une boîte de dialogue de confirmation avant d'appeler DELETE.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { contactsEndpoints } from '../../services/endpoints';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { ContactRow, Canal, StatutContact, Campus, Profil, Intention } from '../../types';
import {
  CAMPUS_LABELS, STATUT_LABELS, STATUT_COLORS,
  CANAL_LABELS, CANAL_BADGE, PROFIL_BADGE, PROFIL_LABELS, ROLE_RANK,
  INTENTION_LABELS, INTENTION_COLORS,
} from '../../utils/constants';

const PAGE_SIZE = 15;

// ─── Types import ─────────────────────────────────────────────────────────────

interface ImportResult {
  importes: number;
  ignores:  number;
  erreurs:  { ligne: number; raison: string }[];
}

// ─── ImportModal ──────────────────────────────────────────────────────────────

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<ImportResult | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post<ImportResult>('/import/contacts', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      onDone();
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message as string | undefined) ?? 'Erreur lors de l\'import'
        : 'Erreur inattendue';
      setError(msg);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '16px', boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog" aria-modal="true"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', borderRadius: '12px', padding: '24px',
          width: 'min(520px, calc(100% - 32px))', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)', border: '1px solid var(--bg-card-border)',
          boxSizing: 'border-box',
        }}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Importer des contacts depuis Excel
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          Fichier .xlsx, .xls ou .csv. Colonnes attendues : CIVILITE, PRENOM, NOM, CONTACT (téléphone), CAMPUS…
          Les contacts dont le numéro existe déjà sont ignorés.
        </p>

        {!result && (
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '8px', padding: '32px 16px',
            border: '2px dashed var(--bg-card-border)', borderRadius: '10px',
            cursor: loading ? 'not-allowed' : 'pointer',
            background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
            fontSize: '0.875rem', transition: '120ms ease',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {loading ? 'Import en cours…' : 'Cliquer pour choisir un fichier'}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={loading}
              onChange={e => void handleFile(e)}
              style={{ display: 'none' }}
            />
          </label>
        )}

        {error && (
          <div style={{
            marginTop: '12px', padding: '10px 14px', borderRadius: '8px',
            background: 'rgba(220,38,38,0.08)', color: 'var(--accent-red)',
            border: '1px solid rgba(220,38,38,0.2)', fontSize: '0.8125rem',
          }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ marginTop: '4px' }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <span style={badgeStat('#ECFDF5', '#059669')}>✓ {result.importes} importé{result.importes !== 1 ? 's' : ''}</span>
              <span style={badgeStat('#FFF7ED', '#D97706')}>⏭ {result.ignores} ignoré{result.ignores !== 1 ? 's' : ''}</span>
              {result.erreurs.length > 0 && (
                <span style={badgeStat('rgba(220,38,38,0.08)', 'var(--accent-red)')}>✕ {result.erreurs.length} erreur{result.erreurs.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            {result.erreurs.length > 0 && (
              <div style={{
                maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--bg-card-border)',
                borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)',
              }}>
                {result.erreurs.map((e, i) => (
                  <div key={i} style={{
                    padding: '6px 12px', borderBottom: '1px solid var(--bg-card-border)',
                    display: 'flex', gap: '8px',
                  }}>
                    <span style={{ color: 'var(--accent-red)', fontWeight: 600, whiteSpace: 'nowrap' }}>Ligne {e.ligne}</span>
                    <span>{e.raison}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, minWidth: '100px',
              padding: '8px 18px', borderRadius: '8px',
              border: '1px solid var(--bg-card-border)', background: 'transparent',
              color: 'var(--text-primary)', fontSize: '0.875rem', cursor: 'pointer',
            }}
          >
            Fermer
          </button>
          {result && (
            <button
              onClick={() => { setResult(null); setError(null); }}
              style={{
                flex: 1, minWidth: '100px',
                padding: '8px 18px', borderRadius: '8px',
                background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                border: '1px solid var(--accent-teal)', fontSize: '0.875rem',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Nouvel import
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function badgeStat(bg: string, color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '4px 10px', borderRadius: '999px',
    background: bg, color, fontSize: '0.8125rem', fontWeight: 600,
  };
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  contactName,
  onConfirm,
  onCancel,
  loading,
  error,
}: {
  contactName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', boxSizing: 'border-box',
      }}
    >
      <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
        borderRadius: '12px', padding: '24px',
        width: 'min(520px, calc(100% - 32px))',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        boxSizing: 'border-box',
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px', lineHeight: 1 }}>🗑️</div>
        <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700 }}>
          Supprimer ce contact ?
        </h3>
        <p style={{ margin: '0 0 6px', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.55 }}>
          Voulez-vous vraiment supprimer <strong style={{ color: 'var(--text-primary)' }}>{contactName}</strong> ?
          Cette action est irréversible.
        </p>
        <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          Les commentaires, la checklist et l'historique associés seront également supprimés.
        </p>
        {error && (
          <div style={{
            marginBottom: '14px', padding: '8px 12px', borderRadius: '8px',
            background: 'rgba(220,38,38,0.08)', color: 'var(--accent-red)',
            border: '1px solid rgba(220,38,38,0.2)', fontSize: '0.8rem',
          }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '20px' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1, minWidth: '100px',
              padding: '8px 18px', borderRadius: '8px',
              border: '1px solid var(--bg-card-border)', background: 'transparent',
              color: 'var(--text-primary)', fontSize: '0.875rem', cursor: 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1, minWidth: '100px',
              padding: '8px 18px', borderRadius: '8px',
              background: 'var(--accent-red)', border: 'none',
              color: '#fff', fontSize: '0.875rem', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, transition: '120ms ease',
            }}
          >
            {loading ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SkeletonRow ──────────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  const widths = ['32px', '120px', '100px', '48px', '72px', '72px', '110px', '80px', '80px', '60px'];
  return (
    <tr>
      {widths.slice(0, cols).map((w, i) => (
        <td key={i} style={{ padding: '12px 16px' }}>
          <div style={{
            height: '14px', width: w,
            background: 'var(--bg-secondary)', borderRadius: '4px',
          }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Icônes SVG ───────────────────────────────────────────────────────────────

function IconEdit() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2 4 14 4" />
      <path d="M5 4V2h6v2" />
      <path d="M3 4l1 10h8l1-10" />
      <line x1="6.5" y1="7" x2="6.5" y2="11" />
      <line x1="9.5" y1="7" x2="9.5" y2="11" />
    </svg>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ContactList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referentId = searchParams.get('referent_id');
  const { user } = useAuth();
  const canModify = !!user && ROLE_RANK[user.role] >= ROLE_RANK['admin_campus'];

  const [search, setSearch]                 = useState('');
  const [debouncedSearch, setDebounced]     = useState('');
  const [filterCampus, setCampus]           = useState<Campus | ''>('');
  const [filterProfil, setProfil]           = useState<Profil | ''>('');
  const [filterStatut, setStatut]           = useState<StatutContact | ''>('');
  const [filterCanal, setCanal]             = useState<Canal | ''>('');
  const [filterIntention, setIntention]     = useState<Intention | ''>('');
  const [page, setPage]                     = useState(1);

  const [contacts, setContacts]   = useState<ContactRow[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // État de la suppression
  const [deletingContact, setDeletingContact] = useState<ContactRow | null>(null);
  const [deleteLoading, setDeleteLoading]     = useState(false);
  const [deleteError, setDeleteError]         = useState<string | null>(null);

  // État de l'import Excel
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    if (deletingContact) document.dispatchEvent(new CustomEvent('modal-opened'));
  }, [deletingContact]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(val: string) {
    setSearch(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setDebounced(val); setPage(1); }, 300);
  }

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page, limit: PAGE_SIZE };
      if (debouncedSearch)  params.search      = debouncedSearch;
      if (filterCampus)     params.campus      = filterCampus;
      if (filterProfil)     params.profil      = filterProfil;
      if (filterStatut)     params.statut      = filterStatut;
      if (filterCanal)      params.canal       = filterCanal;
      if (filterIntention)  params.intention   = filterIntention;
      if (referentId)       params.referent_id = referentId;

      const { data } = await contactsEndpoints.list(
        params as Parameters<typeof contactsEndpoints.list>[0],
      );
      setContacts(data.contacts ?? []);
      setTotal(data.total);
    } catch {
      setError('Impossible de charger les contacts.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterCampus, filterProfil, filterStatut, filterCanal, filterIntention, referentId]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  function resetFilters() {
    setSearch(''); setDebounced('');
    setCampus(''); setProfil(''); setStatut(''); setCanal(''); setIntention('');
    setPage(1);
  }

  async function handleDeleteConfirm() {
    if (!deletingContact) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await contactsEndpoints.delete(deletingContact.id);
      setDeletingContact(null);
      // Recule d'une page si on supprime le dernier élément de la page courante
      if (contacts.length === 1 && page > 1) {
        setPage(p => p - 1);
      } else {
        fetchContacts();
      }
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message as string | undefined) ?? 'Erreur lors de la suppression'
        : 'Erreur inattendue';
      setDeleteError(msg);
    } finally {
      setDeleteLoading(false);
    }
  }

  const hasFilters  = debouncedSearch || filterCampus || filterProfil || filterStatut || filterCanal || filterIntention;
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const colCount    = canModify ? 10 : 9;

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  function initials(prenom: string, nom: string) {
    return `${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase();
  }

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 24px) clamp(12px, 3vw, 32px)' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', marginBottom: '24px',
        flexWrap: 'wrap', gap: '12px',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            Contacts
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            {loading ? '…' : `${total} contact${total !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {canModify && (
            <button
              onClick={() => setShowImport(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '9px 16px',
                background: 'transparent', color: 'var(--text-primary)',
                border: '1px solid var(--bg-card-border)', borderRadius: '8px',
                fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                transition: '120ms ease',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Importer Excel
            </button>
          )}
          <button
            onClick={() => navigate('/contacts/nouveau')}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 18px',
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
              border: '1px solid var(--accent-teal)', borderRadius: '8px',
              fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 0 10px rgba(26,86,176,0.18)', transition: '120ms ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="7" y1="1" x2="7" y2="13" /><line x1="1" y1="7" x2="13" y2="7" />
            </svg>
            Nouveau contact
          </button>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
        borderRadius: '12px', padding: '14px 16px', marginBottom: '16px',
        display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center',
      }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
          <svg
            width="14" height="14" viewBox="0 0 16 16" fill="none"
            stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round"
            style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="6.5" cy="6.5" r="5" />
            <line x1="10.5" y1="10.5" x2="14.5" y2="14.5" />
          </svg>
          <input
            type="text"
            placeholder="Nom, prénom, téléphone…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 32px',
              border: '1px solid var(--bg-input-border)', borderRadius: '8px',
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <select value={filterCampus} onChange={(e) => { setCampus(e.target.value as Campus | ''); setPage(1); }} style={S.sel}>
          <option value="">Tous les campus</option>
          <option value="paris">Paris</option>
          <option value="paris_nord">Paris Nord</option>
        </select>

        <select value={filterProfil} onChange={(e) => { setProfil(e.target.value as Profil | ''); setPage(1); }} style={S.sel}>
          <option value="">Tous les profils</option>
          {(['membre_phila', 'visiteur_sans_eglise', 'visiteur_avec_eglise'] as Profil[]).map(p => (
            <option key={p} value={p}>{PROFIL_LABELS[p]}</option>
          ))}
        </select>

        <select value={filterStatut} onChange={(e) => { setStatut(e.target.value as StatutContact | ''); setPage(1); }} style={S.sel}>
          <option value="">Tous les statuts</option>
          {(['nouveau','contacte','en_suivi','integre','ouvrier','inactif'] as StatutContact[]).map(s => (
            <option key={s} value={s}>{STATUT_LABELS[s]}</option>
          ))}
        </select>

        <select value={filterCanal} onChange={(e) => { setCanal(e.target.value as Canal | ''); setPage(1); }} style={S.sel}>
          <option value="">Tous les canaux</option>
          <option value="presentiel">Présentiel</option>
          <option value="en_ligne">En ligne</option>
        </select>

        <select value={filterIntention} onChange={(e) => { setIntention(e.target.value as Intention | ''); setPage(1); }} style={S.sel}>
          <option value="">Toutes les intentions</option>
          {(Object.keys(INTENTION_LABELS) as Intention[]).map(k => (
            <option key={k} value={k}>{INTENTION_LABELS[k]}</option>
          ))}
        </select>

        {hasFilters && (
          <button onClick={resetFilters} style={S.resetBtn}>✕ Réinitialiser</button>
        )}
      </div>

      {/* ── Error liste ────────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          padding: '10px 16px', marginBottom: '16px',
          background: 'rgba(220,38,38,0.08)', color: 'var(--accent-red)',
          border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      {/* ── Vue cartes - mobile uniquement ─────────────────────────────────── */}
      <div className="contacts-card-view">
        {loading ? (
          [1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{
              background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
              borderRadius: '12px', padding: '14px 16px', height: '70px',
            }}>
              <div style={{ height: '14px', width: '60%', background: 'var(--bg-secondary)', borderRadius: '4px', marginBottom: '8px' }} />
              <div style={{ height: '12px', width: '40%', background: 'var(--bg-secondary)', borderRadius: '4px' }} />
            </div>
          ))
        ) : contacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>👥</div>
            <p style={{ margin: 0 }}>
              {hasFilters ? 'Aucun contact ne correspond à ces filtres.' : 'Aucun contact pour le moment.'}
            </p>
          </div>
        ) : (
          contacts.map((c) => (
            <div
              key={c.id}
              className="contact-card"
              onClick={() => navigate(`/contacts/${c.id}`)}
            >
              {/* Avatar */}
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                background: c.profil === 'membre_phila' ? 'var(--accent-teal)' : c.profil === 'visiteur_avec_eglise' ? 'var(--accent-violet)' : 'var(--accent-gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '0.75rem', fontWeight: 700,
              }}>
                {initials(c.prenom, c.nom)}
              </div>

              {/* Info principale */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.prenom} {c.nom}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '1px 7px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 500,
                    background: STATUT_COLORS[c.statut].bg, color: STATUT_COLORS[c.statut].text,
                  }}>
                    {STATUT_LABELS[c.statut]}
                  </span>
                  {c.intention && c.intention !== 'souhaite_integrer' && (
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 500,
                      color: INTENTION_COLORS[c.intention],
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}>
                      <span style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: INTENTION_COLORS[c.intention],
                        flexShrink: 0,
                      }} />
                      {INTENTION_LABELS[c.intention]}
                    </span>
                  )}
                  {c.referent_integration ? (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {c.referent_integration.prenom} {c.referent_integration.nom}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--accent-red)', fontWeight: 500 }}>
                      Non assigné
                    </span>
                  )}
                </div>
              </div>

              {/* Actions rapides */}
              {canModify && (
                <div
                  style={{ display: 'flex', gap: '4px', flexShrink: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    title="Modifier"
                    onClick={() => navigate(`/contacts/${c.id}/edit`)}
                    style={S.actionBtn}
                  >
                    <IconEdit />
                  </button>
                  <button
                    title="Supprimer"
                    onClick={() => { setDeleteError(null); setDeletingContact(c); }}
                    style={{ ...S.actionBtn, color: 'var(--accent-red)' }}
                  >
                    <IconTrash />
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        {/* Pagination cards */}
        {!loading && total > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 4px', flexWrap: 'wrap', gap: '8px',
          }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} sur {total}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ ...S.pageBtn, opacity: page === 1 ? 0.4 : 1 }}>← Préc.</button>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                style={{ ...S.pageBtn, opacity: page >= totalPages ? 0.4 : 1 }}>Suiv. →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Vue tableau - desktop/tablette ──────────────────────────────────── */}
      <div className="contacts-table-view" style={{
        background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
        borderRadius: '12px', overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--table-border)' }}>
                {[
                  { label: '',          cls: '' },
                  { label: 'Nom',       cls: '' },
                  { label: 'Téléphone', cls: '' },
                  { label: 'Profil',    cls: '' },
                  { label: 'Canal',     cls: 'col-secondary' },
                  { label: 'Statut',    cls: '' },
                  { label: 'Référent',  cls: '' },
                  { label: 'Campus',    cls: 'col-secondary' },
                  { label: 'Inscrit le',cls: 'col-secondary' },
                  ...(canModify ? [{ label: 'Actions', cls: '' }] : []),
                ].map(({ label, cls }, i) => (
                  <th key={i} className={cls} style={{
                    padding: '10px 16px', textAlign: 'left',
                    fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--table-header-text)',
                    whiteSpace: 'nowrap', background: 'var(--bg-secondary)',
                  }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={colCount} />)
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={colCount} style={{ padding: '56px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '10px' }}>👥</div>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {hasFilters
                        ? 'Aucun contact ne correspond à ces filtres.'
                        : 'Aucun contact pour le moment.'}
                    </p>
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/contacts/${c.id}`)}
                    style={{ borderBottom: '1px solid var(--table-border)', cursor: 'pointer', transition: '80ms ease' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                  >
                    {/* Avatar */}
                    <td style={{ padding: '10px 8px 10px 16px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                        background: c.profil === 'membre_phila' ? 'var(--accent-teal)' : c.profil === 'visiteur_avec_eglise' ? 'var(--accent-violet)' : 'var(--accent-gold)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '0.7rem', fontWeight: 700,
                      }}>
                        {initials(c.prenom, c.nom)}
                      </div>
                    </td>

                    {/* Nom */}
                    <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {c.prenom} {c.nom}
                      </span>
                    </td>

                    {/* Téléphone */}
                    <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {c.telephone}
                    </td>

                    {/* Profil */}
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        padding: '2px 9px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700,
                        background: PROFIL_BADGE[c.profil].bg, color: PROFIL_BADGE[c.profil].text,
                      }}>
                        {PROFIL_LABELS[c.profil]}
                      </span>
                    </td>

                    {/* Canal */}
                    <td className="col-secondary" style={{ padding: '10px 16px' }}>
                      <span style={{
                        padding: '2px 9px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 500,
                        background: CANAL_BADGE[c.canal].bg, color: CANAL_BADGE[c.canal].text,
                      }}>
                        {CANAL_LABELS[c.canal]}
                      </span>
                    </td>

                    {/* Statut + Intention */}
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{
                          padding: '2px 9px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 500,
                          background: STATUT_COLORS[c.statut].bg, color: STATUT_COLORS[c.statut].text,
                        }}>
                          {STATUT_LABELS[c.statut]}
                        </span>
                        {c.intention && c.intention !== 'souhaite_integrer' && (
                          <span style={{
                            fontSize: '0.65rem', fontWeight: 500,
                            color: INTENTION_COLORS[c.intention],
                            display: 'flex', alignItems: 'center', gap: 3,
                          }}>
                            <span style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: INTENTION_COLORS[c.intention],
                              flexShrink: 0,
                            }} />
                            {INTENTION_LABELS[c.intention]}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Référent */}
                    <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                      {c.referent_integration ? (
                        <span style={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                          {c.referent_integration.prenom} {c.referent_integration.nom}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--accent-red)', fontSize: '0.75rem', fontWeight: 500 }}>
                          Non assigné
                        </span>
                      )}
                    </td>

                    {/* Campus */}
                    <td className="col-secondary" style={{ padding: '10px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                      {CAMPUS_LABELS[c.campus]}
                    </td>

                    {/* Date */}
                    <td className="col-secondary" style={{ padding: '10px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                      {fmtDate(c.date_inscription)}
                    </td>

                    {/* Actions - admin_campus+ uniquement */}
                    {canModify && (
                      <td
                        style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            title="Modifier"
                            onClick={(e) => { e.stopPropagation(); navigate(`/contacts/${c.id}/edit`); }}
                            style={S.actionBtn}
                          >
                            <IconEdit />
                          </button>
                          <button
                            title="Supprimer"
                            onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeletingContact(c); }}
                            style={{ ...S.actionBtn, color: 'var(--accent-red)' }}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        {!loading && total > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 16px', borderTop: '1px solid var(--table-border)',
            flexWrap: 'wrap', gap: '8px',
          }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} sur {total}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ ...S.pageBtn, opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'default' : 'pointer' }}
              >
                ← Précédent
              </button>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '0 6px' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{ ...S.pageBtn, opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'default' : 'pointer' }}
              >
                Suivant →
              </button>
            </div>
          </div>
        )}
      </div>{/* fin contacts-table-view */}

      {/* ── ConfirmDialog suppression ──────────────────────────────────────── */}
      {deletingContact && (
        <ConfirmDialog
          contactName={`${deletingContact.prenom} ${deletingContact.nom}`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => { setDeletingContact(null); setDeleteError(null); }}
          loading={deleteLoading}
          error={deleteError}
        />
      )}

      {/* ── Modal import Excel ─────────────────────────────────────────────── */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onDone={() => { fetchContacts(); }}
        />
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  sel: {
    padding: '8px 12px',
    border: '1px solid var(--bg-input-border)', borderRadius: '8px',
    background: 'var(--bg-input)', color: 'var(--text-primary)',
    fontSize: '0.875rem', outline: 'none', cursor: 'pointer', minWidth: '145px',
  } as React.CSSProperties,
  resetBtn: {
    padding: '8px 14px',
    border: '1px solid var(--bg-card-border)', borderRadius: '8px',
    background: 'transparent', color: 'var(--text-secondary)',
    fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' as const,
    transition: '120ms ease',
  },
  pageBtn: {
    padding: '6px 14px',
    border: '1px solid var(--bg-card-border)', borderRadius: '6px',
    background: 'transparent', color: 'var(--text-primary)',
    fontSize: '0.78rem', transition: '80ms ease',
  } as React.CSSProperties,
  actionBtn: {
    width: '30px', height: '30px', borderRadius: '6px',
    border: '1px solid var(--bg-card-border)', background: 'transparent',
    color: 'var(--text-secondary)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: '100ms ease',
  } as React.CSSProperties,
} as const;
