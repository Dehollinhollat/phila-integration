// src/pages/FormFeedback.tsx
// Formulaire de satisfaction — accessible via /form/feedback/:token (public).
// 5 sections, barre de progression, submit vers POST /api/feedback/:token.
// Anonyme : le token identifie le contact côté backend sans l'exposer dans l'UI.

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Logo from '../components/ui/Logo';
import Footer from '../components/common/Footer';
import { API_BASE } from '../utils/constants';

// ─── Types locaux ─────────────────────────────────────────────────────────────

interface Reponses {
  q1:       string;
  q2:       string;
  q3:       string[];
  q3_autre: string;
  q4:       number;
  q5:       number;
  q6:       string[];
  q6_autre: string;
  q7:       string[];
  q7_autre: string;
  q8:       string;
  q9:       string;
  q10:      string;
  q11:      string;
  q12:      string;
}

const INITIAL: Reponses = {
  q1: '', q2: '', q3: [], q3_autre: '', q4: 0, q5: 0,
  q6: [], q6_autre: '', q7: [], q7_autre: '', q8: '',
  q9: '', q10: '', q11: '', q12: '',
};

const SECTIONS_LABELS = [
  'Votre profil',
  'Expérience globale',
  'Déroulement du culte',
  'Vie communautaire',
  'Recommandation',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function RadioGroup({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map(opt => (
        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: '#1E293B' }}>
          <input
            type="radio"
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            style={{ accentColor: '#0D9488', width: 16, height: 16, flexShrink: 0 }}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

function CheckboxGroup({ options, values, onChange, otherValue, onOtherChange }: {
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
  otherValue: string;
  onOtherChange: (v: string) => void;
}) {
  function toggle(val: string) {
    onChange(values.includes(val) ? values.filter(v => v !== val) : [...values, val]);
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map(opt => (
        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: '#1E293B' }}>
          <input
            type="checkbox"
            checked={values.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            style={{ accentColor: '#0D9488', width: 16, height: 16, flexShrink: 0 }}
          />
          {opt.label}
        </label>
      ))}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 14, color: '#1E293B' }}>
        <input
          type="checkbox"
          checked={values.includes('autre')}
          onChange={() => toggle('autre')}
          style={{ accentColor: '#0D9488', width: 16, height: 16, flexShrink: 0, marginTop: 2 }}
        />
        <div style={{ flex: 1 }}>
          Autre
          {values.includes('autre') && (
            <input
              type="text"
              value={otherValue}
              onChange={e => onOtherChange(e.target.value)}
              placeholder="Précisez…"
              style={{ display: 'block', marginTop: 6, width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, color: '#0F172A', background: '#F8FAFC', boxSizing: 'border-box' }}
            />
          )}
        </div>
      </label>
    </div>
  );
}

function StarRating({ value, onChange, label1, label5 }: {
  value: number;
  onChange: (v: number) => void;
  label1: string;
  label5: string;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(n)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 32, lineHeight: 1, padding: 2, color: (hovered || value) >= n ? '#F59E0B' : '#CBD5E1', transition: '120ms ease' }}
          >
            ★
          </button>
        ))}
        {value > 0 && <span style={{ fontSize: 13, color: '#64748B', marginLeft: 4 }}>{value}/5</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8' }}>
        <span>{label1}</span>
        <span>{label5}</span>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function FormFeedback() {
  const { token } = useParams<{ token: string }>();
  const [step,       setStep]       = useState(0);
  const [reponses,   setReponses]   = useState<Reponses>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  function set<K extends keyof Reponses>(key: K, value: Reponses[K]) {
    setReponses(prev => ({ ...prev, [key]: value }));
  }

  function canGoNext(): boolean {
    switch (step) {
      case 0: return !!reponses.q1 && !!reponses.q2 && reponses.q3.length > 0;
      case 1: return reponses.q4 > 0 && reponses.q5 > 0;
      case 2: return reponses.q6.length > 0 && reponses.q7.length > 0 && !!reponses.q8;
      case 3: return !!reponses.q9;
      case 4: return !!reponses.q10 && !!reponses.q11;
      default: return false;
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setTokenError(null);
    try {
      await axios.post(`${API_BASE}/feedback/${token}`, reponses);
      setStep(5);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setTokenError(err.response?.data?.message ?? 'Une erreur est survenue.');
      } else {
        setTokenError('Impossible de contacter le serveur.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Écran de remerciement ──
  if (step === 5) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <Logo width={56} height={56} style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 40, marginBottom: 16 }}>🙏</div>
          <h1 style={{ ...S.title, marginBottom: 12 }}>Merci infiniment !</h1>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.7, textAlign: 'center' }}>
            Votre avis contribue directement à l'amélioration de notre communauté.<br />
            Que Dieu vous bénisse.
          </p>
        </div>
        <Footer />
      </div>
    );
  }

  const progress = (step / 5) * 100;

  return (
    <div style={S.page}>
      <div style={S.card}>

        {/* En-tête */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Logo width={52} height={52} style={{ marginBottom: 12 }} />
          <span style={{ display: 'inline-block', background: '#0D9488', color: '#fff', borderRadius: 20, padding: '4px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 12 }}>
            Questionnaire de satisfaction
          </span>
          <h1 style={S.title}>Votre avis compte pour nous</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#475569' }}>
            Questionnaire de satisfaction (anonyme)
          </p>
        </div>

        {/* Introduction — section 1 uniquement */}
        {step === 0 && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '14px 16px', marginBottom: 24, fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
            Dans le cadre de notre démarche d'amélioration continue, nous souhaitons mieux comprendre votre vécu lors de nos cultes. Ce questionnaire est entièrement anonyme et ne prend que 3 à 5 minutes. Vos réponses sincères sont précieuses pour nous aider à grandir ensemble. Merci de votre participation !
          </div>
        )}

        {/* Barre de progression */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Section {step + 1} / 5</span>
            <span style={{ fontSize: 12, color: '#64748B' }}>{SECTIONS_LABELS[step]}</span>
          </div>
          <div style={{ height: 4, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: '#0D9488', borderRadius: 4, transition: '400ms ease' }} />
          </div>
        </div>

        {/* Titre de section */}
        <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: '#1E293B', paddingBottom: 10, borderBottom: '1px solid #E2E8F0' }}>
          {SECTIONS_LABELS[step]}
        </h2>

        {/* Section 1 : Profil */}
        {step === 0 && (
          <div style={S.section}>
            <div style={S.question}>
              <label style={S.label}>Q1 — Comment vous définissez-vous au sein de l'assemblée ?</label>
              <RadioGroup value={reponses.q1} onChange={v => set('q1', v)} options={[
                { value: 'nouveau_visiteur', label: 'Nouveau visiteur (moins de 3 mois)' },
                { value: 'membre_regulier',  label: 'Membre régulier' },
                { value: 'ouvrier',          label: 'Ouvrier / bénévole' },
              ]} />
            </div>
            <div style={S.question}>
              <label style={S.label}>Q2 — À quelle fréquence venez-vous au culte du dimanche ?</label>
              <RadioGroup value={reponses.q2} onChange={v => set('q2', v)} options={[
                { value: 'premiere_fois',      label: "C'est ma première fois" },
                { value: 'quelques_fois',      label: 'Quelques fois seulement' },
                { value: 'irregulier',         label: 'De manière irrégulière' },
                { value: 'presque_chaque_dim', label: 'Presque chaque dimanche' },
              ]} />
            </div>
            <div style={S.question}>
              <label style={S.label}>Q3 — Comment avez-vous découvert Phila Cité des Adorateurs ?</label>
              <CheckboxGroup values={reponses.q3} onChange={v => set('q3', v)} otherValue={reponses.q3_autre} onOtherChange={v => set('q3_autre', v)} options={[
                { value: 'proche',   label: 'Par un proche / ami / famille' },
                { value: 'reseaux',  label: 'Réseaux sociaux' },
                { value: 'internet', label: 'Recherche internet' },
                { value: 'affiches', label: 'Affiches / flyers' },
                { value: 'passais',  label: 'Je passais devant' },
              ]} />
            </div>
          </div>
        )}

        {/* Section 2 : Expérience globale */}
        {step === 1 && (
          <div style={S.section}>
            <div style={S.question}>
              <label style={S.label}>Q4 — De manière générale, comment évaluez-vous votre expérience lors du culte du dimanche ?</label>
              <StarRating value={reponses.q4} onChange={v => set('q4', v)} label1="Pas satisfait" label5="Très satisfait" />
            </div>
            <div style={S.question}>
              <label style={S.label}>Q5 — Comment avez-vous trouvé l'accueil à votre arrivée ?</label>
              <StarRating value={reponses.q5} onChange={v => set('q5', v)} label1="Peu chaleureux" label5="Très chaleureux" />
            </div>
          </div>
        )}

        {/* Section 3 : Déroulement du culte */}
        {step === 2 && (
          <div style={S.section}>
            <div style={S.question}>
              <label style={S.label}>Q6 — Parmi les éléments suivants, lesquels avez-vous particulièrement appréciés ?</label>
              <CheckboxGroup values={reponses.q6} onChange={v => set('q6', v)} otherValue={reponses.q6_autre} onOtherChange={v => set('q6_autre', v)} options={[
                { value: 'louange',    label: "La louange et l'adoration" },
                { value: 'predication', label: 'La prédication / le message' },
                { value: 'priere',     label: 'Les temps de prière' },
                { value: 'annonces',   label: "Les annonces et la vie de l'assemblée" },
                { value: 'echanges',   label: 'Les échanges fraternels après le culte' },
                { value: 'ambiance',   label: "L'ambiance générale" },
              ]} />
            </div>
            <div style={S.question}>
              <label style={S.label}>Q7 — Y a-t-il des aspects que vous souhaiteriez voir améliorés ou renforcés ?</label>
              <CheckboxGroup values={reponses.q7} onChange={v => set('q7', v)} otherValue={reponses.q7_autre} onOtherChange={v => set('q7_autre', v)} options={[
                { value: 'accueil_nouveaux', label: "L'accueil des nouveaux arrivants" },
                { value: 'duree_culte',      label: 'La durée globale du culte' },
                { value: 'louange_duree',    label: 'Le temps consacré à la louange' },
                { value: 'message',          label: 'Le contenu ou la durée du message' },
                { value: 'echange',          label: "Le temps d'échange et de rencontre entre membres" },
                { value: 'communication',    label: 'La communication / les informations pratiques' },
                { value: 'logistique',       label: "L'organisation logistique (espace, son, etc.)" },
                { value: 'satisfait',        label: 'Rien en particulier, je suis satisfait(e)' },
              ]} />
            </div>
            <div style={S.question}>
              <label style={S.label}>Q8 — Quelle durée de culte vous semble la plus adaptée ?</label>
              <RadioGroup value={reponses.q8} onChange={v => set('q8', v)} options={[
                { value: 'moins_1h30', label: 'Moins de 1h30' },
                { value: '1h30_2h',   label: 'Entre 1h30 et 2h' },
                { value: '2h_2h30',   label: 'Entre 2h et 2h30' },
                { value: 'plus_2h30', label: 'Plus de 2h30' },
              ]} />
            </div>
          </div>
        )}

        {/* Section 4 : Vie communautaire */}
        {step === 3 && (
          <div style={S.section}>
            <div style={S.question}>
              <label style={S.label}>Q9 — Après le culte, avez-vous eu l'opportunité d'échanger avec d'autres membres ?</label>
              <RadioGroup value={reponses.q9} onChange={v => set('q9', v)} options={[
                { value: 'oui_facilement', label: 'Oui, facilement' },
                { value: 'un_peu',         label: "Un peu, mais j'aurais aimé plus" },
                { value: 'non_vraiment',   label: 'Non, pas vraiment' },
                { value: 'reparti_direct', label: "Je suis reparti(e) directement après le culte" },
              ]} />
            </div>
          </div>
        )}

        {/* Section 5 : Recommandation */}
        {step === 4 && (
          <div style={S.section}>
            <div style={S.question}>
              <label style={S.label}>Q10 — Avez-vous l'intention de revenir au culte ?</label>
              <RadioGroup value={reponses.q10} onChange={v => set('q10', v)} options={[
                { value: 'oui_certainement', label: 'Oui, certainement' },
                { value: 'probablement',     label: 'Probablement' },
                { value: 'ne_sais_pas',      label: 'Je ne sais pas encore' },
                { value: 'probablement_pas', label: 'Probablement pas' },
              ]} />
            </div>
            <div style={S.question}>
              <label style={S.label}>Q11 — Recommanderiez-vous nos cultes à quelqu'un de votre entourage ?</label>
              <RadioGroup value={reponses.q11} onChange={v => set('q11', v)} options={[
                { value: 'oui_certainement', label: 'Oui, certainement' },
                { value: 'probablement_oui', label: 'Probablement oui' },
                { value: 'ne_sais_pas',      label: 'Je ne sais pas encore' },
                { value: 'probablement_pas', label: 'Probablement pas' },
              ]} />
            </div>
            <div style={S.question}>
              <label style={{ ...S.label, marginBottom: 8 }}>
                Q12 — Avez-vous des suggestions, idées ou commentaires à partager avec nous ?{' '}
                <span style={{ fontWeight: 400, color: '#94A3B8' }}>(facultatif)</span>
              </label>
              <textarea
                value={reponses.q12}
                onChange={e => set('q12', e.target.value)}
                placeholder="Vos suggestions sont les bienvenues…"
                rows={4}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 14, color: '#0F172A', background: '#F8FAFC', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' as const, outline: 'none' }}
              />
            </div>
          </div>
        )}

        {/* Erreur soumission */}
        {tokenError && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', marginBottom: 16, marginTop: 16, fontSize: 13, color: '#DC2626' }}>
            {tokenError}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, gap: 12 }}>
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              style={{ padding: '11px 20px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ← Précédent
            </button>
          ) : <div />}
          {step < 4 ? (
            <button
              type="button"
              onClick={() => { if (canGoNext()) setStep(s => s + 1); }}
              disabled={!canGoNext()}
              style={{ padding: '11px 24px', background: canGoNext() ? '#0D9488' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: canGoNext() ? 'pointer' : 'default', fontFamily: 'inherit', transition: '120ms ease' }}
            >
              Suivant →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !canGoNext()}
              style={{ padding: '11px 24px', background: (!submitting && canGoNext()) ? '#0D9488' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: (!submitting && canGoNext()) ? 'pointer' : 'default', fontFamily: 'inherit', transition: '120ms ease' }}
            >
              {submitting ? 'Envoi…' : 'Envoyer mes réponses ✓'}
            </button>
          )}
        </div>

      </div>
      <Footer />
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight:      '100vh',
    display:        'flex',
    flexDirection:  'column' as const,
    background:     'linear-gradient(135deg, #F0FDFA 0%, #fff 60%)',
  },
  card: {
    flex:      1,
    maxWidth:  540,
    width:     '100%',
    margin:    '0 auto',
    padding:   'clamp(20px, 5vw, 40px)',
    background: '#fff',
  },
  title: {
    margin:       0,
    fontSize:     22,
    fontWeight:   700,
    color:        '#0F172A',
    letterSpacing: '-0.3px',
  },
  section: {
    display:       'flex',
    flexDirection: 'column' as const,
    gap:           28,
  },
  question: {
    display:       'flex',
    flexDirection: 'column' as const,
    gap:           12,
  },
  label: {
    display:    'block',
    fontSize:   14,
    fontWeight: 600,
    color:      '#1E293B',
    lineHeight: 1.4,
  },
} as const;
