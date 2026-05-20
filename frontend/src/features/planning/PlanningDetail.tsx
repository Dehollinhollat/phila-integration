// src/features/planning/PlanningDetail.tsx
// Vue détail d'un planning dominical.
// 4 sections de rôle avec slots fixes (identification×4, service_salle×2, preparation_salle×2, priere×1).
// Les admins peuvent assigner/retirer des ouvriers ; les ouvriers voient leur statut.
// Export PDF via jsPDF + jspdf-autotable : header logo+titre+date, 4 sections, footer.

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '../../assets/images/LOGO-PHILA-BLEU.png';
import { planningEndpoints, affectationsEndpoints, ouvriersEndpoints } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import { ROLE_RANK } from '../../utils/constants';
import type { PlanningService, AffectationPlanning, RoleService, Ouvrier } from '../../types';

// ─── Configuration des rôles ─────────────────────────────────────────────────

// ─── Helpers PDF ─────────────────────────────────────────────────────────────

// Charge une image depuis son URL Vite et retourne un data URL base64.
// Utilise fetch + FileReader pour éviter les problèmes de taint canvas.
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

// Formate une chaîne YYYY-MM-DD en date longue locale sans décalage UTC.
function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ─── Configuration des rôles ─────────────────────────────────────────────────

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  accepte:    'Accepté',
  decline:    'Décliné',
};

const ROLE_CONFIG: Record<RoleService, { label: string; max: number; color: string }> = {
  identification_nm: { label: 'Identification NM',    max: 4, color: '#1A56B0' },
  service_salle:     { label: 'Service en salle',     max: 2, color: '#8B5CF6' },
  preparation_salle: { label: 'Préparation de salle', max: 2, color: '#10B981' },
  service_en_ligne:  { label: 'Service en ligne',     max: 1, color: '#EF4444' },
};

const STATUT_BADGE = {
  en_attente: { bg: '#fef3c7', color: '#b45309', label: 'En attente' },
  accepte:    { bg: '#dcfce7', color: '#15803d', label: 'Accepté' },
  decline:    { bg: '#fee2e2', color: '#dc2626', label: 'Décliné' },
} as const;

// ─── Composant ───────────────────────────────────────────────────────────────

export default function PlanningDetail() {
  const { id }   = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const canEdit   = user ? ROLE_RANK[user.role] >= ROLE_RANK['admin_campus'] : false;

  const [planning,        setPlanning]        = useState<PlanningService | null>(null);
  const [ouvriers,        setOuvriers]        = useState<Ouvrier[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [deleting,        setDeleting]        = useState<string | null>(null);
  const [addingRole,      setAddingRole]      = useState<RoleService | null>(null);
  const [selectedOuvrier, setSelectedOuvrier] = useState('');
  const [assignError,     setAssignError]     = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    planningEndpoints.get(id)
      .then(planRes => {
        const p = planRes.data;
        setPlanning(p);
        return ouvriersEndpoints.list({ campus: p.campus });
      })
      .then(ouvrierRes => setOuvriers(ouvrierRes.data.filter(o => o.statut)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleAddAffectation(role: RoleService) {
    if (!planning || !selectedOuvrier) return;
    setAssignError(null);
    setSaving(true);
    try {
      const res = await affectationsEndpoints.create({
        planning_id:  planning.id,
        ouvrier_id:   selectedOuvrier,
        role_service: role,
      });
      setPlanning(prev => prev
        ? { ...prev, affectations: [...(prev.affectations ?? []), res.data] }
        : prev
      );
      setAddingRole(null);
      setSelectedOuvrier('');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message ?? 'Erreur lors de l\'assignation';
      setAssignError(msg);
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAffectation(affId: string) {
    setDeleting(affId);
    try {
      await affectationsEndpoints.delete(affId);
      setPlanning(prev => prev
        ? { ...prev, affectations: (prev.affectations ?? []).filter(a => a.id !== affId) }
        : prev
      );
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(null);
    }
  }

  async function handleDeletePlanning() {
    if (!planning) return;
    if (!window.confirm('Supprimer ce planning ? Toutes les affectations seront supprimées.')) return;
    try {
      await planningEndpoints.delete(planning.id);
      navigate('/planning');
    } catch (err) {
      console.error(err);
    }
  }

  // ── Export PDF ────────────────────────────────────────────────────────────

  async function exportPDF() {
    if (!planning) return;

    const doc        = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const BLUE       = [26, 86, 176] as [number, number, number]; // #1A56B0
    const campusLabel = planning.campus === 'paris' ? 'Paris' : 'Paris Nord';
    const dateStr    = planning.date_dimanche.slice(0, 10);
    const dateLabel  = formatDateLong(dateStr);
    const pageW      = doc.internal.pageSize.getWidth();
    const pageH      = doc.internal.pageSize.getHeight();

    // ── Logo ────────────────────────────────────────────────────────────────
    try {
      const logoB64 = await getImageBase64(logoUrl);
      doc.addImage(logoB64, 'PNG', 14, 8, 16, 16);
    } catch { /* logo non disponible, on continue sans */ }

    // ── Titre ───────────────────────────────────────────────────────────────
    doc.setFontSize(18);
    doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.text('Planning de service', 36, 16);

    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text(`Campus ${campusLabel} · ${dateLabel}`, 36, 24);

    // ── Ligne de séparation ──────────────────────────────────────────────────
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 29, pageW - 14, 29);

    // ── Nouveaux membres ─────────────────────────────────────────────────────
    let startY = 36;
    if (planning.nouveaux_membres) {
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`Nouveaux membres accueillis : ${planning.nouveaux_membres}`, 14, startY);
      startY += 8;
    }

    // ── Sections de rôle ────────────────────────────────────────────────────
    for (const [roleKey, cfg] of Object.entries(ROLE_CONFIG) as [RoleService, { label: string; max: number; color: string }][]) {
      const affs = (planning.affectations ?? []).filter(
        (a: AffectationPlanning) => a.role_service === roleKey
      );

      const rows: string[][] = affs.length > 0
        ? affs.map((a: AffectationPlanning) => [
            `${a.ouvrier?.prenom ?? ''} ${a.ouvrier?.nom ?? ''}`.trim() || '-',
            STATUT_LABELS[a.statut] ?? a.statut,
          ])
        : [['Aucune personne assignée', '-']];

      autoTable(doc, {
        startY,
        head: [[
          { content: cfg.label, colSpan: 2, styles: { halign: 'left' } },
        ]],
        body: rows,
        headStyles:          { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
        bodyStyles:          { fontSize: 10, textColor: [30, 30, 30] },
        alternateRowStyles:  { fillColor: [248, 249, 250] },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 50, halign: 'center' },
        },
        margin: { left: 14, right: 14 },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      startY = (doc as any).lastAutoTable.finalY + 6;
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    const today = new Date().toLocaleDateString('fr-FR');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Généré le ${today} · Phila Cité des Adorateurs`, 14, pageH - 8);

    doc.save(`planning-${campusLabel.toLowerCase().replace(' ', '-')}-${dateStr}.pdf`);
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid var(--bg-card-border)', borderTopColor: 'var(--accent-teal)',
          animation: 'pd-spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes pd-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!planning) {
    return (
      <div style={{ padding: 32, color: 'var(--text-secondary)', fontSize: 14 }}>
        Planning introuvable.
      </div>
    );
  }

  // Groupes d'affectations par rôle
  const affsByRole = new Map<RoleService, AffectationPlanning[]>(
    (Object.keys(ROLE_CONFIG) as RoleService[]).map(k => [k, []])
  );
  for (const aff of planning.affectations ?? []) {
    affsByRole.get(aff.role_service)?.push(aff);
  }

  // Un planning est verrouillé si sa date est passée de plus de 3 jours
  const estVerrouille = new Date(planning.date_dimanche) < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const peutModifier  = canEdit && !estVerrouille;

  // Tous les ouvriers actifs sont proposés — la même personne peut être sur plusieurs rôles
  const availableOuvriers = ouvriers;

  const dateLabel = new Date(planning.date_dimanche).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div style={{ padding: '24px 32px', maxWidth: 760, margin: '0 auto' }}>

      {/* Retour */}
      <button
        onClick={() => navigate('/planning')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--accent-teal)', fontSize: 14, marginBottom: 20,
          padding: 0, display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        ← Retour au planning
      </button>

      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{
            fontSize: 20, fontWeight: 700, color: 'var(--text-primary)',
            margin: '0 0 8px', textTransform: 'capitalize',
          }}>
            {dateLabel}
          </h1>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: 'var(--badge-presentiel-bg)', color: 'var(--badge-presentiel-text)',
            }}>
              {planning.campus === 'paris' ? 'Paris' : 'Paris Nord'}
            </span>
            {estVerrouille && (
              <span style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: 'var(--bg-secondary)', color: 'var(--text-tertiary)',
              }}>
                Archivé
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => void exportPDF()}
            style={{
              padding: '7px 14px', borderRadius: 6,
              border: '1px solid #1A56B0',
              background: 'transparent', color: '#1A56B0',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            📄 Exporter PDF
          </button>
          {peutModifier && (
            <button
              onClick={handleDeletePlanning}
              style={{
                padding: '7px 14px', borderRadius: 6,
                border: '1px solid #fca5a5',
                background: 'transparent', color: '#dc2626',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Supprimer
            </button>
          )}
        </div>
      </div>


      {/* Sections de rôle */}
      {(Object.entries(ROLE_CONFIG) as [RoleService, { label: string; max: number; color: string }][]).map(([roleKey, cfg]) => {
        const affs     = affsByRole.get(roleKey) ?? [];
        const isFull   = affs.length >= cfg.max;
        const isAdding = addingRole === roleKey;

        return (
          <div key={roleKey} style={{
            background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
            borderRadius: 8, padding: 20, marginBottom: 16,
            borderLeft: `4px solid ${cfg.color}`,
          }}>
            {/* En-tête du rôle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: affs.length > 0 || isAdding ? 14 : 4 }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 600, color: cfg.color }}>
                  {cfg.label}
                </span>
                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  {affs.length} / {cfg.max}
                </span>
              </div>
              {peutModifier && !isFull && !isAdding && (
                <button
                  onClick={() => { setAddingRole(roleKey); setSelectedOuvrier(''); setAssignError(null); }}
                  style={{
                    padding: '5px 12px', borderRadius: 6,
                    border: `1px solid ${cfg.color}`,
                    background: 'transparent', color: cfg.color,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  + Ajouter
                </button>
              )}
            </div>

            {/* Liste des assignés */}
            {affs.length === 0 && !isAdding ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                Aucune personne assignée
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {affs.map(aff => {
                  const badge = STATUT_BADGE[aff.statut] ?? STATUT_BADGE.en_attente;
                  return (
                    <div key={aff.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '9px 12px', borderRadius: 6,
                      background: 'var(--surface-hover)', border: '1px solid var(--bg-card-border)',
                    }}>
                      <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                        {aff.ouvrier?.prenom} {aff.ouvrier?.nom}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: badge.bg, color: badge.color,
                        }}>
                          {badge.label}
                        </span>
                        {peutModifier && (
                          <button
                            onClick={() => handleDeleteAffectation(aff.id)}
                            disabled={deleting === aff.id}
                            title="Retirer"
                            style={{
                              width: 24, height: 24, borderRadius: 4, border: 'none',
                              background: 'transparent', color: '#9ca3af',
                              cursor: 'pointer', fontSize: 16, lineHeight: 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Formulaire d'ajout inline */}
            {isAdding && peutModifier && (
              <div style={{ marginTop: affs.length > 0 ? 10 : 0 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={selectedOuvrier}
                    onChange={e => setSelectedOuvrier(e.target.value)}
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: 6,
                      border: '1px solid var(--bg-card-border)',
                      background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13,
                    }}
                  >
                    <option value="">- Choisir un ouvrier -</option>
                    {availableOuvriers.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.prenom} {o.nom}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => void handleAddAffectation(roleKey)}
                    disabled={!selectedOuvrier || saving}
                    style={{
                      padding: '8px 16px', borderRadius: 6, border: 'none',
                      background: cfg.color, color: '#fff',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      opacity: !selectedOuvrier || saving ? 0.6 : 1,
                    }}
                  >
                    {saving ? '…' : 'Assigner'}
                  </button>
                  <button
                    onClick={() => { setAddingRole(null); setAssignError(null); }}
                    style={{
                      padding: '8px 12px', borderRadius: 6,
                      border: '1px solid var(--bg-card-border)', background: 'transparent',
                      color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13,
                    }}
                  >
                    Annuler
                  </button>
                </div>
                {assignError && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#dc2626' }}>
                    {assignError}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
