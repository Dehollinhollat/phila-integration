// src/pages/FeedbackResultats.tsx
// Résultats du questionnaire de satisfaction -admin_campus+.
// Nombre total, moyennes Q4/Q5, graphiques Recharts, commentaires Q12, export CSV.

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedbackStats {
  total: number;
  statistiques: {
    moyenne_q4: number | null;
    moyenne_q5: number | null;
    q1:  Record<string, number>;
    q2:  Record<string, number>;
    q3:  Record<string, number>;
    q4:  Record<string, number>;
    q5:  Record<string, number>;
    q6:  Record<string, number>;
    q7:  Record<string, number>;
    q8:  Record<string, number>;
    q9:  Record<string, number>;
    q10: Record<string, number>;
    q11: Record<string, number>;
  };
  commentaires: string[];
  feedbacks: { id: string; created_at: string; reponses: Record<string, unknown> }[];
}

// ─── Libellés lisibles ────────────────────────────────────────────────────────

const LABELS: Record<string, Record<string, string>> = {
  q1:  { nouveau_visiteur: 'Nouveau visiteur', membre_regulier: 'Membre régulier', ouvrier: 'Ouvrier/bénévole' },
  q2:  { premiere_fois: '1ère fois', quelques_fois: 'Quelques fois', irregulier: 'Irrégulier', presque_chaque_dim: 'Presque chaque dim.' },
  q3:  { proche: 'Proche/famille', reseaux: 'Réseaux sociaux', internet: 'Internet', affiches: 'Affiches', passais: 'Je passais devant', autre: 'Autre' },
  q6:  { louange: 'Louange', predication: 'Prédication', priere: 'Prière', annonces: 'Annonces', echanges: 'Échanges', ambiance: 'Ambiance', autre: 'Autre' },
  q7:  { accueil_nouveaux: 'Accueil NM', duree_culte: 'Durée culte', louange_duree: 'Durée louange', message: 'Message', echange: 'Échanges', communication: 'Communication', logistique: 'Logistique', satisfait: 'Satisfait', autre: 'Autre' },
  q8:  { moins_1h30: '< 1h30', '1h30_2h': '1h30-2h', '2h_2h30': '2h-2h30', plus_2h30: '> 2h30' },
  q9:  { oui_facilement: 'Oui, facilement', un_peu: 'Un peu', non_vraiment: 'Pas vraiment', reparti_direct: 'Reparti direct' },
  q10: { oui_certainement: 'Oui, certaint.', probablement: 'Probablement', ne_sais_pas: 'Ne sait pas', probablement_pas: 'Prob. pas' },
  q11: { oui_certainement: 'Oui, certaint.', probablement_oui: 'Prob. oui', ne_sais_pas: 'Ne sait pas', probablement_pas: 'Prob. pas' },
};

const TEAL   = '#0D9488';
const COLORS = ['#0D9488', '#1A56B0', '#F59E0B', '#EF4444', '#8B5CF6', '#10B981', '#F97316', '#06B6D4', '#EC4899'];

// ─── Composant graphique ──────────────────────────────────────────────────────

function QuestionChart({ title, data, qKey }: { title: string; data: Record<string, number>; qKey: string }) {
  const labels = LABELS[qKey] ?? {};
  const chartData = Object.entries(data)
    .map(([key, count]) => ({ name: labels[key] ?? key, count }))
    .sort((a, b) => b.count - a.count);

  if (chartData.length === 0) return null;

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)', borderRadius: 12, padding: 20 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 40, left: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} angle={-30} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
          <Tooltip formatter={(v) => {
            const num = typeof v === 'number' ? v : 0;
            return [`${num}`, 'Réponses'];
          }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

function exportCSV(feedbacks: FeedbackStats['feedbacks']) {
  const headers = ['id', 'created_at', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'q12'];
  const rows = feedbacks.map(f => {
    const r = f.reponses;
    return headers.map(h => {
      if (h === 'id')         return f.id;
      if (h === 'created_at') return new Date(f.created_at).toLocaleDateString('fr-FR');
      const v = r[h];
      return Array.isArray(v) ? `"${v.join(', ')}"` : `"${String(v ?? '')}"`;
    }).join(';');
  });
  const csv  = [headers.join(';'), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `feedback-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function FeedbackResultats() {
  const [data,    setData]    = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    api.get('/feedback')
      .then(r => setData(r.data as FeedbackStats))
      .catch(() => setError('Impossible de charger les résultats.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
      Chargement…
    </div>
  );
  if (error) return (
    <div style={{ padding: 40, color: '#EF4444', fontSize: 13 }}>{error}</div>
  );
  if (!data) return null;

  const { total, statistiques: s, commentaires, feedbacks } = data;

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px)', maxWidth: 900 }}>

      {/* Titre */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Satisfaction</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Résultats du questionnaire : {total} réponse{total > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => exportCSV(feedbacks)}
          disabled={total === 0}
          style={{ padding: '9px 18px', background: TEAL, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          ↓ Exporter CSV
        </button>
      </div>

      {total === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
          Aucune réponse pour l'instant.
        </div>
      )}

      {total > 0 && (
        <>
          {/* Moyennes étoiles Q4 et Q5 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
            {([
              { label: 'Expérience générale (Q4)', value: s.moyenne_q4 },
              { label: 'Accueil (Q5)',              value: s.moyenne_q5 },
            ] as { label: string; value: number | null }[]).map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)', borderRadius: 12, padding: '20px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: TEAL }}>{value !== null ? value.toFixed(1) : '—'}</div>
                <div style={{ fontSize: 20, color: '#F59E0B', margin: '4px 0 2px' }}>
                  {'★'.repeat(Math.round(value ?? 0))}{'☆'.repeat(5 - Math.round(value ?? 0))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Graphiques */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 28 }}>
            <QuestionChart title="Q1 -Profil dans l'assemblée"    data={s.q1}  qKey="q1" />
            <QuestionChart title="Q2 -Fréquence de venue"          data={s.q2}  qKey="q2" />
            <QuestionChart title="Q3 -Découverte (checkboxes)"     data={s.q3}  qKey="q3" />
            <QuestionChart title="Q4 -Évaluation générale (dist.)" data={s.q4}  qKey="q4" />
            <QuestionChart title="Q5 -Accueil (distribution)"      data={s.q5}  qKey="q5" />
            <QuestionChart title="Q6 -Éléments appréciés"          data={s.q6}  qKey="q6" />
            <QuestionChart title="Q7 -Axes d'amélioration"         data={s.q7}  qKey="q7" />
            <QuestionChart title="Q8 -Durée préférée"              data={s.q8}  qKey="q8" />
            <QuestionChart title="Q9 -Échanges après culte"        data={s.q9}  qKey="q9" />
            <QuestionChart title="Q10 -Intention de revenir"       data={s.q10} qKey="q10" />
            <QuestionChart title="Q11 -Recommandation"             data={s.q11} qKey="q11" />
          </div>

          {/* Commentaires Q12 */}
          {commentaires.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)', borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Q12 -Commentaires libres ({commentaires.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {commentaires.map((c, i) => (
                  <div key={i} style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, borderLeft: `3px solid ${TEAL}` }}>
                    {c}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
