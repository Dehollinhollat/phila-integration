// src/features/ouvriers/OuvrierList.tsx
// Page liste des ouvriers avec statistiques, recherche, filtres et actions.
//
// Stats (calculées sur les données chargées) :
//   - Total ouvriers actifs, répartition par campus, répartition par service
//
// Filtres cumulables : recherche textuelle, campus, statut (actif/inactif), service
// Actions par ligne : modifier (→ /ouvriers/:id/edit) + toggle actif/inactif
// Badge Type : Promu (vient d'un contact) / Direct (inscription_directe)

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ouvriersEndpoints } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import { ROLE_RANK } from '../../utils/constants';
import type { Ouvrier } from '../../types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const SERVICES_LIST = [
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

const SERVICE_LABELS: Record<string, string> = Object.fromEntries(
  SERVICES_LIST.map(s => [s.value, s.label])
);

const CAMPUS_LABELS: Record<string, string> = { paris: 'Paris', paris_nord: 'Paris Nord' };

// ─── Badges ───────────────────────────────────────────────────────────────────

function BadgeActif({ actif }: { actif: boolean }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 12,
      fontSize: 11, fontWeight: 700,
      background: actif ? 'var(--badge-nouveau-bg)' : 'var(--badge-inactif-bg)',
      color:      actif ? 'var(--badge-nouveau-text)' : 'var(--badge-inactif-text)',
    }}>
      {actif ? 'Actif' : 'Inactif'}
    </span>
  );
}

function BadgeType({ direct }: { direct: boolean }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 12,
      fontSize: 11, fontWeight: 700,
      background: direct ? 'var(--badge-contacte-bg)' : 'var(--badge-integre-bg)',
      color:      direct ? 'var(--badge-contacte-text)' : 'var(--badge-integre-text)',
    }}>
      {direct ? 'Direct' : 'Promu'}
    </span>
  );
}

function ServicePill({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 12,
      fontSize: 11, fontWeight: 600,
      background: 'var(--accent-teal-light, rgba(12,94,107,0.1))',
      color: 'var(--accent-teal)',
      marginRight: 4, marginBottom: 4,
    }}>
      {label}
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ prenom, nom, actif }: { prenom: string; nom: string; actif: boolean }) {
  const initials = `${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase();
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8,
      background: actif ? 'var(--accent-teal)' : 'var(--text-tertiary)',
      color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ value, label, color = 'var(--accent-teal)' }: { value: string | number; label: string; color?: string }) {
  return (
    <div style={{
      flex: 1, padding: '16px 20px', borderRadius: 10,
      background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function OuvrierList() {
  const navigate       = useNavigate();
  const { user }       = useAuth();
  const canEdit        = user ? ROLE_RANK[user.role] >= ROLE_RANK['admin_campus'] : false;

  const [ouvriers, setOuvriers]   = useState<Ouvrier[]>([]);
  const [loading, setLoading]     = useState(true);
  const [toggling, setToggling]   = useState<string | null>(null);

  // Filtres
  const [search,  setSearch]  = useState('');
  const [campus,  setCampus]  = useState('');
  const [statut,  setStatut]  = useState('');
  const [service, setService] = useState('');

  // ── Chargement ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: { campus?: string; statut?: string; service?: string; search?: string } = {};
      if (campus)  params.campus  = campus;
      if (statut)  params.statut  = statut;
      if (service) params.service = service;
      if (search)  params.search  = search;
      const { data } = await ouvriersEndpoints.list(params);
      setOuvriers(data);
    } catch { /* silencieux */ }
    finally  { setLoading(false); }
  }, [campus, statut, service, search]);

  useEffect(() => { load(); }, [load]);

  // ── Toggle statut actif/inactif ──────────────────────────────────────────
  async function handleToggle(o: Ouvrier) {
    setToggling(o.id);
    try {
      const { data } = await ouvriersEndpoints.toggleStatut(o.id, !o.statut);
      setOuvriers(prev => prev.map(x => x.id === data.id ? data : x));
    } catch { /* silencieux */ }
    finally  { setToggling(null); }
  }

  // ── Stats calculées depuis les données ───────────────────────────────────
  const actifs       = ouvriers.filter(o => o.statut);
  const totalActifs  = actifs.length;
  const campusParis  = actifs.filter(o => o.campus === 'paris').length;
  const campusNord   = actifs.filter(o => o.campus === 'paris_nord').length;

  // Service le plus représenté
  const serviceCount: Record<string, number> = {};
  actifs.forEach(o => o.services.forEach(s => { serviceCount[s] = (serviceCount[s] ?? 0) + 1; }));
  const topService = Object.entries(serviceCount).sort(([, a], [, b]) => b - a)[0];

  function formatDate(d: string | Date | null | undefined): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('fr-FR');
  }

  const selectStyle: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 6,
    border: '1px solid var(--bg-card-border)',
    background: 'var(--bg-card)', color: 'var(--text-primary)',
    fontFamily: 'inherit', fontSize: 16, cursor: 'pointer',
  };

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px) clamp(12px, 3vw, 32px)', fontFamily: 'inherit' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Ouvriers
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {ouvriers.length} ouvrier{ouvriers.length !== 1 ? 's' : ''} au total
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => navigate('/ouvriers/new')}
            style={{
              padding: '9px 18px', borderRadius: 8,
              background: 'var(--accent-teal)', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600,
            }}
          >
            + Nouvel ouvrier
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiCard value={totalActifs}  label="Ouvriers actifs" />
        <KpiCard value={campusParis}  label="Paris" />
        <KpiCard value={campusNord}   label="Paris Nord" />
        {topService && (
          <KpiCard
            value={SERVICE_LABELS[topService[0]] ?? topService[0]}
            label={`Service le + représenté (${topService[1]})`}
            color="var(--accent-gold)"
          />
        )}
      </div>

      {/* Filtres */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
        marginBottom: 20, padding: '14px 16px',
        background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)', borderRadius: 10,
      }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou téléphone…"
          style={{
            ...selectStyle,
            flex: '1 1 200px', minWidth: 180,
          }}
        />
        <select value={campus} onChange={e => setCampus(e.target.value)} style={selectStyle}>
          <option value="">Tous les campus</option>
          <option value="paris">Paris</option>
          <option value="paris_nord">Paris Nord</option>
        </select>
        <select value={statut} onChange={e => setStatut(e.target.value)} style={selectStyle}>
          <option value="">Actifs et inactifs</option>
          <option value="true">Actifs uniquement</option>
          <option value="false">Inactifs uniquement</option>
        </select>
        <select value={service} onChange={e => setService(e.target.value)} style={selectStyle}>
          <option value="">Tous les services</option>
          {SERVICES_LIST.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {(search || campus || statut || service) && (
          <button
            onClick={() => { setSearch(''); setCampus(''); setStatut(''); setService(''); }}
            style={{
              padding: '7px 14px', borderRadius: 6,
              background: 'none', border: '1px solid var(--bg-card-border)',
              color: 'var(--text-secondary)', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.8rem',
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
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>⏳</div>
            Chargement…
          </div>
        ) : ouvriers.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>⛪</div>
            Aucun ouvrier trouvé
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                {['', 'Nom', 'Téléphone', 'Campus', 'Services', 'Depuis', 'Statut', 'Type', ''].map((col, i) => (
                  <th key={i} style={{
                    padding: '10px 14px', textAlign: 'left',
                    fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    borderBottom: '1px solid var(--bg-card-border)',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ouvriers.map(o => (
                <tr
                  key={o.id}
                  style={{ borderBottom: '1px solid var(--bg-card-border)', transition: '80ms' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  {/* Avatar */}
                  <td style={{ padding: '11px 14px 11px 16px', width: 48 }}>
                    <Avatar prenom={o.prenom} nom={o.nom} actif={o.statut} />
                  </td>

                  {/* Nom */}
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                    {o.prenom} {o.nom}
                  </td>

                  {/* Téléphone */}
                  <td style={{ padding: '11px 14px', color: 'var(--text-secondary)', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                    {o.telephone}
                  </td>

                  {/* Campus */}
                  <td style={{ padding: '11px 14px', color: 'var(--text-secondary)', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                    {CAMPUS_LABELS[o.campus] ?? o.campus}
                  </td>

                  {/* Services */}
                  <td style={{ padding: '11px 14px', maxWidth: 220 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      {o.services.length > 0
                        ? o.services.map(s => (
                            <ServicePill key={s} label={SERVICE_LABELS[s] ?? s} />
                          ))
                        : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>-</span>
                      }
                    </div>
                  </td>

                  {/* Date début */}
                  <td style={{ padding: '11px 14px', color: 'var(--text-secondary)', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                    {formatDate(o.date_debut_service)}
                  </td>

                  {/* Statut */}
                  <td style={{ padding: '11px 14px' }}>
                    <BadgeActif actif={o.statut} />
                  </td>

                  {/* Type */}
                  <td style={{ padding: '11px 14px' }}>
                    <BadgeType direct={o.inscription_directe} />
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '11px 16px 11px 14px', whiteSpace: 'nowrap' }}>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          onClick={() => navigate(`/ouvriers/${o.id}/edit`)}
                          title="Modifier"
                          style={{
                            width: 28, height: 28, borderRadius: 6,
                            background: 'none', border: '1px solid var(--bg-card-border)',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14,
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleToggle(o)}
                          disabled={toggling === o.id}
                          title={o.statut ? 'Désactiver' : 'Réactiver'}
                          style={{
                            padding: '4px 10px', borderRadius: 6, border: 'none',
                            background: o.statut ? 'rgba(220,38,38,0.1)' : 'rgba(34,197,94,0.1)',
                            color: o.statut ? '#dc2626' : '#16a34a',
                            cursor: toggling === o.id ? 'not-allowed' : 'pointer',
                            fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
                            opacity: toggling === o.id ? 0.5 : 1,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {toggling === o.id ? '…' : o.statut ? 'Désactiver' : 'Activer'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
