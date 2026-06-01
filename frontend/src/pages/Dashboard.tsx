// src/pages/Dashboard.tsx
// Tableau de bord principal - filtres campus/période, 6 KPIs, charge référents,
// statuts de suivi, tableau des derniers contacts.
//
// Toutes les couleurs passent par des CSS variables (thème light/dark).

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { contactsEndpoints, messagesEndpoints, statsEndpoints } from '../services/endpoints';
import api from '../services/api';
import { typography, spacing, radius, layout } from '../components/ui/tokens';
import { useCountUp } from '../hooks/useCountUp';
import {
  STATUT_LABELS, STATUT_COLORS, CAMPUS_LABELS, PROFIL_BADGE, PROFIL_LABELS, CANAL_BADGE,
} from '../utils/constants';
import type { ContactRow, Campus, InscriptionMoisData, ProfilData, StatutData, MessageSemaineData } from '../types';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
} from 'recharts';

// ─── Composants locaux ────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background:   'var(--bg-card)',
      border:       '1px solid var(--bg-card-border)',
      borderRadius: 'var(--border-radius-lg)',
      padding:      spacing[5],
      boxShadow:    'var(--shadow-card)',
      ...style,
    }}>
      {children}
    </div>
  );
}

function Badge({ bg, text, children }: { bg: string; text: string; children: React.ReactNode }) {
  return (
    <span style={{
      display:     'inline-flex',
      alignItems:  'center',
      padding:     `2px ${spacing[2]}`,
      borderRadius: radius.full,
      background:  bg,
      color:       text,
      fontSize:    typography.fontSize.xs,
      fontWeight:  typography.fontWeight.medium,
      whiteSpace:  'nowrap',
    }}>
      {children}
    </span>
  );
}

function FilterBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding:      `${spacing[1]} ${spacing[3]}`,
        borderRadius: 'var(--border-radius-sm)',
        border:       'none',
        background:   active ? 'var(--bg-card)' : 'transparent',
        color:        active ? 'var(--accent-teal)' : 'var(--text-secondary)',
        fontWeight:   active ? typography.fontWeight.semibold : typography.fontWeight.normal,
        fontSize:     typography.fontSize.sm,
        cursor:       'pointer',
        transition:   '120ms ease',
        boxShadow:    active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

// KPI simple - valeur + icône + label
// Count-up animé sur les valeurs numériques. Lift au survol via framer-motion.
function KpiSimple({
  label, value, icon, accentVar, sub, onClick,
}: {
  label: string; value: number | string; icon: string; accentVar: string;
  sub?: string; onClick?: () => void;
}) {
  const numericTarget = typeof value === 'number' ? value : 0;
  const animated      = useCountUp(numericTarget);
  const displayValue  = typeof value === 'number' ? animated : value;

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{
        background:   'var(--bg-card)',
        border:       '1px solid var(--bg-card-border)',
        borderRadius: 'var(--border-radius-lg)',
        padding:      spacing[5],
        boxShadow:    'var(--shadow-card)',
        cursor:       onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <div style={{ userSelect: 'none' }}>
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginBottom:   spacing[3],
        }}>
          <span style={{
            width:          '38px',
            height:         '38px',
            borderRadius:   'var(--border-radius-md)',
            background:     `color-mix(in srgb, var(${accentVar}) 12%, transparent)`,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       '18px',
          }}>
            {icon}
          </span>
          <span style={{
            fontSize:      typography.fontSize.xs,
            color:         'var(--kpi-label)',
            fontWeight:    typography.fontWeight.medium,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            textAlign:     'right',
            maxWidth:      '100px',
            lineHeight:    1.3,
          }}>
            {label}
          </span>
        </div>
        <div style={{
          fontSize:   typography.fontSize['3xl'],
          fontWeight: typography.fontWeight.bold,
          color:      `var(${accentVar})`,
          lineHeight: 1,
        }}>
          {displayValue}
        </div>
        {sub && (
          <div style={{ fontSize: typography.fontSize.xs, color: 'var(--text-tertiary)', marginTop: spacing[1] }}>
            {sub}
          </div>
        )}
      </div>
    </motion.div>
  );
}


// KPI alerte - sans référent
function KpiAlert({ value, label }: { value: number; label: string }) {
  const animated = useCountUp(value);
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{
        background:   'var(--bg-card-alert)',
        border:       '1px solid var(--bg-card-alert-border)',
        borderRadius: 'var(--border-radius-lg)',
        padding:      spacing[5],
        boxShadow:    'var(--shadow-card)',
      }}
    >
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   spacing[3],
      }}>
        <span style={{ fontSize: '18px' }}>⚠️</span>
        <span style={{
          fontSize:      typography.fontSize.xs,
          color:         'var(--accent-red)',
          fontWeight:    typography.fontWeight.medium,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          textAlign:     'right',
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize:   typography.fontSize['3xl'],
        fontWeight: typography.fontWeight.bold,
        color:      'var(--accent-red)',
        lineHeight: 1,
      }}>
        {animated}
      </div>
      <div style={{ fontSize: typography.fontSize.xs, color: 'var(--text-tertiary)', marginTop: spacing[1] }}>
        {value === 0 ? 'Tous les contacts ont un référent' : 'nécessitent un référent'}
      </div>
    </motion.div>
  );
}

// KPI avec pourcentage
function KpiPercent({
  label, value, total, icon, accentVar,
}: { label: string; value: number; total: number; icon: string; accentVar: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <Card>
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   spacing[3],
      }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span style={{
          fontSize:      typography.fontSize.xs,
          color:         'var(--kpi-label)',
          fontWeight:    typography.fontWeight.medium,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          textAlign:     'right',
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize:   typography.fontSize['3xl'],
        fontWeight: typography.fontWeight.bold,
        color:      `var(${accentVar})`,
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ marginTop: spacing[2] }}>
        <div style={{
          height:       '4px',
          borderRadius: radius.full,
          background:   'var(--progress-bg)',
          overflow:     'hidden',
        }}>
          <div style={{
            width:      `${pct}%`,
            height:     '100%',
            background: `var(${accentVar})`,
            borderRadius: radius.full,
            transition: '0.4s ease',
          }} />
        </div>
        <div style={{ fontSize: typography.fontSize.xs, color: 'var(--text-tertiary)', marginTop: '4px' }}>
          {pct}% du total
        </div>
      </div>
    </Card>
  );
}

// Carte charge des référents
function ChargeReferentsCard({ data }: { data: { name: string; count: number }[] }) {
  const SEUIL = 15;
  const maxVal = Math.max(SEUIL, ...data.map(r => r.count));
  return (
    <Card style={{ flex: 1 }}>
      <h2 style={{
        margin:     `0 0 ${spacing[4]}`,
        fontSize:   typography.fontSize.md,
        fontWeight: typography.fontWeight.semibold,
        color:      'var(--text-primary)',
      }}>
        Charge des référents
      </h2>
      {data.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: typography.fontSize.sm, margin: 0 }}>
          Aucun référent assigné
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
          {data.map((r) => {
            const overloaded = r.count >= SEUIL;
            const pct = Math.min((r.count / maxVal) * 100, 100);
            return (
              <div key={r.name}>
                <div style={{
                  display:        'flex',
                  justifyContent: 'space-between',
                  alignItems:     'baseline',
                  marginBottom:   '4px',
                }}>
                  <span style={{ fontSize: typography.fontSize.sm, color: 'var(--text-primary)', fontWeight: typography.fontWeight.medium }}>
                    {r.name}
                  </span>
                  <span style={{
                    fontSize:   typography.fontSize.xs,
                    fontWeight: typography.fontWeight.semibold,
                    color:      overloaded ? 'var(--accent-red)' : 'var(--accent-teal)',
                  }}>
                    {r.count} / {SEUIL}
                    {overloaded && ' ⚠'}
                  </span>
                </div>
                <div style={{
                  height:       '6px',
                  borderRadius: radius.full,
                  background:   'var(--progress-bg)',
                  overflow:     'hidden',
                }}>
                  <div style={{
                    width:      `${pct}%`,
                    height:     '100%',
                    background: overloaded ? 'var(--accent-red)' : 'var(--accent-teal)',
                    borderRadius: radius.full,
                    transition: '0.4s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// Carte statuts de suivi
function StatutsSuiviCard({ stats }: { stats: Record<string, number> }) {
  const statutsOrdered = ['nouveau', 'contacte', 'en_suivi', 'integre', 'ouvrier', 'inactif'] as const;
  return (
    <Card style={{ flex: 1 }}>
      <h2 style={{
        margin:     `0 0 ${spacing[4]}`,
        fontSize:   typography.fontSize.md,
        fontWeight: typography.fontWeight.semibold,
        color:      'var(--text-primary)',
      }}>
        Statuts de suivi
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
        {statutsOrdered.map((statut) => {
          const c = STATUT_COLORS[statut];
          const count = stats[statut] ?? 0;
          return (
            <div key={statut} style={{ display: 'flex', alignItems: 'center', gap: spacing[3] }}>
              <span style={{
                width:        '8px',
                height:       '8px',
                borderRadius: '50%',
                background:   c.text,
                flexShrink:   0,
              }} />
              <Badge bg={c.bg} text={c.text}>{STATUT_LABELS[statut]}</Badge>
              <span style={{
                marginLeft: 'auto',
                fontSize:   typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                color:      'var(--text-primary)',
              }}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Tableau des derniers contacts
function ContactsTable({ contacts }: { contacts: ContactRow[] }) {
  const navigate = useNavigate();
  const cols: Array<{ label: string; width?: string }> = [
    { label: 'Nom',      width: '200px' },
    { label: 'Profil',   width: '90px'  },
    { label: 'Canal',    width: '100px' },
    { label: 'Statut',   width: '110px' },
    { label: 'Référent', width: '140px' },
    { label: 'Campus',   width: '100px' },
    { label: 'Date',     width: '90px'  },
  ];

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  return (
    <Card>
      <h2 style={{
        margin:     `0 0 ${spacing[4]}`,
        fontSize:   typography.fontSize.md,
        fontWeight: typography.fontWeight.semibold,
        color:      'var(--text-primary)',
      }}>
        Derniers contacts inscrits
      </h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {cols.map((col) => (
                <th
                  key={col.label}
                  style={{
                    padding:       `${spacing[2]} ${spacing[3]}`,
                    textAlign:     'left',
                    fontSize:      typography.fontSize.xs,
                    fontWeight:    typography.fontWeight.semibold,
                    color:         'var(--table-header-text)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    width:         col.width,
                    borderBottom:  '1px solid var(--table-border)',
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.map((c, i) => {
              const profil = PROFIL_BADGE[c.profil];
              const canal  = CANAL_BADGE[c.canal];
              const statut = STATUT_COLORS[c.statut];
              const initials = `${c.prenom[0]}${c.nom[0]}`.toUpperCase();
              const referentName = c.referent_integration
                ? `${c.referent_integration.prenom} ${c.referent_integration.nom}`
                : '-';
              return (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/contacts/${c.id}`)}
                  style={{
                    cursor:     'pointer',
                    transition: '120ms ease',
                    background: i % 2 === 1 ? 'var(--bg-secondary)' : 'transparent',
                  }}
                >
                  {/* Nom */}
                  <td style={{ padding: `${spacing[2]} ${spacing[3]}`, borderBottom: '1px solid var(--table-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
                      <div style={{
                        width:          '28px',
                        height:         '28px',
                        borderRadius:   '9999px',
                        background:     'var(--accent-teal-light)',
                        color:          'var(--accent-teal)',
                        display:        'flex',
                        alignItems:     'center',
                        justifyContent: 'center',
                        fontSize:       '11px',
                        fontWeight:     typography.fontWeight.semibold,
                        flexShrink:     0,
                      }}>
                        {initials}
                      </div>
                      <span style={{ fontSize: typography.fontSize.sm, color: 'var(--text-primary)', fontWeight: typography.fontWeight.medium }}>
                        {c.prenom} {c.nom}
                      </span>
                    </div>
                  </td>
                  {/* Profil */}
                  <td style={{ padding: `${spacing[2]} ${spacing[3]}`, borderBottom: '1px solid var(--table-border)' }}>
                    <Badge bg={profil.bg} text={profil.text}>{PROFIL_LABELS[c.profil]}</Badge>
                  </td>
                  {/* Canal */}
                  <td style={{ padding: `${spacing[2]} ${spacing[3]}`, borderBottom: '1px solid var(--table-border)' }}>
                    <Badge bg={canal.bg} text={canal.text}>
                      {c.canal === 'presentiel' ? 'Présentiel' : 'En ligne'}
                    </Badge>
                  </td>
                  {/* Statut */}
                  <td style={{ padding: `${spacing[2]} ${spacing[3]}`, borderBottom: '1px solid var(--table-border)' }}>
                    <Badge bg={statut.bg} text={statut.text}>{STATUT_LABELS[c.statut]}</Badge>
                  </td>
                  {/* Référent */}
                  <td style={{ padding: `${spacing[2]} ${spacing[3]}`, borderBottom: '1px solid var(--table-border)', fontSize: typography.fontSize.sm, color: 'var(--text-secondary)' }}>
                    {referentName}
                  </td>
                  {/* Campus */}
                  <td style={{ padding: `${spacing[2]} ${spacing[3]}`, borderBottom: '1px solid var(--table-border)', fontSize: typography.fontSize.sm, color: 'var(--text-secondary)' }}>
                    {CAMPUS_LABELS[c.campus]}
                  </td>
                  {/* Date */}
                  <td style={{ padding: `${spacing[2]} ${spacing[3]}`, borderBottom: '1px solid var(--table-border)', fontSize: typography.fontSize.sm, color: 'var(--text-tertiary)' }}>
                    {fmt(c.date_inscription)}
                  </td>
                </tr>
              );
            })}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: spacing[6], textAlign: 'center', color: 'var(--text-tertiary)', fontSize: typography.fontSize.sm }}>
                  Aucun contact dans cette période
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Graphiques ───────────────────────────────────────────────────────────────

// Tooltip thémé — remplace le conteneur Recharts natif pour que les CSS variables
// du thème light/dark soient correctement résolues dans le rendu React.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:   'var(--bg-card)',
      border:       '1px solid var(--bg-card-border)',
      borderRadius: '8px',
      padding:      '10px 14px',
      color:        'var(--text-primary)',
      fontSize:     '13px',
      boxShadow:    '0 4px 12px rgba(0,0,0,0.3)',
    }}>
      {label && <p style={{ fontWeight: 600, margin: '0 0 4px' }}>{label}</p>}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(payload as any[]).map((p: any, i: number) => (
        <p key={i} style={{ color: p.color, margin: 0 }}>
          {p.name} : {p.value}
        </p>
      ))}
    </div>
  );
}

// Ticks axes — style CSS (pas attribut SVG) pour supporter les CSS variables
function AxisTickX({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  return (
    <text x={x} y={(y ?? 0) + 12} textAnchor="middle" style={{ fill: 'var(--text-primary)', fontSize: 11 }}>
      {payload?.value}
    </text>
  );
}
function AxisTickY({ x, y, payload }: { x?: number; y?: number; payload?: { value: string | number } }) {
  return (
    <text x={(x ?? 0) - 4} y={(y ?? 0) + 4} textAnchor="end" style={{ fill: 'var(--text-primary)', fontSize: 11 }}>
      {payload?.value}
    </text>
  );
}

// Labels PieChart extérieurs — positionnés à outerRadius+30, fill via style SVG
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderCustomizedLabel({ cx, cy, midAngle, outerRadius, percent, name }: any) {
  if ((percent ?? 0) === 0) return null;
  const RADIAN = Math.PI / 180;
  const radius = (outerRadius as number) + 30;
  const x = (cx as number) + radius * Math.cos(-midAngle * RADIAN);
  const y = (cy as number) + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="var(--text-primary)"
      textAnchor={x > (cx as number) ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={12}
      fontWeight="500"
    >
      {`${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
    </text>
  );
}

// Couleurs des barres par statut (fixes pour SVG)
const STATUT_CHART_COLORS: Record<string, string> = {
  nouveau:  '#3B82F6',
  contacte: '#F59E0B',
  en_suivi: '#8B5CF6',
  integre:  '#10B981',
  ouvrier:  '#0EA5E9',
  inactif:  '#6B7280',
};

const STATUT_CHART_LABELS: Record<string, string> = {
  nouveau:  'Nouveau',
  contacte: 'Contacté',
  en_suivi: 'En suivi',
  integre:  'Intégré',
  ouvrier:  'Ouvrier',
  inactif:  'Inactif',
};

function ChartCard({ title, children, loading }: { title: string; children: React.ReactNode; loading: boolean }) {
  return (
    <div style={{
      background:   'var(--bg-card)',
      border:       '1px solid var(--bg-card-border)',
      borderRadius: 10,
      padding:      16,
    }}>
      <h3 style={{
        margin:        `0 0 ${spacing[4]}`,
        fontSize:      typography.fontSize.sm,
        fontWeight:    typography.fontWeight.semibold,
        color:         'var(--text-primary)',
        textTransform: 'none',
      }}>
        {title}
      </h3>
      {loading ? (
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: typography.fontSize.sm }}>
          Chargement…
        </div>
      ) : children}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type CampusFilter = Campus | 'all';
type PeriodFilter = 'month' | '3months' | 'all';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [contacts,  setContacts]  = useState<ContactRow[]>([]);
  const [msgCount,  setMsgCount]  = useState<number>(0);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [campusFilter, setCampusFilter] = useState<CampusFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [exporting,    setExporting]    = useState(false);

  // Stats pour les graphiques
  const [statsInscriptions, setStatsInscriptions] = useState<InscriptionMoisData[]>([]);
  const [statsProfils,       setStatsProfils]      = useState<ProfilData[]>([]);
  const [statsStatuts,       setStatsStatuts]      = useState<StatutData[]>([]);
  const [statsMessages,      setStatsMessages]     = useState<MessageSemaineData[]>([]);
  const [statsLoading,       setStatsLoading]      = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contactsRes, msgs] = await Promise.all([
        contactsEndpoints.list({ limit: 1000 }),
        messagesEndpoints.list({ statut: 'envoye' }).then(r => r.data.total).catch(() => 0),
      ]);
      setContacts(contactsRes.data.contacts ?? []);
      setMsgCount(msgs as number);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message ?? 'Erreur de chargement');
      } else {
        setError('Erreur de connexion au serveur');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Charge les stats graphiques (tous les rôles — lecture seule)
  useEffect(() => {
    if (!user) return;

    setStatsLoading(true);
    const campus = campusFilter !== 'all' ? campusFilter : undefined;
    Promise.all([
      statsEndpoints.inscriptionsParMois({ campus, mois: 12 }).then(r => setStatsInscriptions(r.data)).catch(() => {}),
      statsEndpoints.profils({ campus }).then(r => setStatsProfils(r.data)).catch(() => {}),
      statsEndpoints.statuts({ campus }).then(r => setStatsStatuts(r.data)).catch(() => {}),
      statsEndpoints.messagesParSemaine({ semaines: 8 }).then(r => setStatsMessages(r.data)).catch(() => {}),
    ]).finally(() => setStatsLoading(false));
  }, [user, campusFilter]);

  async function handleExportCsv() {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (campusFilter !== 'all') params.campus = campusFilter;
      if (periodFilter !== 'all') params.periode = periodFilter;

      const response = await api.get('/contacts/export', {
        params,
        responseType: 'blob',
      });

      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail - l'erreur globale axios redirige si 401
    } finally {
      setExporting(false);
    }
  }

  // ─── Filtres ──────────────────────────────────────────────────────────────

  const filteredContacts = useMemo(() => {
    let result = contacts;
    if (campusFilter !== 'all') {
      result = result.filter(c => c.campus === campusFilter);
    }
    if (periodFilter !== 'all') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (periodFilter === 'month' ? 30 : 90));
      result = result.filter(c => new Date(c.date_inscription) >= cutoff);
    }
    return result;
  }, [contacts, campusFilter, periodFilter]);

  // ─── Calculs KPI ──────────────────────────────────────────────────────────

  const kpi = useMemo(() => {
    const total              = filteredContacts.length;
    const membrePhila        = filteredContacts.filter(c => c.profil === 'membre_phila').length;
    const visiteurSansEglise = filteredContacts.filter(c => c.profil === 'visiteur_sans_eglise').length;
    const visiteurAvecEglise = filteredContacts.filter(c => c.profil === 'visiteur_avec_eglise').length;
    const sansRef            = filteredContacts.filter(c => !c.referent_integration).length;
    const enLigne            = filteredContacts.filter(c => c.canal === 'en_ligne').length;
    const presentiel  = filteredContacts.filter(c => c.canal === 'presentiel').length;
    const byStatut: Record<string, number> = {};
    for (const c of filteredContacts) {
      byStatut[c.statut] = (byStatut[c.statut] ?? 0) + 1;
    }
    return { total, membrePhila, visiteurSansEglise, visiteurAvecEglise, sansRef, enLigne, presentiel, byStatut };
  }, [filteredContacts]);

  // ─── Charge référents ─────────────────────────────────────────────────────

  const referentCharge = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const c of filteredContacts) {
      if (c.referent_integration) {
        const id  = c.referent_integration.id;
        const rec = map.get(id);
        if (rec) {
          rec.count++;
        } else {
          map.set(id, {
            name:  `${c.referent_integration.prenom} ${c.referent_integration.nom}`,
            count: 1,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [filteredContacts]);

  // ─── Derniers contacts ────────────────────────────────────────────────────

  const recentContacts = useMemo(() => (
    [...filteredContacts]
      .sort((a, b) => new Date(b.date_inscription).getTime() - new Date(a.date_inscription).getTime())
      .slice(0, 10)
  ), [filteredContacts]);

  // ─── Rapport mensuel PDF ──────────────────────────────────────────────────
  // Génère un PDF côté client depuis les données déjà chargées (filteredContacts + kpi).
  // jsPDF + jspdf-autotable : aucun appel réseau, tout est calculé en mémoire.

  function genererRapportMensuel() {
    const doc = new jsPDF();
    const maintenant = new Date();
    const mois = maintenant.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    // ── En-tête coloré ──────────────────────────────────────────────────────
    doc.setFillColor(26, 86, 176);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Phila Cite des Adorateurs', 20, 18);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(`Rapport mensuel - ${mois.charAt(0).toUpperCase() + mois.slice(1)}`, 20, 30);

    // ── Date de génération ──────────────────────────────────────────────────
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.text(
      `Genere le ${maintenant.toLocaleDateString('fr-FR')} a ${maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      20, 50,
    );

    // ── Section KPIs ────────────────────────────────────────────────────────
    doc.setTextColor(26, 86, 176);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("Vue d'ensemble", 20, 65);

    const kpis: Array<{ label: string; value: string; color: [number, number, number] }> = [
      { label: 'Total inscrits',  value: String(kpi.total),              color: [26,  86,  176] },
      { label: 'Membres Phila',   value: String(kpi.membrePhila),        color: [20,  184, 166] },
      { label: 'Sans eglise',     value: String(kpi.visiteurSansEglise), color: [212, 162, 78]  },
      { label: 'Avec eglise',     value: String(kpi.visiteurAvecEglise), color: [139, 92,  246] },
    ];

    kpis.forEach((k, i) => {
      const x = 20 + (i % 2) * 90;
      const y = 72 + Math.floor(i / 2) * 25;
      doc.setFillColor(...k.color);
      doc.roundedRect(x, y, 80, 18, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(k.label, x + 4, y + 7);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(k.value, x + 4, y + 15);
    });

    // ── Tableau des contacts ─────────────────────────────────────────────────
    doc.setTextColor(26, 86, 176);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Contacts du mois', 20, 130);

    autoTable(doc, {
      startY: 135,
      head: [['Prenom', 'Nom', 'Profil', 'Statut', 'Campus', 'Date inscription']],
      body: filteredContacts.map(c => [
        c.prenom,
        c.nom,
        PROFIL_LABELS[c.profil] || c.profil,
        STATUT_LABELS[c.statut] || c.statut,
        c.campus === 'paris' ? 'Paris' : 'Paris Nord',
        new Date(c.date_inscription).toLocaleDateString('fr-FR'),
      ]),
      styles:              { fontSize: 9, cellPadding: 3 },
      headStyles:          { fillColor: [26, 86, 176], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles:  { fillColor: [245, 247, 250] },
      margin:              { left: 20, right: 20 },
    });

    // ── Pied de page ────────────────────────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Phila Integration - Document confidentiel', 20, 290);
      doc.text(`Page ${i} / ${pageCount}`, 180, 290);
    }

    doc.save(`rapport-phila-${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}.pdf`);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const campusOpts: Array<{ value: CampusFilter; label: string }> = [
    { value: 'all',       label: 'Tous les campus' },
    { value: 'paris',     label: 'Paris' },
    { value: 'paris_nord',label: 'Paris Nord' },
  ];
  const periodOpts: Array<{ value: PeriodFilter; label: string }> = [
    { value: 'month',   label: 'Ce mois' },
    { value: '3months', label: '3 derniers mois' },
    { value: 'all',     label: 'Tout' },
  ];

  return (
    <div style={{ maxWidth: layout.contentMaxWidth }}>
      {/* En-tête */}
      <div style={{
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'space-between',
        marginBottom:   spacing[6],
        gap:            spacing[4],
      }}>
        <div style={{ marginBottom: '8px' }}>
          <h1 style={{
            fontSize:   'clamp(18px, 4vw, 26px)',
            fontWeight: 700,
            color:      'var(--text-primary)',
            margin:     0,
          }}>
            Bonjour, {user?.prenom} 👋
          </h1>
          <p style={{
            color:      'var(--text-secondary)',
            fontSize:   '12px',
            marginTop:  '4px',
            lineHeight: '1.5',
          }}>
            Vue d'ensemble de l'intégration
          </p>
          <p style={{
            color:     'var(--text-secondary)',
            fontSize:  '11px',
            marginTop: '2px',
            margin:    0,
          }}>
            {(user?.campus ?? []).map(c => CAMPUS_LABELS[c]).join(' · ')}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: spacing[2], flexShrink: 0, alignItems: 'center' }}>
          {/* Rapport mensuel - bouton premium */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={genererRapportMensuel}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          '6px',
              padding:      '8px 16px',
              borderRadius: '8px',
              border:       '1px solid var(--accent-teal)',
              background:   'var(--btn-primary-bg)',
              color:        'var(--btn-primary-text)',
              fontSize:     typography.fontSize.sm,
              fontWeight:   600,
              cursor:       'pointer',
              transition:   '120ms ease',
              boxShadow:    '0 0 12px rgba(26,86,176,0.2)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1"  y="8"  width="3" height="7" rx="1" fill="currentColor"/>
              <rect x="6"  y="4"  width="3" height="11" rx="1" fill="currentColor"/>
              <rect x="11" y="1"  width="3" height="14" rx="1" fill="currentColor"/>
            </svg>
            Rapport mensuel
          </motion.button>

          {/* Exporter CSV - bouton premium */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleExportCsv}
            disabled={exporting}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          '6px',
              padding:      '8px 16px',
              borderRadius: '8px',
              border:       '1px solid var(--accent-teal)',
              background:   'var(--btn-primary-bg)',
              color:        'var(--btn-primary-text)',
              fontSize:     typography.fontSize.sm,
              fontWeight:   600,
              cursor:       exporting ? 'not-allowed' : 'pointer',
              opacity:      exporting ? 0.7 : 1,
              transition:   '120ms ease',
              boxShadow:    '0 0 12px rgba(26,86,176,0.2)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1v9M8 10l-3-3M8 10l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {exporting ? 'Export…' : 'Exporter CSV'}
          </motion.button>
        </div>
      </div>

      {/* Barre de filtres */}
      <div style={{ display: 'flex', gap: spacing[3], flexWrap: 'wrap', marginBottom: spacing[6] }}>
        <div style={{
          display:      'flex',
          gap:          '2px',
          background:   'var(--bg-secondary)',
          borderRadius: 'var(--border-radius-md)',
          padding:      '3px',
          border:       '1px solid var(--bg-card-border)',
        }}>
          {campusOpts.map(opt => (
            <FilterBtn
              key={opt.value}
              active={campusFilter === opt.value}
              onClick={() => setCampusFilter(opt.value)}
            >
              {opt.label}
            </FilterBtn>
          ))}
        </div>
        <div style={{
          display:      'flex',
          gap:          '2px',
          background:   'var(--bg-secondary)',
          borderRadius: 'var(--border-radius-md)',
          padding:      '3px',
          border:       '1px solid var(--bg-card-border)',
        }}>
          {periodOpts.map(opt => (
            <FilterBtn
              key={opt.value}
              active={periodFilter === opt.value}
              onClick={() => setPeriodFilter(opt.value)}
            >
              {opt.label}
            </FilterBtn>
          ))}
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div style={{
          background:   'var(--bg-card-alert)',
          color:        'var(--accent-red)',
          border:       '1px solid var(--bg-card-alert-border)',
          borderRadius: 'var(--border-radius-md)',
          padding:      `${spacing[3]} ${spacing[4]}`,
          marginBottom: spacing[6],
          fontSize:     typography.fontSize.sm,
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: spacing[12] }}>
          Chargement…
        </div>
      ) : (
        <>
          {/* ── 6 KPIs - 3 col desktop / 2 tablette / 1 mobile ───────────────── */}
          <div className="kpi-grid-3">
            <KpiSimple
              label="Total inscrits"
              value={kpi.total}
              icon="👥"
              accentVar="--accent-teal"
              onClick={() => navigate('/contacts')}
            />
            <KpiSimple label="Membres Phila"       value={kpi.membrePhila}        icon="⛪" accentVar="--accent-teal"   />
            <KpiSimple label="Visiteurs sans église" value={kpi.visiteurSansEglise} icon="👤" accentVar="--accent-gold"   />
            <KpiSimple label="Visiteurs avec église" value={kpi.visiteurAvecEglise} icon="🏛️" accentVar="--accent-violet" />
            <KpiAlert value={kpi.sansRef} label="Sans référent" />

            <KpiPercent
              label="En ligne"
              value={kpi.enLigne}
              total={kpi.total}
              icon="💻"
              accentVar="--accent-blue"
            />
            <KpiPercent
              label="Présentiel"
              value={kpi.presentiel}
              total={kpi.total}
              icon="🏛️"
              accentVar="--accent-violet"
            />
            <KpiSimple
              label="Messages envoyés"
              value={msgCount}
              icon="💬"
              accentVar="--accent-teal"
            />
          </div>

          {/* ── 2 cartes - côte à côte desktop, empilées mobile ──────────── */}
          <div className="kpi-grid-2">
            <ChargeReferentsCard data={referentCharge} />
            <StatutsSuiviCard stats={kpi.byStatut} />
          </div>

          {/* ── Tableau derniers contacts ──────────────────────────────── */}
          <ContactsTable contacts={recentContacts} />

          {/* ── Section Statistiques (tous les rôles — lecture seule) ─── */}
          {user && (
            <>
              <div style={{
                margin:     `${spacing[8]} 0 ${spacing[4]}`,
                fontSize:   typography.fontSize.lg,
                fontWeight: typography.fontWeight.semibold,
                color:      'var(--text-primary)',
              }}>
                Statistiques
              </div>

              {/* Grille 2 colonnes desktop, 1 mobile */}
              <div className="stats-grid-2">

                {/* Graphique 1 - Évolution des inscriptions */}
                <ChartCard title="Évolution des inscriptions" loading={statsLoading}>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={statsInscriptions} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                      <XAxis dataKey="mois" tick={<AxisTickX />} axisLine={false} tickLine={false} />
                      <YAxis tick={<AxisTickY />} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
                      <Line
                        type="monotone" dataKey="presentiel" name="Présentiel"
                        stroke="#1A56B0" strokeWidth={2} dot={false} activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone" dataKey="en_ligne" name="En ligne"
                        stroke="#D4A24E" strokeWidth={2} dot={false} activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Graphique 2 - Répartition des profils */}
                <ChartCard title="Répartition des profils" loading={statsLoading}>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={statsProfils}
                        cx="50%" cy="50%"
                        outerRadius={70}
                        dataKey="value"
                        label={renderCustomizedLabel}
                        labelLine={{ stroke: 'var(--text-secondary)', strokeWidth: 1 }}
                      >
                        {statsProfils.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Graphique 3 - Contacts par statut */}
                <ChartCard title="Contacts par statut" loading={statsLoading}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={statsStatuts.map(d => ({
                        ...d,
                        label: STATUT_CHART_LABELS[d.statut] ?? d.statut,
                        fill:  STATUT_CHART_COLORS[d.statut] ?? '#6B7280',
                      }))}
                      margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" vertical={false} />
                      <XAxis dataKey="label" tick={<AxisTickX />} axisLine={false} tickLine={false} />
                      <YAxis tick={<AxisTickY />} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Contacts" radius={[3, 3, 0, 0]}>
                        {statsStatuts.map((entry, index) => (
                          <Cell key={index} fill={STATUT_CHART_COLORS[entry.statut] ?? '#6B7280'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Graphique 4 - Messages envoyés par semaine */}
                <ChartCard title="Messages envoyés" loading={statsLoading}>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={statsMessages} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#1A56B0" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#1A56B0" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                      <XAxis dataKey="semaine" tick={<AxisTickX />} axisLine={false} tickLine={false} />
                      <YAxis tick={<AxisTickY />} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone" dataKey="count" name="Messages"
                        stroke="#1A56B0" strokeWidth={2}
                        fill="url(#msgGradient)"
                        dot={false} activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
