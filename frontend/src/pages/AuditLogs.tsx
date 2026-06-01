// src/pages/AuditLogs.tsx
// Journal d'audit -super_admin uniquement.
// Tableau paginé (50/page) avec filtres action, période, auteur.
// Export CSV des entrées affichées.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id:          string;
  entite:      string;
  entite_id:   string;
  action:      string;
  description: string;
  auteur_id:   string;
  auteur: { id: string; prenom: string; nom: string; role: string };
  created_at:  string;
}

interface AuditResponse {
  logs:  AuditLogEntry[];
  total: number;
  page:  number;
  pages: number;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  LOGIN:                'Connexion',
  creation:             'Création',
  modification:         'Modification',
  suppression:          'Suppression',
  changement_statut:    'Changement statut',
  assignation_referent: 'Assignation référent',
  checklist_cochee:     'Checklist cochée',
};

const ACTION_BADGE: Record<string, { bg: string; color: string }> = {
  LOGIN:                { bg: '#eff6ff', color: '#1d4ed8' },
  creation:             { bg: '#dcfce7', color: '#15803d' },
  modification:         { bg: '#fef3c7', color: '#b45309' },
  suppression:          { bg: '#fee2e2', color: '#dc2626' },
  changement_statut:    { bg: '#dbeafe', color: '#1d4ed8' },
  assignation_referent: { bg: '#f3e8ff', color: '#7c3aed' },
  checklist_cochee:     { bg: '#ccfbf1', color: '#0f766e' },
};

// ─── Composant ────────────────────────────────────────────────────────────────

export default function AuditLogs() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  const [logs,    setLogs]    = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);

  const [action,     setAction]     = useState('');
  const [dateDebut,  setDateDebut]  = useState('');
  const [dateFin,    setDateFin]    = useState('');
  const [auteurText, setAuteurText] = useState('');

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p };
      if (action)    params.action     = action;
      if (dateDebut) params.date_debut = dateDebut;
      if (dateFin)   params.date_fin   = dateFin;
      const { data } = await api.get<AuditResponse>('/audit', { params });
      setLogs(data.logs);
      setTotal(data.total);
      setPage(data.page);
      setPages(data.pages);
    } catch { /* silencieux -le backend renvoie 403 si non super_admin */ }
    finally { setLoading(false); }
  }, [action, dateDebut, dateFin]);

  useEffect(() => {
    if (user?.role === 'super_admin') void load(1);
  }, [load, user]);

  // Guard rendu -après tous les hooks
  if (!user) return null;
  if (user.role !== 'super_admin') {
    navigate('/dashboard', { replace: true });
    return null;
  }

  // Filtre auteur côté client (le backend filtre par auteur_id, pas par nom)
  const displayed = auteurText
    ? logs.filter(l =>
        `${l.auteur.prenom} ${l.auteur.nom}`.toLowerCase().includes(auteurText.toLowerCase())
      )
    : logs;

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function handleExport() {
    const lignes = [
      ['Date', 'Action', 'Entité', 'Description', 'Auteur'],
      ...displayed.map(l => [
        fmtDate(l.created_at),
        ACTION_LABELS[l.action] ?? l.action,
        l.entite,
        l.description,
        `${l.auteur.prenom} ${l.auteur.nom}`,
      ]),
    ];
    const csv = lignes.map(r =>
      r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const hasFilter = action || dateDebut || dateFin || auteurText;

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px) clamp(12px, 3vw, 32px)', maxWidth: 1200, margin: '0 auto' }}>

      {/* Titre */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
            Journal d'audit
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            {total} action{total !== 1 ? 's' : ''} enregistrée{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={displayed.length === 0}
          style={{
            padding: '8px 16px', borderRadius: 8,
            background: displayed.length > 0 ? 'var(--accent-teal)' : 'var(--bg-secondary)',
            color: displayed.length > 0 ? '#fff' : 'var(--text-tertiary)',
            border: 'none', cursor: displayed.length > 0 ? 'pointer' : 'default',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          ↓ Exporter CSV
        </button>
      </div>

      {/* Filtres */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        marginBottom: 20, padding: '14px 16px',
        background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)', borderRadius: 10,
      }}>
        <select
          value={action}
          onChange={e => setAction(e.target.value)}
          style={selectStyle}
        >
          <option value="">Toutes les actions</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <input
          type="date"
          value={dateDebut}
          onChange={e => setDateDebut(e.target.value)}
          style={inputStyle}
          title="Depuis"
        />
        <input
          type="date"
          value={dateFin}
          onChange={e => setDateFin(e.target.value)}
          style={inputStyle}
          title="Jusqu'au"
        />

        <input
          type="text"
          value={auteurText}
          onChange={e => setAuteurText(e.target.value)}
          placeholder="Filtrer par auteur…"
          style={{ ...inputStyle, flex: '1 1 160px', minWidth: 140 }}
        />

        {hasFilter && (
          <button
            onClick={() => { setAction(''); setDateDebut(''); setDateFin(''); setAuteurText(''); }}
            style={{
              padding: '7px 14px', borderRadius: 6,
              background: 'none', border: '1px solid var(--bg-card-border)',
              color: 'var(--text-secondary)', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13,
            }}
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Tableau */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            Chargement…
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            Aucune action trouvée
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
            <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  {['Date', 'Action', 'Entité', 'Description', 'Auteur'].map(col => (
                    <th key={col} style={{
                      padding: '10px 14px', textAlign: 'left',
                      fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      borderBottom: '1px solid var(--bg-card-border)',
                      whiteSpace: 'nowrap',
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(log => {
                  const badge = ACTION_BADGE[log.action] ?? { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' };
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--bg-card-border)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {fmtDate(log.created_at)}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12,
                          fontSize: 11, fontWeight: 600,
                          background: badge.bg, color: badge.color,
                          whiteSpace: 'nowrap',
                        }}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {log.entite}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-primary)', maxWidth: 400 }}>
                        {log.description}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {log.auteur.prenom} {log.auteur.nom}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
          <button
            onClick={() => void load(page - 1)}
            disabled={page <= 1}
            style={{ ...btnPageStyle, opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'default' : 'pointer' }}
          >
            ← Précédent
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '0 8px' }}>
            Page {page} / {pages}
          </span>
          <button
            onClick={() => void load(page + 1)}
            disabled={page >= pages}
            style={{ ...btnPageStyle, opacity: page >= pages ? 0.4 : 1, cursor: page >= pages ? 'default' : 'pointer' }}
          >
            Suivant →
          </button>
        </div>
      )}

    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6,
  border: '1px solid var(--bg-card-border)',
  background: 'var(--bg-card)', color: 'var(--text-primary)',
  fontFamily: 'inherit', fontSize: 16, cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6,
  border: '1px solid var(--bg-card-border)',
  background: 'var(--bg-card)', color: 'var(--text-primary)',
  fontFamily: 'inherit', fontSize: 16,
};

const btnPageStyle: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 8,
  border: '1px solid var(--bg-card-border)', background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
};
