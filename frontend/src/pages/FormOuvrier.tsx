// src/pages/FormOuvrier.tsx
// Formulaire public multi-étapes pour les candidatures au service (ouvriers).
// Route publique - /form/ouvrier.
//
// Étapes :
//   1. Identité    - genre, prénom, nom, téléphone (vérif doublon), email
//   2. Localisation - ville, code postal, campus
//   3. Services    - domaines souhaités (au moins 1)
//   4. Expérience  - déjà servi ? église/service précédents, motivation
//   5. Finalisation - RGPD + soumission
//
// Après soumission : POST /api/ouvriers/candidature → redirect /success-ouvrier

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import api from '../services/api';
import { Turnstile } from '@marsidev/react-turnstile';
import Logo from '../components/ui/Logo';
import Footer from '../components/common/Footer';
import { validatePhone, normalizePhone } from '../utils/phone';

// ─── Constantes ───────────────────────────────────────────────────────────────

const TURNSTILE_SITE_KEY = (import.meta as unknown as { env: Record<string, string> }).env.VITE_TURNSTILE_SITE_KEY ?? '2x00000000000000000000AB';

const PREFIXES = [
{ code: '+213', label: '+213 Algérie' },
  { code: '+49',  label: '+49 Allemagne' },
  { code: '+376', label: '+376 Andorre' },
  { code: '+43',  label: '+43 Autriche' },
  { code: '+32',  label: '+32 Belgique' },
  { code: '+229', label: '+229 Bénin' },
  { code: '+375', label: '+375 Biélorussie' },
  { code: '+387', label: '+387 Bosnie-Herzégovine' },
  { code: '+359', label: '+359 Bulgarie' },
  { code: '+226', label: '+226 Burkina Faso' },
  { code: '+237', label: '+237 Cameroun' },
  { code: '+236', label: '+236 Centrafrique' },
  { code: '+357', label: '+357 Chypre' },
  { code: '+242', label: '+242 Congo Brazzaville' },
  { code: '+225', label: "+225 Côte d'Ivoire" },
  { code: '+385', label: '+385 Croatie' },
  { code: '+45',  label: '+45 Danemark' },
  { code: '+34',  label: '+34 Espagne' },
  { code: '+372', label: '+372 Estonie' },
  { code: '+358', label: '+358 Finlande' },
  { code: '+33',  label: '+33 France' },
  { code: '+241', label: '+241 Gabon' },
  { code: '+30',  label: '+30 Grèce' },
  { code: '+590', label: '+590 Guadeloupe' },
  { code: '+224', label: '+224 Guinée' },
  { code: '+594', label: '+594 Guyane' },
  { code: '+509', label: '+509 Haïti' },
  { code: '+36',  label: '+36 Hongrie' },
  { code: '+353', label: '+353 Irlande' },
  { code: '+354', label: '+354 Islande' },
  { code: '+39',  label: '+39 Italie' },
  { code: '+383', label: '+383 Kosovo' },
  { code: '+371', label: '+371 Lettonie' },
  { code: '+423', label: '+423 Liechtenstein' },
  { code: '+370', label: '+370 Lituanie' },
  { code: '+352', label: '+352 Luxembourg' },
  { code: '+389', label: '+389 Macédoine du Nord' },
  { code: '+223', label: '+223 Mali' },
  { code: '+356', label: '+356 Malte' },
  { code: '+212', label: '+212 Maroc' },
  { code: '+596', label: '+596 Martinique' },
  { code: '+373', label: '+373 Moldavie' },
  { code: '+377', label: '+377 Monaco' },
  { code: '+382', label: '+382 Monténégro' },
  { code: '+47',  label: '+47 Norvège' },
  { code: '+31',  label: '+31 Pays-Bas' },
  { code: '+48',  label: '+48 Pologne' },
  { code: '+351', label: '+351 Portugal' },
  { code: '+243', label: '+243 RD Congo' },
  { code: '+420', label: '+420 République tchèque' },
  { code: '+40',  label: '+40 Roumanie' },
  { code: '+44',  label: '+44 Royaume-Uni' },
  { code: '+7',   label: '+7 Russie' },
  { code: '+378', label: '+378 Saint-Marin' },
  { code: '+221', label: '+221 Sénégal' },
  { code: '+381', label: '+381 Serbie' },
  { code: '+421', label: '+421 Slovaquie' },
  { code: '+386', label: '+386 Slovénie' },
  { code: '+46',  label: '+46 Suède' },
  { code: '+41',  label: '+41 Suisse' },
  { code: '+235', label: '+235 Tchad' },
  { code: '+228', label: '+228 Togo' },
  { code: '+216', label: '+216 Tunisie' },
  { code: '+380', label: '+380 Ukraine' },
  { code: '+1',   label: '+1 USA / Canada' },
  { code: '+379', label: '+379 Vatican' },
];

const SERVICES_CANDIDATURE = [
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

const TOTAL_STEPS = 5;
const STEP_TITLES = [
  'Votre identité',
  'Localisation',
  'Services souhaités',
  'Votre expérience',
  'Finalisation',
];

// ─── Sous-composants ──────────────────────────────────────────────────────────

function Field({ label, required, hint, error, children }: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          {label}
          {required && <span style={{ color: 'var(--accent-violet)', marginLeft: 2 }}>*</span>}
        </label>
      )}
      {children}
      {hint && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{hint}</span>}
      {error && <span style={{ fontSize: 12, color: '#DC2626' }}>{error}</span>}
    </div>
  );
}

function TxtInput({ value, onChange, placeholder, type = 'text', disabled, hasError, onBlur }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  hasError?: boolean;
  onBlur?: () => void;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        padding: '12px 14px', borderRadius: 8,
        border: hasError ? '1px solid var(--accent-red)' : '1px solid var(--bg-input-border)',
        background: disabled ? 'var(--bg-secondary)' : 'var(--bg-input)',
        color: 'var(--text-primary)',
        fontSize: 15, width: '100%', boxSizing: 'border-box',
        fontFamily: 'inherit', outline: 'none',
      }}
    />
  );
}

function OptionBtn({ selected, onClick, children }: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: '1 1 calc(50% - 4px)', padding: '12px 10px', borderRadius: 8,
        border: `2px solid ${selected ? 'var(--accent-violet)' : 'var(--bg-input-border)'}`,
        background: selected ? 'var(--badge-integre-bg)' : 'var(--bg-card)',
        color: selected ? 'var(--badge-integre-text)' : 'var(--text-primary)',
        fontSize: 14, fontWeight: selected ? 700 : 500,
        cursor: 'pointer', textAlign: 'center',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function CheckCard({ selected, onClick, children }: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px', borderRadius: 8, width: '100%', textAlign: 'left',
        border: `2px solid ${selected ? 'var(--accent-violet)' : 'var(--bg-input-border)'}`,
        background: selected ? 'var(--badge-integre-bg)' : 'var(--bg-card)',
        color: selected ? 'var(--badge-integre-text)' : 'var(--text-primary)',
        fontSize: 14, fontWeight: selected ? 700 : 500,
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <span style={{
        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
        border: `2px solid ${selected ? 'var(--accent-violet)' : 'var(--bg-input-border)'}`,
        background: selected ? 'var(--accent-violet)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {selected && <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>✓</span>}
      </span>
      {children}
    </button>
  );
}

// ─── État formulaire ──────────────────────────────────────────────────────────

interface FormState {
  genre:            'homme' | 'femme' | '';
  prenom:           string;
  nom:              string;
  prefix:           string;
  phone:            string;
  email:            string;
  date_naissance:   string;
  ville:            string;
  code_postal:      string;
  campus:           string;
  services:         string[];
  a_deja_servi:     boolean | null;
  eglise_precedente: string;
  service_precedent: string;
  motivation:       string;
  consentement_rgpd: boolean;
}

const INIT: FormState = {
  genre: '', prenom: '', nom: '', prefix: '+33', phone: '', email: '',
  date_naissance: '',
  ville: '', code_postal: '', campus: 'paris',
  services: [],
  a_deja_servi: null, eglise_precedente: '', service_precedent: '',
  motivation: '', consentement_rgpd: false,
};

// ─── Composant principal ──────────────────────────────────────────────────────

export default function FormOuvrier() {
  const navigate = useNavigate();

  const [step, setStep]         = useState(1);
  const [form, setForm]         = useState<FormState>(INIT);
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [phoneCheck, setPhoneCheck] = useState<{ loading: boolean; exists: boolean }>({
    loading: false, exists: false,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
    setErrors(prev => ({ ...prev, [k]: '' }));
  }

  function toggleMulti(field: 'services', value: string) {
    setForm(prev => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
      };
    });
    setErrors(prev => ({ ...prev, [field]: '' }));
  }

  // ── Vérification doublon téléphone (debounced 600 ms) ────────────────────
  useEffect(() => {
    const fullPhone = normalizePhone(form.prefix, form.phone.trim());
    if (form.phone.trim().length < 6) {
      setPhoneCheck({ loading: false, exists: false });
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setPhoneCheck({ loading: true, exists: false });
      try {
        const res = await api.get('/ouvriers/check-phone', {
          params: { phone: fullPhone },
        });
        setPhoneCheck({ loading: false, exists: res.data.exists });
      } catch {
        setPhoneCheck({ loading: false, exists: false });
      }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [form.phone, form.prefix]);

  // ── Validation par étape ──────────────────────────────────────────────────
  function validate(s: number): boolean {
    const e: Record<string, string> = {};

    if (s === 1) {
      if (!form.genre)          e.genre  = 'Veuillez sélectionner votre genre.';
      if (!form.prenom.trim())  e.prenom = 'Le prénom est obligatoire.';
      if (!form.nom.trim())     e.nom    = 'Le nom est obligatoire.';
      if (!form.phone.trim()) {
        e.phone = 'Le numéro de téléphone est obligatoire.';
      } else {
        const fmtErr = validatePhone(form.prefix, form.phone);
        if (fmtErr) e.phone = fmtErr;
        else if (phoneCheck.exists) e.phone = 'Ce numéro est déjà enregistré.';
      }
    }
    if (s === 2) {
      if (!form.ville.trim())   e.ville  = 'La ville est obligatoire.';
      if (!form.campus)         e.campus = 'Le campus est obligatoire.';
    }
    if (s === 3) {
      if (form.services.length === 0) e.services = 'Veuillez sélectionner au moins un service.';
    }
    if (s === 4) {
      if (form.a_deja_servi === null) e.a_deja_servi = 'Veuillez répondre à cette question.';
    }
    if (s === 5) {
      if (!form.consentement_rgpd) e.consentement_rgpd = 'Le consentement RGPD est obligatoire.';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() {
    if (!validate(step)) return;
    setStep(s => s + 1);
    window.scrollTo(0, 0);
  }

  function handlePrev() {
    setStep(s => s - 1);
    setErrors({});
    window.scrollTo(0, 0);
  }

  // ── Soumission ────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate(5)) return;
    // Honeypot : si rempli, bot détecté - on abandonne silencieusement
    if (honeypot !== '') return;
    setSubmitting(true);

    try {
      // On utilise axios directement pour pouvoir inclure turnstile_token et website
      await api.post('/ouvriers/candidature', {
        genre:             form.genre || undefined,
        prenom:            form.prenom.trim(),
        nom:               form.nom.trim(),
        telephone:         normalizePhone(form.prefix, form.phone.trim()),
        email:             form.email.trim() || undefined,
        date_naissance:    form.date_naissance || undefined,
        ville:             form.ville.trim(),
        code_postal:       form.code_postal.trim() || undefined,
        campus:            form.campus,
        disponibilites:    [],
        services:          form.services,
        a_deja_servi:      form.a_deja_servi ?? false,
        eglise_precedente: form.eglise_precedente.trim() || undefined,
        service_precedent: form.service_precedent.trim() || undefined,
        motivation:        form.motivation.trim() || undefined,
        consentement_rgpd: true,
        turnstile_token:   turnstileToken,
        website:           honeypot, // toujours vide pour les humains
      });
      navigate('/success-ouvrier');
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setErrors({ phone: 'Ce numéro est déjà enregistré.' });
        setStep(1);
        window.scrollTo(0, 0);
      } else {
        console.error('Erreur soumission:', err);
        console.error('Response data:', (err as any)?.response?.data);
        console.error('Status:', (err as any)?.response?.status);
        setErrors({ _form: 'Une erreur est survenue. Veuillez réessayer.' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Rendu des étapes ──────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Field label="Genre" required error={errors.genre}>
          <div style={{ display: 'flex', gap: 8 }}>
            <OptionBtn selected={form.genre === 'homme'} onClick={() => set('genre', 'homme')}>
              Homme
            </OptionBtn>
            <OptionBtn selected={form.genre === 'femme'} onClick={() => set('genre', 'femme')}>
              Femme
            </OptionBtn>
          </div>
        </Field>

        <Field label="Prénom" required error={errors.prenom}>
          <TxtInput value={form.prenom} onChange={v => set('prenom', v)} placeholder="Votre prénom" />
        </Field>

        <Field label="Nom" required error={errors.nom}>
          <TxtInput value={form.nom} onChange={v => set('nom', v)} placeholder="Votre nom de famille" />
        </Field>

        <Field label="Téléphone" required error={phoneError ?? errors.phone}>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              aria-label="Indicatif téléphonique du pays"
              value={form.prefix}
              onChange={e => {
                const newPrefix = e.target.value;
                set('prefix', newPrefix);
                if (form.phone.trim()) setPhoneError(validatePhone(newPrefix, form.phone));
              }}
              style={{
                padding: '12px 8px', borderRadius: 8,
                border: '1px solid var(--bg-input-border)',
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                fontSize: 13, width: 130, flexShrink: 0, fontFamily: 'inherit',
              }}
            >
              {PREFIXES.map(p => (
                <option key={p.code} value={p.code}>{p.label}</option>
              ))}
            </select>
            <TxtInput
              value={form.phone}
              onChange={v => {
                set('phone', v);
                setPhoneError(v.trim() ? validatePhone(form.prefix, v) : null);
              }}
              onBlur={() => {
                if (form.phone.trim()) setPhoneError(validatePhone(form.prefix, form.phone));
              }}
              hasError={phoneError !== null}
              type="tel"
              placeholder="6 12 34 56 78"
            />
          </div>
          {phoneCheck.loading && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Vérification…</span>
          )}
          {!phoneCheck.loading && phoneCheck.exists && (
            <span style={{ fontSize: 12, color: '#DC2626' }}>Ce numéro est déjà enregistré.</span>
          )}
        </Field>

        <Field label="Email" error={errors.email}>
          <TxtInput
            value={form.email}
            onChange={v => set('email', v)}
            type="email"
            placeholder="votre@email.com (facultatif)"
          />
        </Field>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Field label="Ville" required error={errors.ville}>
          <TxtInput value={form.ville} onChange={v => set('ville', v)} placeholder="Paris" />
        </Field>

        <Field label="Code postal" error={errors.code_postal}>
          <TxtInput
            value={form.code_postal}
            onChange={v => set('code_postal', v)}
            placeholder="75001 (facultatif)"
          />
        </Field>

        <Field label="Date de naissance" hint="Facultatif - utilisée pour vous souhaiter un joyeux anniversaire">
          <input
            type="date"
            value={form.date_naissance}
            onChange={e => set('date_naissance', e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            style={{
              padding: '12px 14px', borderRadius: 8,
              border: '1px solid var(--bg-input-border)',
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              fontSize: 15, width: '100%', boxSizing: 'border-box' as const,
              fontFamily: 'inherit', outline: 'none',
            }}
          />
        </Field>

        <Field label="Campus" required error={errors.campus}>
          <div style={{ display: 'flex', gap: 8 }}>
            <OptionBtn selected={form.campus === 'paris'} onClick={() => set('campus', 'paris')}>
              Paris
            </OptionBtn>
            <OptionBtn selected={form.campus === 'paris_nord'} onClick={() => set('campus', 'paris_nord')}>
              Paris Nord
            </OptionBtn>
          </div>
        </Field>
      </div>
    );
  }

  function renderStep3() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: '0 0 4px', fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Dans quel(s) domaine(s) souhaitez-vous servir ?
          <span style={{ color: 'var(--accent-violet)', marginLeft: 2 }}>*</span>
        </p>
        {errors.services && (
          <span style={{ fontSize: 12, color: '#DC2626' }}>{errors.services}</span>
        )}
        {SERVICES_CANDIDATURE.map(s => (
          <CheckCard
            key={s.value}
            selected={form.services.includes(s.value)}
            onClick={() => toggleMulti('services', s.value)}
          >
            {s.label}
          </CheckCard>
        ))}
      </div>
    );
  }

  function renderStep4() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Field label="Avez-vous déjà servi dans une église ?" required error={errors.a_deja_servi}>
          <div style={{ display: 'flex', gap: 8 }}>
            <OptionBtn
              selected={form.a_deja_servi === true}
              onClick={() => set('a_deja_servi', true)}
            >
              Oui
            </OptionBtn>
            <OptionBtn
              selected={form.a_deja_servi === false}
              onClick={() => set('a_deja_servi', false)}
            >
              Non
            </OptionBtn>
          </div>
        </Field>

        {form.a_deja_servi === true && (
          <>
            <Field label="Dans quelle église ?" error={errors.eglise_precedente}>
              <TxtInput
                value={form.eglise_precedente}
                onChange={v => set('eglise_precedente', v)}
                placeholder="Nom de l'église"
              />
            </Field>

            <Field label="Quel service exerciez-vous ?" error={errors.service_precedent}>
              <TxtInput
                value={form.service_precedent}
                onChange={v => set('service_precedent', v)}
                placeholder="Ex : Accueil, Louange…"
              />
            </Field>
          </>
        )}

        <Field label="Motivations / Témoignage">
          <textarea
            value={form.motivation}
            onChange={e => set('motivation', e.target.value)}
            placeholder="Partagez ce qui vous motive à servir…"
            rows={5}
            style={{
              padding: '12px 14px', borderRadius: 8,
              border: '1px solid var(--bg-input-border)',
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              fontSize: 15, width: '100%', boxSizing: 'border-box',
              fontFamily: 'inherit', resize: 'vertical', outline: 'none',
              lineHeight: 1.6,
            }}
          />
        </Field>
      </div>
    );
  }

  function renderStep5() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* Récapitulatif */}
        <div style={{
          padding: '16px', borderRadius: 10,
          background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-violet)', marginBottom: 10 }}>
            Récapitulatif de votre candidature
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-primary)' }}>
            <div><strong>Nom :</strong> {form.prenom} {form.nom}</div>
            <div><strong>Téléphone :</strong> {form.prefix}{form.phone}</div>
            {form.email && <div><strong>Email :</strong> {form.email}</div>}
            <div><strong>Ville :</strong> {form.ville}</div>
            <div><strong>Campus :</strong> {form.campus === 'paris' ? 'Paris' : 'Paris Nord'}</div>
            <div><strong>Services :</strong> {form.services.map(s =>
              SERVICES_CANDIDATURE.find(x => x.value === s)?.label).join(', ')}</div>
          </div>
        </div>

        {/* RGPD */}
        <Field label="" error={errors.consentement_rgpd}>
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            cursor: 'pointer', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6,
          }}>
            <input
              type="checkbox"
              checked={form.consentement_rgpd}
              onChange={e => set('consentement_rgpd', e.target.checked)}
              style={{ marginTop: 3, accentColor: 'var(--accent-violet)', flexShrink: 0, cursor: 'pointer' }}
            />
            <span>
              J'accepte que mes données soient utilisées conformément à notre{' '}
              <a href="/politique-confidentialite" target="_blank" rel="noreferrer"
                 style={{ color: 'var(--accent-violet)' }}>
                politique de confidentialité
              </a>
              {' '}et aux{' '}
              <a href="/mentions-legales" target="_blank" rel="noreferrer"
                 style={{ color: 'var(--accent-violet)' }}>
                mentions légales
              </a>.{' '}
              <strong>(Obligatoire)</strong>
            </span>
          </label>
        </Field>

        {/* Honeypot - invisible pour les humains, piège pour les bots */}
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={e => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ display: 'none', position: 'absolute', left: '-9999px' }}
        />

        {/* Turnstile anti-bot Cloudflare - mode invisible */}
        <Turnstile
          siteKey={TURNSTILE_SITE_KEY}
          onSuccess={token => {
            console.log('Turnstile token recu:', token);
            setTurnstileToken(token);
          }}
          onExpire={() => setTurnstileToken(null)}
          options={{ size: 'invisible', execution: 'render', theme: 'auto', language: 'fr' }}
        />

        {errors._form && (
          <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: '#FEF2F2', border: '1px solid #FECACA',
            color: '#DC2626', fontSize: 13,
          }}>
            {errors._form}
          </div>
        )}
      </div>
    );
  }

  const stepContent = [
    renderStep1, renderStep2, renderStep3,
    renderStep4, renderStep5,
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '24px 16px 48px',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 10, marginBottom: 28,
      }}>
        <Logo width={52} height={52} />
        <span style={{
          padding: '4px 14px', borderRadius: 20,
          background: 'var(--badge-integre-bg)', color: 'var(--badge-integre-text)',
          fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
        }}>
          Candidature Ouvrier
        </span>
      </div>

      {/* Carte formulaire */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
        borderRadius: 16, padding: '28px 24px',
        maxWidth: 480, width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>

        {/* Barre de progression */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8,
          }}>
            <span style={{ fontWeight: 700, color: 'var(--accent-violet)' }}>
              Étape {step} / {TOTAL_STEPS}
            </span>
            <span>{STEP_TITLES[step - 1]}</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-input-border)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3, background: 'var(--accent-violet)',
              width: `${(step / TOTAL_STEPS) * 100}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* Contenu de l'étape */}
        <form onSubmit={handleSubmit}>
          {stepContent[step - 1]()}

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
            {step > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 8,
                  border: '1px solid var(--bg-input-border)',
                  background: 'var(--bg-card)', color: 'var(--text-primary)',
                  fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                ← Retour
              </button>
            )}

            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={step === 1 && phoneError !== null}
                style={{
                  flex: 2, padding: '13px 0', borderRadius: 8, border: 'none',
                  background: step === 1 && phoneError !== null ? 'var(--text-secondary)' : 'var(--accent-violet)',
                  color: '#fff',
                  fontSize: 15, fontWeight: 700,
                  cursor: step === 1 && phoneError !== null ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Continuer →
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting || !turnstileToken}
                style={{
                  flex: 2, padding: '13px 0', borderRadius: 8, border: 'none',
                  background: 'var(--accent-violet)', color: '#fff',
                  fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
                  cursor: (submitting || !turnstileToken) ? 'not-allowed' : 'pointer',
                  opacity: (submitting || !turnstileToken) ? 0.7 : 1,
                }}
              >
                {submitting ? 'Envoi en cours…' : 'Soumettre ma candidature'}
              </button>
            )}
          </div>
        </form>
      </div>

      <Footer />
    </div>
  );
}
