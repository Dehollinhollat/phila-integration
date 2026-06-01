// src/features/planning/PlanningTable.tsx
// Vue principale du planning : génère tous les dimanches sur un horizon de ±3 mois,
// fusionne avec les plannings existants chargés depuis l'API.
//
// Corrections appliquées :
// - toKey utilise les composants locaux (getFullYear/Month/Date) au lieu de
//   toISOString() qui retourne UTC et décale d'un jour pour les fuseaux UTC+.
// - handleCreate met à jour l'état local au lieu de naviguer immédiatement.
// - Les erreurs API sont maintenant loguées dans la console.
// Export PDF : tous les plannings créés, une page par dimanche (jsPDF + autoTable).

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '../../assets/images/LOGO-PHILA-BLEU.png';
import { planningEndpoints } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import { ROLE_RANK } from '../../utils/constants';
import { HelpButton } from '../../components/common/HelpButton';

const HELP_PLANNING = [
  { titre: 'Créer un planning', description: 'Cliquez sur + Nouveau planning pour créer le planning du prochain dimanche.', emoji: '📅' },
  { titre: 'Assigner des rôles', description: 'Pour chaque planning, assignez les membres aux rôles : Identification NM, Service Salle, Préparation Salle, Service en Ligne.', emoji: '👥' },
  { titre: 'Confirmer sa présence', description: 'Les membres assignés peuvent confirmer ou décliner leur présence depuis leur tableau de bord.', emoji: '✅' },
];
import type { PlanningService, Campus, RoleService } from '../../types';

// ─── Helpers PDF ─────────────────────────────────────────────────────────────

async function getImageBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob     = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror  = reject;
    reader.readAsDataURL(blob);
  });
}

const ROLES_PDF: { key: RoleService; label: string }[] = [
  { key: 'identification_nm', label: 'Identification NM' },
  { key: 'service_salle',     label: 'Service en salle' },
  { key: 'preparation_salle', label: 'Préparation salle' },
  { key: 'service_en_ligne',  label: 'Service en ligne' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateSundays(): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Dernier dimanche passé (ou aujourd'hui si on est dimanche)
  const anchor = new Date(today);
  anchor.setDate(today.getDate() - today.getDay());

  const start = new Date(anchor);
  start.setDate(anchor.getDate() - 8 * 7); // 8 semaines en arrière

  const end = new Date(anchor);
  end.setDate(anchor.getDate() + 12 * 7); // 12 semaines en avant

  const sundays: Date[] = [];
  const curr = new Date(start);
  while (curr <= end) {
    sundays.push(new Date(curr));
    curr.setDate(curr.getDate() + 7);
  }
  // Ordre croissant : le dimanche le plus proche en premier
  return sundays;
}

// Construit la clé YYYY-MM-DD à partir des composants locaux de la date.
// N'utilise PAS toISOString() qui convertirait en UTC et décalerait d'un jour
// pour les fuseaux est de UTC (ex. Paris UTC+2 à minuit local = veille en UTC).
function toKey(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ─── Types locaux ─────────────────────────────────────────────────────────────

type AffRow = {
  role_service: RoleService;
  ouvrier?: { prenom: string; nom: string } | null;
};

function getRoleCounts(p: PlanningService) {
  const aff = (p.affectations ?? []) as AffRow[];
  return {
    identification_nm: aff.filter(a => a.role_service === 'identification_nm').length,
    service_salle:     aff.filter(a => a.role_service === 'service_salle').length,
    preparation:       aff.filter(a => a.role_service === 'preparation_salle').length,
    service_en_ligne:  aff.find(a => a.role_service === 'service_en_ligne'),
  };
}

function isComplete(p: PlanningService): boolean {
  const c = getRoleCounts(p);
  return c.identification_nm >= 1 && c.service_salle >= 1 && c.preparation >= 1 && !!c.service_en_ligne;
}

// ─── Composant ───────────────────────────────────────────────────────────────

const COL = '2fr 80px 100px 110px 140px 100px 90px';

export default function PlanningTable() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const isSuperAdmin = user?.role === 'super_admin';
  const canCreate    = user ? ROLE_RANK[user.role] >= ROLE_RANK['admin_campus'] : false;

  const [campus,    setCampus]    = useState<Campus>(user?.campus[0] ?? 'paris');
  const [plannings, setPlannings] = useState<PlanningService[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [creating,  setCreating]  = useState<string | null>(null);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [showPast,  setShowPast]  = useState(false);
  const [isMobile,  setIsMobile]  = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const allSundays = generateSundays();
  const todayKey   = toKey(new Date());
  // Par défaut : uniquement aujourd'hui et le futur — les passés sont masqués
  const sundays = showPast ? allSundays : allSundays.filter(s => toKey(s) >= todayKey);

  useEffect(() => {
    setLoading(true);
    planningEndpoints.list({ campus })
      .then(r => setPlannings(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [campus]);

  // Map dateKey → PlanningService (clés locales des deux côtés)
  const planningMap = new Map<string, PlanningService>(
    plannings.map(p => [toKey(new Date(p.date_dimanche)), p])
  );

  // ── Export PDF de tous les plannings créés (une page par dimanche) ─────────
  async function exportAllPDF() {
    const existing = sundays
      .map(s => planningMap.get(toKey(s)))
      .filter((p): p is PlanningService => !!p);

    if (existing.length === 0) {
      alert('Aucun planning créé pour cette période.');
      return;
    }

    const doc         = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const BLUE        = [26, 86, 176] as [number, number, number];
    const campusLabel = campus === 'paris' ? 'Paris' : 'Paris Nord';
    const pageW       = doc.internal.pageSize.getWidth();
    const pageH       = doc.internal.pageSize.getHeight();
    const today       = new Date().toLocaleDateString('fr-FR');

    let logoB64: string | null = null;
    try { logoB64 = await getImageBase64(logoUrl); } catch { /* sans logo */ }

    existing.forEach((planning, idx) => {
      if (idx > 0) doc.addPage();

      const dateStr   = planning.date_dimanche.slice(0, 10);
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateLabel = new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });

      // Logo
      if (logoB64) doc.addImage(logoB64, 'PNG', 14, 8, 16, 16);

      // Titre
      doc.setFontSize(18);
      doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
      doc.text('Planning de service', 36, 16);

      doc.setFontSize(11);
      doc.setTextColor(50, 50, 50);
      doc.text(`Campus ${campusLabel} · ${dateLabel}`, 36, 24);

      doc.setDrawColor(200, 200, 200);
      doc.line(14, 29, pageW - 14, 29);

      let startY = 36;

      // 4 sections
      for (const role of ROLES_PDF) {
        type AffWithOuvrier = {
          role_service: RoleService;
          ouvrier?: { prenom: string; nom: string } | null;
        };
        const affs = ((planning.affectations ?? []) as AffWithOuvrier[]).filter(
          a => a.role_service === role.key
        );
        const rows = affs.length > 0
          ? affs.map(a => [`${a.ouvrier?.prenom ?? ''} ${a.ouvrier?.nom ?? ''}`.trim() || '-'])
          : [['Aucune personne assignée']];

        autoTable(doc, {
          startY,
          head: [[{ content: role.label, styles: { halign: 'left' } }]],
          body: rows,
          headStyles:         { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
          bodyStyles:         { fontSize: 10, textColor: [30, 30, 30] },
          alternateRowStyles: { fillColor: [248, 249, 250] },
          margin:             { left: 14, right: 14 },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        startY = (doc as any).lastAutoTable.finalY + 5;
      }

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Généré le ${today} · Phila Cité des Adorateurs`, 14, pageH - 8);
    });

    doc.save(`planning-${campusLabel.toLowerCase().replace(' ', '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  async function handleCreate(sunday: Date) {
    const key = toKey(sunday);
    console.log('[Planning] handleCreate → date_dimanche:', key, 'campus:', campus);
    setCreating(key);
    setCreateErr(null);
    try {
      const r = await planningEndpoints.create({ date_dimanche: key, campus });
      console.log('[Planning] planning créé :', r.data);
      // Met à jour la liste locale pour afficher le bouton "Voir" immédiatement
      setPlannings(prev => [...prev, r.data]);
    } catch (err) {
      console.error('[Planning] erreur création :', err);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCreateErr(msg ?? 'Erreur lors de la création');
    } finally {
      setCreating(null);
    }
  }

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px) clamp(12px, 3vw, 32px)', maxWidth: 1060, margin: '0 auto' }}>

      {/* En-tête */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>
            Planning de service
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>
            Organisation dominicale des équipes d'intégration
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <HelpButton titre="Aide Planning" steps={HELP_PLANNING} />
          <button
            onClick={() => setShowPast(p => !p)}
            style={{
              padding: '8px 14px', borderRadius: 6,
              border: '1px solid var(--bg-card-border)',
              background: showPast ? 'var(--bg-secondary)' : 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {showPast ? 'Masquer les passés' : 'Afficher les passés'}
          </button>
          <button
            onClick={() => void exportAllPDF()}
            style={{
              padding: '8px 14px', borderRadius: 6,
              border: '1px solid #1A56B0',
              background: 'transparent', color: '#1A56B0',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Exporter PDF
          </button>

          {isSuperAdmin && (
            <select
              value={campus}
              onChange={e => setCampus(e.target.value as Campus)}
              style={{
                padding: '8px 12px', borderRadius: 6,
                border: '1px solid var(--bg-card-border)',
                background: 'var(--bg-card)', color: 'var(--text-primary)',
                fontSize: 14, cursor: 'pointer',
              }}
            >
              <option value="paris">Paris</option>
              <option value="paris_nord">Paris Nord</option>
            </select>
          )}
        </div>
      </div>

      {createErr && (
        <div style={{
          marginBottom: 16, padding: '10px 14px',
          background: '#fee2e2', borderRadius: 8,
          fontSize: 13, color: '#b91c1c',
        }}>
          {createErr}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: '3px solid var(--bg-card-border)', borderTopColor: 'var(--accent-teal)',
            animation: 'plan-spin 0.7s linear infinite',
          }} />
          <style>{`@keyframes plan-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : isMobile ? (
        /* ── Vue cards mobile ─────────────────────────────────────────────── */
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--bg-card-border)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          {sundays.map(sunday => {
            const key    = toKey(sunday);
            const p      = planningMap.get(key);
            const isToday = key === todayKey;
            const isPast  = key < todayKey;
            const counts  = p ? getRoleCounts(p) : null;
            const complete = p ? isComplete(p) : false;
            return (
              <div key={key} style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--bg-card-border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                background: isToday ? 'rgba(12,94,107,0.04)' : undefined,
                opacity: isPast && !p ? 0.5 : 1,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontWeight: p ? 600 : 400, fontSize: 14,
                    color: isToday ? 'var(--accent-teal)' : p ? 'var(--text-primary)' : 'var(--text-secondary)',
                    textTransform: 'capitalize',
                  }}>
                    {fmtDate(sunday)}
                    {isToday && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--accent-teal)' }}>● Aujourd'hui</span>}
                  </div>
                  {p && counts && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>ID {counts.identification_nm} · Salle {counts.service_salle} · Prép {counts.preparation}</span>
                      <span style={{
                        padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                        background: complete ? '#dcfce7' : '#fef3c7',
                        color: complete ? '#15803d' : '#b45309',
                      }}>
                        {complete ? 'Complet' : 'Incomplet'}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ flexShrink: 0 }}>
                  {p ? (
                    <button onClick={() => navigate(`/planning/${p.id}`)} style={btnVoir}>Voir →</button>
                  ) : canCreate ? (
                    <button onClick={() => void handleCreate(sunday)} disabled={creating === key} style={btnCreer}>
                      {creating === key ? '…' : '+ Créer'}
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>-</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Vue tableau desktop ──────────────────────────────────────────── */
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', display: 'block' }}>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--bg-card-border)',
          borderRadius: 10, overflow: 'hidden',
          minWidth: 520,
        }}>
          {/* En-tête tableau */}
          <div style={{
            display: 'grid', gridTemplateColumns: COL,
            padding: '10px 16px',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--bg-card-border)',
            fontSize: 11, fontWeight: 700,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            alignItems: 'center', gap: 8,
          }}>
            <span>Date</span>
            <span style={{ textAlign: 'center' }}>ID NM</span>
            <span style={{ textAlign: 'center' }}>Salle</span>
            <span style={{ textAlign: 'center' }}>Préparation</span>
            <span>Service en ligne</span>
            <span style={{ textAlign: 'center' }}>Statut</span>
            <span style={{ textAlign: 'center' }}>Actions</span>
          </div>

          {/* Lignes */}
          {sundays.map(sunday => {
            const key     = toKey(sunday);
            const p       = planningMap.get(key);
            const isToday = key === todayKey;
            const isPast  = key < todayKey;
            const counts  = p ? getRoleCounts(p) : null;
            const complete = p ? isComplete(p) : false;

            return (
              <div key={key} style={{
                display: 'grid', gridTemplateColumns: COL,
                padding: '11px 16px',
                borderBottom: '1px solid var(--bg-card-border)',
                background: isToday ? 'rgba(12,94,107,0.04)' : undefined,
                opacity: isPast && !p ? 0.5 : 1,
                alignItems: 'center', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{
                    fontSize: 13, fontWeight: p ? 500 : 400,
                    color: isToday ? 'var(--accent-teal)' : p ? 'var(--text-primary)' : 'var(--text-secondary)',
                    textTransform: 'capitalize',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {fmtDate(sunday)}
                  </span>
                  {isToday && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-teal)', flexShrink: 0 }}>● Aujourd'hui</span>}
                </div>
                <span style={{ textAlign: 'center', fontSize: 13, color: counts?.identification_nm ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {counts ? (counts.identification_nm > 0 ? counts.identification_nm : '-') : '-'}
                </span>
                <span style={{ textAlign: 'center', fontSize: 13, color: counts?.service_salle ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {counts ? (counts.service_salle > 0 ? counts.service_salle : '-') : '-'}
                </span>
                <span style={{ textAlign: 'center', fontSize: 13, color: counts?.preparation ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {counts ? (counts.preparation > 0 ? counts.preparation : '-') : '-'}
                </span>
                <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: counts?.service_en_ligne ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {counts?.service_en_ligne?.ouvrier
                    ? `${counts.service_en_ligne.ouvrier.prenom} ${counts.service_en_ligne.ouvrier.nom}`
                    : '-'}
                </span>
                <div style={{ textAlign: 'center' }}>
                  {p ? (
                    <span style={{
                      display: 'inline-block', padding: '3px 9px', borderRadius: 20,
                      fontSize: 11, fontWeight: 600,
                      background: complete ? '#dcfce7' : '#fef3c7',
                      color: complete ? '#15803d' : '#b45309',
                    }}>
                      {complete ? 'Complet' : 'Incomplet'}
                    </span>
                  ) : (
                    <span style={{
                      display: 'inline-block', padding: '3px 9px', borderRadius: 20,
                      fontSize: 11, fontWeight: 600,
                      background: 'var(--bg-secondary)', color: 'var(--text-tertiary)',
                    }}>
                      Non créé
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'center' }}>
                  {p ? (
                    <button onClick={() => navigate(`/planning/${p.id}`)} style={btnVoir}>Voir →</button>
                  ) : canCreate ? (
                    <button onClick={() => void handleCreate(sunday)} disabled={creating === key} style={btnCreer}>
                      {creating === key ? '…' : '+ Créer'}
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>-</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles boutons ──────────────────────────────────────────────────────────

const btnVoir: React.CSSProperties = {
  padding:      '4px 12px',
  background:   'var(--bg-secondary)',
  border:       '1px solid var(--bg-card-border)',
  borderRadius: 6,
  fontSize:     12,
  fontWeight:   600,
  color:        'var(--accent-teal)',
  cursor:       'pointer',
  fontFamily:   'inherit',
  whiteSpace:   'nowrap',
};

const btnCreer: React.CSSProperties = {
  padding:      '4px 10px',
  background:   'transparent',
  border:       '1px dashed var(--accent-teal)',
  borderRadius: 6,
  fontSize:     12,
  fontWeight:   600,
  color:        'var(--accent-teal)',
  cursor:       'pointer',
  fontFamily:   'inherit',
  whiteSpace:   'nowrap',
};
