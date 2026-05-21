// src/features/contacts/ContactForm.tsx
// Formulaire de création d'un contact (admin_campus+).
// POST /api/contacts → redirige vers /contacts/:id.

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { contactsEndpoints } from '../../services/endpoints';
import { validateFullPhone, normalizeFullPhone } from '../../utils/phone';
import type {
  Genre, EtatCivil, StatutPhila, Extension, Profil,
  Canal, StatutContact, Campus, Souhait, BesoinSpirituel,
  InteretCellule, DisponibiliteSuivi,
} from '../../types';
import {
  GENRE_OPTIONS, ETAT_CIVIL_OPTIONS, STATUT_PHILA_OPTIONS,
  CAMPUS_OPTIONS, STATUT_OPTIONS, INTERET_CELLULE_LABELS,
  SOUHAIT_LABELS, BESOIN_LABELS, DISPO_LABELS, EXTENSION_LABELS,
  PROFIL_LABELS, PROFIL_BADGE,
} from '../../utils/constants';

// ─── Type formulaire ──────────────────────────────────────────────────────────

type FormState = {
  genre:                Genre;
  prenom:               string;
  nom:                  string;
  telephone:            string;
  email:                string;
  date_naissance:       string;
  ville:                string;
  code_postal:          string;
  etat_civil:           EtatCivil;
  statut_phila:         StatutPhila;
  extension_phila:      Extension | '';
  profil:               Profil;
  statut:               StatutContact;
  campus:               Campus;
  canal:                Canal;
  saisi_par_membre:     boolean;
  interet_cellule:      InteretCellule | '';
  comment_connu:        string;
  souhait:              Souhait | '';
  besoins:              BesoinSpirituel[];
  autre_eglise:         boolean;
  nom_autre_eglise:     string;
  sert_autre_eglise:    boolean;
  service_autre_eglise: string;
  rdv_pasteur:          boolean;
  don:                  boolean;
  disponibilite_suivi:  DisponibiliteSuivi | '';
};

const DEFAULT_FORM: FormState = {
  genre:                'homme',
  prenom:               '',
  nom:                  '',
  telephone:            '',
  email:                '',
  date_naissance:       '',
  ville:                '',
  code_postal:          '',
  etat_civil:           'celibataire',
  statut_phila:         'non',
  extension_phila:      '',
  profil:               'visiteur_sans_eglise',
  statut:               'nouveau',
  campus:               'paris',
  canal:                'presentiel',
  saisi_par_membre:     false,
  interet_cellule:      '',
  comment_connu:        '',
  souhait:              '',
  besoins:              [],
  autre_eglise:         false,
  nom_autre_eglise:     '',
  sert_autre_eglise:    false,
  service_autre_eglise: '',
  rdv_pasteur:          false,
  don:                  false,
  disponibilite_suivi:  '',
};

function formToPayload(f: FormState): Record<string, unknown> {
  return {
    ...f,
    telephone:            normalizeFullPhone(f.telephone),
    email:                f.email                || null,
    date_naissance:       f.date_naissance       || null,
    code_postal:          f.code_postal          || null,
    extension_phila:      f.extension_phila      || null,
    interet_cellule:      f.interet_cellule      || null,
    comment_connu:        f.comment_connu        || null,
    souhait:              f.souhait              || null,
    nom_autre_eglise:     f.nom_autre_eglise     || null,
    service_autre_eglise: f.service_autre_eglise || null,
    disponibilite_suivi:  f.disponibilite_suivi  || null,
  };
}

// ─── Composants de mise en page ───────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
      borderRadius: '12px', marginBottom: '16px', overflow: 'hidden',
    }}>
      <div style={{
        padding: '11px 20px', borderBottom: '1px solid var(--bg-card-border)',
        background: 'var(--bg-secondary)',
      }}>
        <h2 style={{
          margin: 0, fontSize: '0.72rem', fontWeight: 700,
          color: 'var(--table-header-text)', textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>
          {title}
        </h2>
      </div>
      <div style={{
        padding: '20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '18px',
      }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, required, note, fullWidth, children }: {
  label: string;
  required?: boolean;
  note?: string;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '5px',
      gridColumn: fullWidth ? '1 / -1' : undefined,
    }}>
      <label style={{
        fontSize: '0.78rem', fontWeight: 600,
        color: 'var(--text-secondary)', letterSpacing: '0.02em',
      }}>
        {label}
        {required && <span style={{ color: 'var(--accent-red)', marginLeft: '2px' }}>*</span>}
      </label>
      {children}
      {note && (
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          {note}
        </span>
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ContactForm() {
  const navigate = useNavigate();
  const [form,       setForm]       = useState<FormState>(DEFAULT_FORM);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'statut_phila' || field === 'autre_eglise') {
        const statut   = field === 'statut_phila' ? (value as StatutPhila) : prev.statut_phila;
        const autreEgl = field === 'autre_eglise'  ? (value as boolean)    : prev.autre_eglise;
        next.profil = statut === 'oui' ? 'membre_phila'
          : autreEgl ? 'visiteur_avec_eglise' : 'visiteur_sans_eglise';
      }
      return next;
    });
  }

  function toggleBesoin(b: BesoinSpirituel) {
    const besoins = form.besoins.includes(b)
      ? form.besoins.filter(x => x !== b)
      : [...form.besoins, b];
    setForm(prev => ({ ...prev, besoins }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { data } = await contactsEndpoints.create(formToPayload(form) as Parameters<typeof contactsEndpoints.create>[0]);
      navigate(`/contacts/${data.id}`);
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message as string | undefined) ?? 'Erreur lors de la création'
        : 'Erreur inattendue';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const isMembre = form.statut_phila === 'oui';

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1100px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => navigate('/contacts')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: '8px',
            border: '1px solid var(--bg-card-border)', background: 'transparent',
            color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer',
          }}
        >
          ← Retour
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            Nouveau contact
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Créer une fiche contact manuellement
          </p>
        </div>
      </div>

      {error && (
        <div style={{
          marginBottom: '16px', padding: '10px 16px', borderRadius: '8px',
          background: 'rgba(220,38,38,0.08)', color: 'var(--accent-red)',
          border: '1px solid rgba(220,38,38,0.2)', fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* Section 1 - Identité */}
        <SectionCard title="Identité">
          <Field label="Genre" required>
            <select value={form.genre} onChange={(e) => set('genre', e.target.value as Genre)} style={S.select}>
              {GENRE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>

          <Field label="Prénom" required>
            <input
              required
              value={form.prenom}
              onChange={(e) => set('prenom', e.target.value)}
              placeholder="Prénom"
              style={S.input}
            />
          </Field>

          <Field label="Nom" required>
            <input
              required
              value={form.nom}
              onChange={(e) => set('nom', e.target.value)}
              placeholder="Nom de famille"
              style={S.input}
            />
          </Field>

          <Field label="Téléphone" required>
            <input
              required
              type="tel"
              value={form.telephone}
              onChange={(e) => {
                set('telephone', e.target.value);
                setPhoneError(e.target.value.trim() ? validateFullPhone(e.target.value) : null);
              }}
              onBlur={(e) => {
                if (e.target.value.trim()) setPhoneError(validateFullPhone(e.target.value));
              }}
              placeholder="+33 6 00 00 00 00"
              style={{ ...S.input, ...(phoneError ? { border: '1px solid var(--accent-red)' } : {}) }}
            />
            {phoneError && (
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-red)', marginTop: 2 }}>
                {phoneError}
              </span>
            )}
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="email@exemple.com"
              style={S.input}
            />
          </Field>

          <Field label="Ville" required>
            <input
              required
              value={form.ville}
              onChange={(e) => set('ville', e.target.value)}
              placeholder="Paris"
              style={S.input}
            />
          </Field>

          <Field label="Code postal">
            <input
              value={form.code_postal}
              onChange={(e) => set('code_postal', e.target.value)}
              placeholder="75001"
              style={S.input}
            />
          </Field>

          <Field label="Date de naissance">
            <input
              type="date"
              value={form.date_naissance}
              onChange={(e) => set('date_naissance', e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              style={S.input}
            />
          </Field>

          <Field label="État civil" required>
            <select value={form.etat_civil} onChange={(e) => set('etat_civil', e.target.value as EtatCivil)} style={S.select}>
              {ETAT_CIVIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </SectionCard>

        {/* Section 2 - Phila & Intégration */}
        <SectionCard title="Phila & Intégration">
          <Field label="Statut Phila" required>
            <select value={form.statut_phila} onChange={(e) => set('statut_phila', e.target.value as StatutPhila)} style={S.select}>
              {STATUT_PHILA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>

          {form.statut_phila === 'oui' && (
            <Field label="Extension Phila d'origine">
              <select value={form.extension_phila} onChange={(e) => set('extension_phila', e.target.value as Extension | '')} style={S.select}>
                <option value="">- Non renseigné -</option>
                {(Object.keys(EXTENSION_LABELS) as Extension[]).map(k => (
                  <option key={k} value={k}>{EXTENSION_LABELS[k]}</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Profil" note="Calculé depuis statut Phila + autre église">
            <div style={{
              padding: '8px 14px', borderRadius: '8px', fontSize: '0.875rem',
              background: PROFIL_BADGE[form.profil].bg,
              color:      PROFIL_BADGE[form.profil].text,
              fontWeight: 600, border: '1px solid transparent',
            }}>
              {PROFIL_LABELS[form.profil]}
            </div>
          </Field>

          <Field label="Statut contact" required>
            <select value={form.statut} onChange={(e) => set('statut', e.target.value as StatutContact)} style={S.select}>
              {STATUT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>

          <Field label="Campus" required>
            <select value={form.campus} onChange={(e) => set('campus', e.target.value as Campus)} style={S.select}>
              {CAMPUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>

          <Field label="Canal de contact" required>
            <select value={form.canal} onChange={(e) => set('canal', e.target.value as Canal)} style={S.select}>
              <option value="presentiel">Présentiel</option>
              <option value="en_ligne">En ligne</option>
            </select>
          </Field>
        </SectionCard>

        {/* Section 3A - Détails Membre Phila */}
        {isMembre && (
          <SectionCard title="Détails - Membre Phila">
            <Field label="Intérêt pour une cellule">
              <select value={form.interet_cellule} onChange={(e) => set('interet_cellule', e.target.value as InteretCellule | '')} style={S.select}>
                <option value="">- Non renseigné -</option>
                {(Object.keys(INTERET_CELLULE_LABELS) as InteretCellule[]).map(k => (
                  <option key={k} value={k}>{INTERET_CELLULE_LABELS[k]}</option>
                ))}
              </select>
            </Field>

            <Field label="Comment a-t-il / elle connu l'église ?">
              <input
                value={form.comment_connu}
                onChange={(e) => set('comment_connu', e.target.value)}
                placeholder="Bouche à oreille, réseaux sociaux…"
                style={S.input}
              />
            </Field>
          </SectionCard>
        )}

        {/* Section 3B - Détails Visiteur */}
        {!isMembre && (
          <SectionCard title="Détails - Visiteur">
            <Field label="Souhait principal">
              <select value={form.souhait} onChange={(e) => set('souhait', e.target.value as Souhait | '')} style={S.select}>
                <option value="">- Non renseigné -</option>
                {(Object.keys(SOUHAIT_LABELS) as Souhait[]).map(k => (
                  <option key={k} value={k}>{SOUHAIT_LABELS[k]}</option>
                ))}
              </select>
            </Field>

            <Field label="Besoins spirituels" fullWidth>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '2px' }}>
                {(Object.keys(BESOIN_LABELS) as BesoinSpirituel[]).map(b => (
                  <label key={b} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={form.besoins.includes(b)}
                      onChange={() => toggleBesoin(b)}
                      style={{ accentColor: 'var(--accent-teal)', width: '15px', height: '15px', cursor: 'pointer' }}
                    />
                    {BESOIN_LABELS[b]}
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Fréquente une autre église">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={form.autre_eglise}
                  onChange={(e) => set('autre_eglise', e.target.checked)}
                  style={{ accentColor: 'var(--accent-teal)', width: '15px', height: '15px', cursor: 'pointer' }}
                />
                Oui
              </label>
            </Field>

            {form.autre_eglise && (
              <>
                <Field label="Nom de l'autre église">
                  <input
                    value={form.nom_autre_eglise}
                    onChange={(e) => set('nom_autre_eglise', e.target.value)}
                    style={S.input}
                  />
                </Field>

                <Field label="Sert dans l'autre église">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)', marginTop: '4px' }}>
                    <input
                      type="checkbox"
                      checked={form.sert_autre_eglise}
                      onChange={(e) => set('sert_autre_eglise', e.target.checked)}
                      style={{ accentColor: 'var(--accent-teal)', width: '15px', height: '15px', cursor: 'pointer' }}
                    />
                    Oui
                  </label>
                </Field>

                {form.sert_autre_eglise && (
                  <Field label="Service dans l'autre église">
                    <input
                      value={form.service_autre_eglise}
                      onChange={(e) => set('service_autre_eglise', e.target.value)}
                      placeholder="Louange, accueil…"
                      style={S.input}
                    />
                  </Field>
                )}
              </>
            )}
          </SectionCard>
        )}

        {/* Section 4 - Suivi */}
        <SectionCard title="Suivi & Accompagnement">
          <Field label="RDV avec le pasteur">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)', marginTop: '4px' }}>
              <input
                type="checkbox"
                checked={form.rdv_pasteur}
                onChange={(e) => set('rdv_pasteur', e.target.checked)}
                style={{ accentColor: 'var(--accent-teal)', width: '15px', height: '15px', cursor: 'pointer' }}
              />
              A eu ou souhaite un RDV
            </label>
          </Field>

          <Field label="Don / Offrande">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)', marginTop: '4px' }}>
              <input
                type="checkbox"
                checked={form.don}
                onChange={(e) => set('don', e.target.checked)}
                style={{ accentColor: 'var(--accent-teal)', width: '15px', height: '15px', cursor: 'pointer' }}
              />
              A fait un don / une offrande
            </label>
          </Field>

          <Field label="Disponibilité pour le suivi">
            <select value={form.disponibilite_suivi} onChange={(e) => set('disponibilite_suivi', e.target.value as DisponibiliteSuivi | '')} style={S.select}>
              <option value="">- Non renseigné -</option>
              {(Object.keys(DISPO_LABELS) as DisponibiliteSuivi[]).map(k => (
                <option key={k} value={k}>{DISPO_LABELS[k]}</option>
              ))}
            </select>
          </Field>

          <Field label="Saisi par un membre">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)', marginTop: '4px' }}>
              <input
                type="checkbox"
                checked={form.saisi_par_membre}
                onChange={(e) => set('saisi_par_membre', e.target.checked)}
                style={{ accentColor: 'var(--accent-teal)', width: '15px', height: '15px', cursor: 'pointer' }}
              />
              Fiche créée par un membre (pas par l'intégration)
            </label>
          </Field>
        </SectionCard>

        {/* Footer boutons */}
        <div style={{
          display: 'flex', gap: '12px', justifyContent: 'flex-end',
          padding: '20px 0 8px',
        }}>
          <button
            type="button"
            onClick={() => navigate('/contacts')}
            disabled={saving}
            style={{
              padding: '10px 22px', borderRadius: '8px',
              border: '1px solid var(--bg-card-border)', background: 'transparent',
              color: 'var(--text-primary)', fontSize: '0.875rem',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
              transition: '120ms ease',
            }}
          >
            Annuler
          </button>

          <button
            type="submit"
            disabled={saving || phoneError !== null}
            style={{
              padding: '10px 24px', borderRadius: '8px',
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
              border: '1px solid var(--accent-teal)', fontSize: '0.875rem', fontWeight: 600,
              cursor: saving || phoneError !== null ? 'not-allowed' : 'pointer',
              opacity: saving || phoneError !== null ? 0.7 : 1,
              boxShadow: '0 0 10px rgba(26,86,176,0.18)', transition: '120ms ease',
            }}
          >
            {saving ? 'Création…' : 'Créer le contact'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  input: {
    padding: '8px 12px',
    border: '1px solid var(--bg-input-border)', borderRadius: '8px',
    background: 'var(--bg-input)', color: 'var(--text-primary)',
    fontSize: '0.875rem', outline: 'none', width: '100%', boxSizing: 'border-box' as const,
    transition: '120ms ease',
  } as React.CSSProperties,
  select: {
    padding: '8px 12px',
    border: '1px solid var(--bg-input-border)', borderRadius: '8px',
    background: 'var(--bg-input)', color: 'var(--text-primary)',
    fontSize: '0.875rem', outline: 'none', width: '100%', cursor: 'pointer',
  } as React.CSSProperties,
} as const;
