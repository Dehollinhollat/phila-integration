// src/pages/StatistiquesAvancees.tsx
// Page de statistiques avancées -taux de conversion, temps d'intégration,
// performance des référents, évolution hebdomadaire, rapport email.
// Accessible depuis la sidebar aux rôles admin_campus et super_admin.

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { statsEndpoints } from '../services/endpoints';
import { HelpButton } from '../components/common/HelpButton';

const HELP_STATS = [
  { titre: 'Taux de conversion', description: "Pourcentage de contacts qui ont atteint le statut Intégré ou Ouvrier par rapport au total.", emoji: '📈' },
  { titre: "Temps d'intégration", description: "Durée moyenne entre la date d'inscription et le passage au statut Intégré.", emoji: '⏱' },
  { titre: 'Performance référents', description: 'Tableau comparatif des référents avec leur taux de conversion et nombre de contacts.', emoji: '🏆' },
  { titre: 'Rapport hebdomadaire', description: "Envoyez manuellement un rapport par email aux admins ou attendez l'envoi automatique chaque lundi à 8h.", emoji: '📧' },
];
import type {
  TauxConversionData,
  TempsIntegrationData,
  PerformanceReferentData,
  EvolutionHebdomadaireData,
} from '../types';

const CAMPUS_LABELS: Record<string, string> = {
  paris:      'Paris',
  paris_nord: 'Paris Nord',
};

const TOOLTIP_STYLE: React.CSSProperties = {
  background:   'var(--bg-card)',
  border:       '1px solid var(--border-color)',
  borderRadius: 8,
  color:        'var(--text-primary)',
  fontSize:     13,
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StatistiquesAvancees() {
  const [tauxData,      setTauxData]      = useState<TauxConversionData[]>([]);
  const [tempsData,     setTempsData]     = useState<TempsIntegrationData | null>(null);
  const [perfData,      setPerfData]      = useState<PerformanceReferentData[]>([]);
  const [evolutionData, setEvolutionData] = useState<EvolutionHebdomadaireData[]>([]);
  const [loading,        setLoading]       = useState(true);
  const [rapportLoading, setRapportLoading] = useState(false);
  const [rapportMsg,     setRapportMsg]     = useState('');
  const [rapportOk,      setRapportOk]      = useState(false);

  useEffect(() => {
    Promise.all([
      statsEndpoints.tauxConversion(),
      statsEndpoints.tempsIntegration(),
      statsEndpoints.performanceReferents(),
      statsEndpoints.evolutionHebdomadaire(),
    ])
      .then(([t, ti, perf, evol]) => {
        setTauxData(t.data);
        setTempsData(ti.data);
        setPerfData(perf.data);
        setEvolutionData(evol.data);
      })
      .catch(err => console.error('[StatistiquesAvancees]', err))
      .finally(() => setLoading(false));
  }, []);

  const handleRapport = async () => {
    setRapportLoading(true);
    setRapportMsg('');
    setRapportOk(false);
    try {
      const r = await statsEndpoints.rapportHebdomadaire();
      setRapportMsg(r.data.message);
      setRapportOk(true);
    } catch {
      setRapportMsg("Erreur lors de l'envoi du rapport.");
      setRapportOk(false);
    } finally {
      setRapportLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   32,
        flexWrap:       'wrap',
        gap:            12,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            Statistiques avancées
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            Analyse de la performance d'intégration
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <HelpButton titre="Aide Statistiques" steps={HELP_STATS} />
          {rapportMsg && (
            <span style={{
              fontSize:     13,
              color:        rapportOk ? 'var(--success, #10B981)' : 'var(--error, #EF4444)',
              background:   'var(--bg-card)',
              padding:      '6px 12px',
              borderRadius: 8,
              border:       '1px solid var(--border-color)',
            }}>
              {rapportMsg}
            </span>
          )}
          <button
            onClick={handleRapport}
            disabled={rapportLoading}
            style={{
              padding:    '10px 20px',
              background: 'var(--accent, #1A56B0)',
              color:      '#fff',
              border:     'none',
              borderRadius: 10,
              fontWeight: 600,
              fontSize:   14,
              cursor:     rapportLoading ? 'default' : 'pointer',
              opacity:    rapportLoading ? 0.7 : 1,
            }}
          >
            {rapportLoading ? 'Envoi...' : '📧 Envoyer le rapport'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '64px 0', fontSize: 15 }}>
          Chargement des statistiques…
        </div>
      ) : (
        <>
          {/* ── Taux de conversion par campus ────────────────────────────── */}
          <Section title="Taux de conversion par campus">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {tauxData.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Aucune donnée.</p>
              ) : tauxData.map(d => (
                <StatCard
                  key={d.campus}
                  label={CAMPUS_LABELS[d.campus] ?? d.campus}
                  value={`${d.taux}%`}
                  sub={`${d.integres} intégrés / ${d.total} total`}
                  color="var(--accent, #1A56B0)"
                />
              ))}
            </div>
          </Section>

          {/* ── Temps d'intégration ──────────────────────────────────────── */}
          {tempsData && (
            <Section title="Temps d'intégration (jours)">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
                <StatCard label="Moyenne"  value={`${tempsData.moyenne_jours}j`} color="#1A56B0" />
                <StatCard label="Médiane"  value={`${tempsData.median_jours}j`}  color="#8B5CF6" />
                <StatCard label="Minimum"  value={`${tempsData.min_jours}j`}     color="#10B981" />
                <StatCard label="Maximum"  value={`${tempsData.max_jours}j`}     color="#D4A24E" />
              </div>
            </Section>
          )}

          {/* ── Évolution hebdomadaire ───────────────────────────────────── */}
          <Section title="Évolution sur 12 semaines">
            {evolutionData.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Aucune donnée disponible.</p>
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={evolutionData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                    <XAxis
                      dataKey="semaine"
                      tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Bar dataKey="nouveaux" name="Nouveaux"  fill="#1A56B0" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="integres" name="Intégrés"  fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="messages" name="Messages"  fill="#D4A24E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          {/* ── Performance des référents ───────────────────────────────── */}
          <Section title="Performance des référents">
            {perfData.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Aucun référent avec des contacts assignés.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                      {['Référent', 'Total', 'Intégrés', 'Actifs', 'Taux', 'Temps moyen'].map(col => (
                        <th
                          key={col}
                          style={{
                            padding:       '10px 12px',
                            textAlign:     'left',
                            fontWeight:    600,
                            color:         'var(--text-secondary)',
                            fontSize:      12,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {perfData.map((r, i) => (
                      <tr
                        key={r.id}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          background:   i % 2 === 1 ? 'var(--bg-hover, rgba(0,0,0,0.02))' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {r.prenom} {r.nom}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{r.contacts_total}</td>
                        <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{r.contacts_integres}</td>
                        <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{r.contacts_actifs}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            background:   r.taux_conversion >= 50
                              ? 'rgba(16,185,129,0.12)'
                              : r.taux_conversion >= 25
                              ? 'rgba(212,162,78,0.15)'
                              : 'rgba(239,68,68,0.12)',
                            color:        r.taux_conversion >= 50
                              ? '#10B981'
                              : r.taux_conversion >= 25
                              ? '#D4A24E'
                              : '#EF4444',
                            padding:      '3px 10px',
                            borderRadius: 20,
                            fontWeight:   600,
                            fontSize:     13,
                          }}>
                            {r.taux_conversion}%
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                          {r.temps_moyen_jours > 0 ? `${r.temps_moyen_jours}j` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{
      background:   'var(--bg-card)',
      border:       '1px solid var(--border-color)',
      borderRadius: 16,
      padding:      24,
      marginBottom: 24,
    }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function StatCard({
  label, value, sub, color,
}: {
  label: string;
  value: string;
  sub?:  string;
  color: string;
}) {
  return (
    <div style={{
      background:   'var(--bg-primary)',
      border:       '1px solid var(--border-color)',
      borderRadius: 12,
      padding:      '20px 16px',
      textAlign:    'center',
    }}>
      <p style={{
        margin:        '0 0 4px',
        fontSize:      12,
        fontWeight:    600,
        color:         'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color }}>
        {value}
      </p>
      {sub && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
          {sub}
        </p>
      )}
    </div>
  );
}
