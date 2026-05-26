// src/pages/FormEnLigne.tsx
// Formulaire d'inscription en ligne - public (sans auth), optimisé mobile.
// 6 étapes : Identité → Localisation → Disponibilité suivi → Relation Phila → Parcours (A ou B) → Finalisation.
//
// Différences vs FormPresentiel :
//   - Icône QR code doré (#D4A24E) + badge "Formulaire en ligne" dans le header
//   - Étape 3 spécifique : disponibilité pour le suivi (message / appel / email)
//   - Branche B souhait : 2 options seulement (devenir_membre, juste_visiter) - pas d'option "servir"
//   - Libellé cellule : "cellule en ligne" au lieu de "cellule de prière"
//   - Pas de champ campus dans le formulaire (assigné par un admin après inscription)
//   - Payload : canal = 'en_ligne', saisi_par_membre = false

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import api from '../services/api';
import { Turnstile } from '@marsidev/react-turnstile';
import Logo from '../components/ui/Logo';
import Footer from '../components/common/Footer';
import { validatePhone, normalizePhone } from '../utils/phone';

const TURNSTILE_SITE_KEY = (import.meta as unknown as { env: Record<string, string> }).env.VITE_TURNSTILE_SITE_KEY ?? '2x00000000000000000000AB';

// ─── Types locaux ─────────────────────────────────────────────────────────────

type Genre              = 'homme' | 'femme';
type EtatCivil          = 'celibataire' | 'fiance' | 'marie' | 'divorce' | 'veuf';
type StatutPhila        = 'oui' | 'non' | 'premiere_visite';
type ExtensionPhila     = 'paris' | 'paris_nord' | 'orleans' | 'montpellier';
type InteretCellule     = 'oui' | 'non' | 'peut_etre';
type SouhaitEnLigne     = 'devenir_membre' | 'juste_visiter'; // 'servir' exclu du formulaire en ligne
type BesoinSpirit       = 'priere' | 'bapteme' | 'suivi' | 'rencontrer_pasteur';
type DisponibiliteSuivi = 'message' | 'appel' | 'email';

// ─── Constantes ───────────────────────────────────────────────────────────────

const GOLD = 'var(--accent-gold)';

// Drapeaux emoji non fiables selon les plateformes - libellés texte uniquement
const PREFIXES = [
  { code: '+33',  label: '+33 France' },
  { code: '+32',  label: '+32 Belgique' },
  { code: '+41',  label: '+41 Suisse' },
  { code: '+352', label: '+352 Luxembourg' },
  { code: '+1',   label: '+1 USA / Canada' },
  { code: '+44',  label: '+44 Royaume-Uni' },
  { code: '+212', label: '+212 Maroc' },
  { code: '+213', label: '+213 Algérie' },
  { code: '+216', label: '+216 Tunisie' },
  { code: '+225', label: "+225 Côte d'Ivoire" },
  { code: '+237', label: '+237 Cameroun' },
  { code: '+243', label: '+243 RD Congo' },
  { code: '+242', label: '+242 Congo Brazzaville' },
  { code: '+221', label: '+221 Sénégal' },
  { code: '+229', label: '+229 Bénin' },
  { code: '+224', label: '+224 Guinée' },
  { code: '+223', label: '+223 Mali' },
  { code: '+226', label: '+226 Burkina Faso' },
  { code: '+228', label: '+228 Togo' },
  { code: '+235', label: '+235 Tchad' },
  { code: '+236', label: '+236 Centrafrique' },
  { code: '+241', label: '+241 Gabon' },
  { code: '+240', label: '+240 Guinée Équatoriale' },
  { code: '+239', label: '+239 Sao Tomé' },
  { code: '+250', label: '+250 Rwanda' },
  { code: '+257', label: '+257 Burundi' },
  { code: '+253', label: '+253 Djibouti' },
  { code: '+261', label: '+261 Madagascar' },
  { code: '+262', label: '+262 Réunion / Mayotte' },
  { code: '+269', label: '+269 Comores' },
  { code: '+509', label: '+509 Haïti' },
  { code: '+596', label: '+596 Martinique' },
  { code: '+590', label: '+590 Guadeloupe' },
  { code: '+594', label: '+594 Guyane' },
  { code: '+376', label: '+376 Andorre' },
  { code: '+43',  label: '+43 Autriche' },
  { code: '+375', label: '+375 Biélorussie' },
  { code: '+387', label: '+387 Bosnie-Herzégovine' },
  { code: '+359', label: '+359 Bulgarie' },
  { code: '+357', label: '+357 Chypre' },
  { code: '+385', label: '+385 Croatie' },
  { code: '+45',  label: '+45 Danemark' },
  { code: '+372', label: '+372 Estonie' },
  { code: '+358', label: '+358 Finlande' },
  { code: '+30',  label: '+30 Grèce' },
  { code: '+36',  label: '+36 Hongrie' },
  { code: '+354', label: '+354 Islande' },
  { code: '+353', label: '+353 Irlande' },
  { code: '+39',  label: '+39 Italie' },
  { code: '+383', label: '+383 Kosovo' },
  { code: '+371', label: '+371 Lettonie' },
  { code: '+423', label: '+423 Liechtenstein' },
  { code: '+370', label: '+370 Lituanie' },
  { code: '+389', label: '+389 Macédoine du Nord' },
  { code: '+356', label: '+356 Malte' },
  { code: '+373', label: '+373 Moldavie' },
  { code: '+377', label: '+377 Monaco' },
  { code: '+382', label: '+382 Monténégro' },
  { code: '+47',  label: '+47 Norvège' },
  { code: '+31',  label: '+31 Pays-Bas' },
  { code: '+48',  label: '+48 Pologne' },
  { code: '+351', label: '+351 Portugal' },
  { code: '+420', label: '+420 République tchèque' },
  { code: '+40',  label: '+40 Roumanie' },
  { code: '+7',   label: '+7 Russie' },
  { code: '+378', label: '+378 Saint-Marin' },
  { code: '+381', label: '+381 Serbie' },
  { code: '+421', label: '+421 Slovaquie' },
  { code: '+386', label: '+386 Slovénie' },
  { code: '+46',  label: '+46 Suède' },
  { code: '+380', label: '+380 Ukraine' },
  { code: '+379', label: '+379 Vatican' },
  { code: '+49',  label: '+49 Allemagne' },
  { code: '+34',  label: '+34 Espagne' },
];

const TOTAL_STEPS = 6;
const STEP_TITLES = [
  'Votre identité',
  'Localisation',
  'Disponibilité pour le suivi',
  'Votre relation avec Phila',
  'Votre parcours',
  'Finalisation',
];

// ─── État formulaire ──────────────────────────────────────────────────────────

interface FormState {
  genre:               Genre | '';
  prenom:              string;
  nom:                 string;
  prefix:              string;
  phone:               string;
  email:               string;
  date_naissance:      string;
  ville:               string;
  code_postal:         string;
  etat_civil:          EtatCivil | '';
  disponibilite_suivi: DisponibiliteSuivi | '';
  statut_phila:        StatutPhila | '';
  // Étape 5 - partagé A et B
  extension_phila: ExtensionPhila | '';
  interet_cellule: InteretCellule | '';
  comment_connu:   string;
  // Étape 5B uniquement
  souhait:              SouhaitEnLigne | '';
  besoins:              BesoinSpirit[];
  autre_eglise:         boolean | null;
  nom_autre_eglise:     string;
  sert_autre_eglise:    boolean | null;
  service_autre_eglise: string;
  // Étape 6
  rdv_pasteur:       boolean | null;
  consentement_rgpd: boolean;
}

const INIT: FormState = {
  genre: '', prenom: '', nom: '', prefix: '+33', phone: '', email: '',
  date_naissance: '',
  ville: '', code_postal: '', etat_civil: '',
  disponibilite_suivi: '',
  statut_phila: '',
  extension_phila: '', interet_cellule: '', comment_connu: '',
  souhait: '', besoins: [], autre_eglise: null,
  nom_autre_eglise: '', sert_autre_eglise: null, service_autre_eglise: '',
  rdv_pasteur: null, consentement_rgpd: false,
};

// ─── Sous-composants ──────────────────────────────────────────────────────────

function Field({ label, required, error, hint, children }: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          {label}
          {required && <span style={{ color: 'var(--accent-red)', marginLeft: 2 }}>*</span>}
        </label>
      )}
      {hint && <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: -2 }}>{hint}</span>}
      {children}
      {error && <span style={{ fontSize: 12, color: 'var(--accent-red)' }}>{error}</span>}
    </div>
  );
}

function OptionBtn({ selected, onClick, children, fullWidth }: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: fullWidth ? '1 1 100%' : '1 1 calc(50% - 4px)',
        padding: '12px 10px',
        borderRadius: 8,
        border: `2px solid ${selected ? GOLD : 'var(--bg-input-border)'}`,
        background: selected ? '#FFF8EC' : 'var(--bg-card)',
        color: selected ? GOLD : 'var(--text-primary)',
        fontSize: 14,
        fontWeight: selected ? 700 : 500,
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'border-color 0.15s, background 0.15s',
        lineHeight: 1.4,
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
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
        padding: '12px 14px',
        borderRadius: 8,
        border: hasError ? '1px solid var(--accent-red)' : '1px solid var(--bg-input-border)',
        background: disabled ? 'var(--bg-secondary)' : 'var(--bg-input)',
        color: 'var(--text-primary)',
        fontSize: 16,
        width: '100%',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        outline: 'none',
      }}
    />
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function FormEnLigne() {
  const navigate = useNavigate();

  const [step, setStep]             = useState(1);
  const [form, setForm]             = useState<FormState>(INIT);
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot]     = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [phoneCheck, setPhoneCheck] = useState<{
    loading: boolean; exists: boolean; id: string | null;
  }>({ loading: false, exists: false, id: null });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const branche: 'A' | 'B' | null =
    form.statut_phila === 'oui' ? 'A' :
    (form.statut_phila === 'non' || form.statut_phila === 'premiere_visite') ? 'B' :
    null;

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
    setErrors(prev => ({ ...prev, [k]: '' }));
  }

  // Vérification doublon téléphone (debounced 600 ms) - même logique que FormPresentiel
  useEffect(() => {
    const fullPhone = normalizePhone(form.prefix, form.phone.trim());
    if (form.phone.trim().length < 6) {
      setPhoneCheck({ loading: false, exists: false, id: null });
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setPhoneCheck(prev => ({ ...prev, loading: true }));
      try {
        const res = await api.get('/contacts/check-phone', {
          params: { phone: fullPhone },
        });
        setPhoneCheck({ loading: false, exists: res.data.exists, id: res.data.id });
      } catch {
        setPhoneCheck({ loading: false, exists: false, id: null });
      }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [form.phone, form.prefix]);

  // ── Validation par étape ──────────────────────────────────────────────────

  function validate(s: number): boolean {
    const e: Record<string, string> = {};

    if (s === 1) {
      if (!form.genre)         e.genre  = 'Veuillez sélectionner votre genre.';
      if (!form.prenom.trim()) e.prenom = 'Le prénom est obligatoire.';
      if (!form.nom.trim())    e.nom    = 'Le nom est obligatoire.';
      if (!form.phone.trim()) {
        e.phone = 'Le numéro de téléphone est obligatoire.';
      } else {
        const fmtErr = validatePhone(form.prefix, form.phone);
        if (fmtErr) e.phone = fmtErr;
      }
    }
    if (s === 2) {
      if (!form.ville.trim()) e.ville     = 'La ville est obligatoire.';
      if (!form.etat_civil)   e.etat_civil = "L'état civil est obligatoire.";
    }
    if (s === 3) {
      if (!form.disponibilite_suivi) e.disponibilite_suivi = 'Veuillez choisir une option.';
    }
    if (s === 4) {
      if (!form.statut_phila) e.statut_phila = 'Veuillez choisir une option.';
    }
    if (s === 5 && branche === 'A') {
      if (!form.extension_phila) e.extension_phila = 'Veuillez sélectionner une extension.';
      if (!form.interet_cellule) e.interet_cellule = 'Veuillez répondre à cette question.';
    }
    if (s === 5 && branche === 'B') {
      if (!form.souhait)              e.souhait      = 'Veuillez choisir une option.';
      if (form.autre_eglise === null) e.autre_eglise = 'Veuillez répondre à cette question.';
    }
    if (s === 6) {
      if (form.rdv_pasteur === null) e.rdv_pasteur       = 'Veuillez répondre à cette question.';
      if (!form.consentement_rgpd)   e.consentement_rgpd = 'Le consentement RGPD est obligatoire pour continuer.';
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
    if (!validate(6)) return;
    // Honeypot : si rempli, bot détecté - on abandonne silencieusement
    if (honeypot !== '') return;
    setSubmitting(true);

    const telephone = normalizePhone(form.prefix, form.phone.trim());

    const payload: Record<string, unknown> = {
      genre:               form.genre,
      prenom:              form.prenom.trim(),
      nom:                 form.nom.trim(),
      telephone,
      email:               form.email.trim() || undefined,
      date_naissance:      form.date_naissance || undefined,
      ville:               form.ville.trim(),
      code_postal:         form.code_postal.trim() || undefined,
      etat_civil:          form.etat_civil,
      disponibilite_suivi: form.disponibilite_suivi,
      statut_phila:        form.statut_phila,
      besoins:             branche === 'A' ? [] : form.besoins,
      rdv_pasteur:         form.rdv_pasteur ?? false,
      consentement_rgpd:   form.consentement_rgpd,
      date_consentement:   new Date().toISOString(),
      canal:               'en_ligne',
      saisi_par_membre:    false,
      // campus non envoyé : le backend applique la valeur par défaut 'paris',
      // mise à jour par un admin après vérification du campus du contact
    };

    if (branche === 'A') {
      if (form.extension_phila)      payload.extension_phila = form.extension_phila;
      if (form.interet_cellule)      payload.interet_cellule = form.interet_cellule;
      if (form.comment_connu.trim()) payload.comment_connu   = form.comment_connu.trim();
    } else {
      if (form.souhait)             payload.souhait = form.souhait;
      payload.autre_eglise = form.autre_eglise ?? false;
      if (form.autre_eglise) {
        if (form.nom_autre_eglise.trim()) payload.nom_autre_eglise = form.nom_autre_eglise.trim();
        payload.sert_autre_eglise = form.sert_autre_eglise ?? false;
        if (form.sert_autre_eglise && form.service_autre_eglise.trim()) {
          payload.service_autre_eglise = form.service_autre_eglise.trim();
        }
      }
      if (form.interet_cellule)      payload.interet_cellule = form.interet_cellule;
      if (form.comment_connu.trim()) payload.comment_connu   = form.comment_connu.trim();
    }

    payload.turnstile_token = turnstileToken;
    payload.website         = honeypot; // toujours vide pour les humains

    console.log('[FormEnLigne] payload envoyé:', payload);
    try {
      await api.post('/contacts', payload);
      navigate('/success');
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setErrors({ phone: 'Ce numéro est déjà enregistré.' });
        setStep(1);
        window.scrollTo(0, 0);
      } else {
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
                padding: '12px 8px',
                borderRadius: 8,
                border: '1px solid var(--bg-input-border)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: 16,
                width: 100,
                flexShrink: 0,
                fontFamily: 'inherit',
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
              placeholder="0612345678"
              type="tel"
            />
          </div>

          {phoneCheck.loading && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Vérification en cours …
            </span>
          )}
          {!phoneCheck.loading && phoneCheck.exists && (
            <div style={{
              marginTop: 8, padding: '12px 14px', borderRadius: 8,
              background: '#fef3c7', border: '1px solid #fcd34d',
              color: '#92400e', fontSize: 13, lineHeight: 1.5,
            }}>
              ⚠️ Ce numéro est déjà enregistré. Souhaitez-vous mettre à jour votre fiche ?
              <br />
              <button
                type="button"
                onClick={() => alert("Un membre de l'équipe vous contactera pour mettre à jour votre fiche.")}
                style={{
                  marginTop: 8, padding: '6px 14px', borderRadius: 6,
                  border: 'none', background: '#b45309', color: '#fff',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Mettre à jour
              </button>
            </div>
          )}
        </Field>

        <Field label="Email" hint="Facultatif">
          <TxtInput
            value={form.email}
            onChange={v => set('email', v)}
            placeholder="votre@email.com"
            type="email"
          />
        </Field>
      </div>
    );
  }

  function renderStep2() {
    const ETATS: { value: EtatCivil; label: string }[] = [
      { value: 'celibataire', label: 'Célibataire' },
      { value: 'fiance',      label: 'Fiancé(e)' },
      { value: 'marie',       label: 'Marié(e)' },
      { value: 'divorce',     label: 'Divorcé(e)' },
      { value: 'veuf',        label: 'Veuf / Veuve' },
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Field label="Ville" required error={errors.ville}>
          <TxtInput value={form.ville} onChange={v => set('ville', v)} placeholder="Ex : Paris" />
        </Field>

        <Field label="Code postal" hint="Facultatif">
          <TxtInput value={form.code_postal} onChange={v => set('code_postal', v)} placeholder="75001" />
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
              fontSize: 16, width: '100%', boxSizing: 'border-box' as const,
              fontFamily: 'inherit', outline: 'none',
            }}
          />
        </Field>

        <Field label="État civil" required error={errors.etat_civil}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ETATS.map(ec => (
              <OptionBtn
                key={ec.value}
                selected={form.etat_civil === ec.value}
                onClick={() => set('etat_civil', ec.value)}
              >
                {ec.label}
              </OptionBtn>
            ))}
          </div>
        </Field>
      </div>
    );
  }

  // Étape spécifique au formulaire en ligne
  function renderStep3() {
    const OPTIONS: { value: DisponibiliteSuivi; icon: string; label: string }[] = [
      { value: 'message', icon: '💬', label: 'Message WhatsApp' },
      { value: 'appel',   icon: '📞', label: 'Appel téléphonique' },
      { value: 'email',   icon: '✉️', label: 'Email' },
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
          Comment préférez-vous être contacté ?
        </p>
        <Field label="" error={errors.disponibilite_suivi}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {OPTIONS.map(opt => {
              const isSelected = form.disponibilite_suivi === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('disponibilite_suivi', opt.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '16px 18px',
                    borderRadius: 10,
                    border: `2px solid ${isSelected ? GOLD : 'var(--bg-input-border)'}`,
                    background: isSelected ? '#FFF8EC' : 'var(--bg-card)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s, background 0.15s',
                    fontFamily: 'inherit',
                    width: '100%',
                  }}
                >
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{opt.icon}</span>
                  <span style={{
                    fontSize: 15,
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? GOLD : 'var(--text-primary)',
                  }}>
                    {opt.label}
                  </span>
                  {isSelected && (
                    <span style={{ marginLeft: 'auto', color: GOLD, fontSize: 18, fontWeight: 700 }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </Field>
      </div>
    );
  }

  function renderStep4() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
          Êtes-vous membre de l'église Phila ?
        </p>
        <Field label="" error={errors.statut_phila}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <OptionBtn selected={form.statut_phila === 'oui'} onClick={() => set('statut_phila', 'oui')} fullWidth>
               Oui, je suis membre Phila
            </OptionBtn>
            <OptionBtn selected={form.statut_phila === 'non'} onClick={() => set('statut_phila', 'non')} fullWidth>
               Non, je ne suis pas membre
            </OptionBtn>
            <OptionBtn selected={form.statut_phila === 'premiere_visite'} onClick={() => set('statut_phila', 'premiere_visite')} fullWidth>
               C'est ma première fois
            </OptionBtn>
          </div>
        </Field>
      </div>
    );
  }

  function renderStep5A() {
    const EXTENSIONS: { value: ExtensionPhila; label: string }[] = [
      { value: 'paris',       label: 'Paris' },
      { value: 'paris_nord',  label: 'Paris Nord' },
      { value: 'orleans',     label: 'Orléans' },
      { value: 'montpellier', label: 'Montpellier' },
    ];
    const INTERETS: { value: InteretCellule; label: string }[] = [
      { value: 'oui',       label: 'Oui' },
      { value: 'non',       label: 'Non' },
      { value: 'peut_etre', label: 'Peut-être' },
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Field label="De quelle extension êtes-vous membre ?" required error={errors.extension_phila}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EXTENSIONS.map(ex => (
              <OptionBtn
                key={ex.value}
                selected={form.extension_phila === ex.value}
                onClick={() => set('extension_phila', ex.value)}
              >
                {ex.label}
              </OptionBtn>
            ))}
          </div>
        </Field>

        <Field label="Seriez-vous intéressé(e) par notre cellule en ligne ?" required error={errors.interet_cellule}>
          <div style={{ display: 'flex', gap: 8 }}>
            {INTERETS.map(i => (
              <OptionBtn
                key={i.value}
                selected={form.interet_cellule === i.value}
                onClick={() => set('interet_cellule', i.value)}
              >
                {i.label}
              </OptionBtn>
            ))}
          </div>
        </Field>

        <Field label="Comment avez-vous connu cette église ?" hint="Facultatif">
          <textarea
            value={form.comment_connu}
            onChange={e => set('comment_connu', e.target.value)}
            placeholder="Par un ami, les réseaux sociaux …"
            rows={3}
            style={txStyle}
          />
        </Field>
      </div>
    );
  }

  function renderStep5B() {
    // 2 options uniquement - "servir/ouvrier" n'est pas proposé via le formulaire en ligne
    const SOUHAITS: { value: SouhaitEnLigne; label: string }[] = [
      { value: 'devenir_membre', label: ' Devenir membre' },
      { value: 'juste_visiter',  label: ' Juste visiter' },
    ];
    const BESOINS: { value: BesoinSpirit; label: string }[] = [
      { value: 'priere',             label: '🙏 Prière' },
      { value: 'bapteme',            label: '💧 Baptême' },
      { value: 'suivi',              label: '📖 Suivi pastoral' },
      { value: 'rencontrer_pasteur', label: '👨‍💼 Rencontrer le pasteur' },
    ];
    const INTERETS: { value: InteretCellule; label: string }[] = [
      { value: 'oui',       label: 'Oui' },
      { value: 'non',       label: 'Non' },
      { value: 'peut_etre', label: 'Peut-être' },
    ];

    function toggleBesoin(b: BesoinSpirit) {
      const next = form.besoins.includes(b)
        ? form.besoins.filter(x => x !== b)
        : [...form.besoins, b];
      set('besoins', next);
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Field label="Je souhaite …" required error={errors.souhait}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SOUHAITS.map(s => (
              <OptionBtn key={s.value} selected={form.souhait === s.value} onClick={() => set('souhait', s.value)} fullWidth>
                {s.label}
              </OptionBtn>
            ))}
          </div>
        </Field>

        <Field label="J'ai besoin de …" hint="Sélection multiple : facultatif">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {BESOINS.map(b => (
              <OptionBtn
                key={b.value}
                selected={form.besoins.includes(b.value)}
                onClick={() => toggleBesoin(b.value)}
              >
                {b.label}
              </OptionBtn>
            ))}
          </div>
        </Field>

        <Field label="Suis-je membre dans une autre église ?" required error={errors.autre_eglise}>
          <div style={{ display: 'flex', gap: 8 }}>
            <OptionBtn selected={form.autre_eglise === true}  onClick={() => set('autre_eglise', true)}>Oui</OptionBtn>
            <OptionBtn selected={form.autre_eglise === false} onClick={() => set('autre_eglise', false)}>Non</OptionBtn>
          </div>
        </Field>

        {form.autre_eglise === true && (
          <>
            <Field label="Nom de l'église" hint="Facultatif">
              <TxtInput value={form.nom_autre_eglise} onChange={v => set('nom_autre_eglise', v)} placeholder="Nom de votre église" />
            </Field>

            <Field label="Servez-vous dans cette église ?">
              <div style={{ display: 'flex', gap: 8 }}>
                <OptionBtn selected={form.sert_autre_eglise === true}  onClick={() => set('sert_autre_eglise', true)}>Oui</OptionBtn>
                <OptionBtn selected={form.sert_autre_eglise === false} onClick={() => set('sert_autre_eglise', false)}>Non</OptionBtn>
              </div>
            </Field>

            {form.sert_autre_eglise === true && (
              <Field label="Précisez le service" hint="Facultatif">
                <TxtInput value={form.service_autre_eglise} onChange={v => set('service_autre_eglise', v)} placeholder="Ex : Louange, accueil, média …" />
              </Field>
            )}
          </>
        )}

        <Field label="Seriez-vous intéressé(e) par notre cellule en ligne ?" hint="Facultatif">
          <div style={{ display: 'flex', gap: 8 }}>
            {INTERETS.map(i => (
              <OptionBtn key={i.value} selected={form.interet_cellule === i.value} onClick={() => set('interet_cellule', i.value)}>
                {i.label}
              </OptionBtn>
            ))}
          </div>
        </Field>

        <Field label="Comment avez-vous connu cette église ?" hint="Facultatif">
          <textarea
            value={form.comment_connu}
            onChange={e => set('comment_connu', e.target.value)}
            placeholder="Par un ami, les réseaux sociaux …"
            rows={3}
            style={txStyle}
          />
        </Field>
      </div>
    );
  }

  function renderStep6() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Field label="Souhaitez-vous un rendez-vous avec le Pasteur ?" required error={errors.rdv_pasteur}>
          <div style={{ display: 'flex', gap: 8 }}>
            <OptionBtn selected={form.rdv_pasteur === true}  onClick={() => set('rdv_pasteur', true)}>Oui</OptionBtn>
            <OptionBtn selected={form.rdv_pasteur === false} onClick={() => set('rdv_pasteur', false)}>Non</OptionBtn>
          </div>
        </Field>

        <div style={{
          padding: 16, borderRadius: 8,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--bg-input-border)',
        }}>
          <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.consentement_rgpd}
              onChange={e => {
                set('consentement_rgpd', e.target.checked);
                setErrors(prev => ({ ...prev, consentement_rgpd: '' }));
              }}
              style={{ marginTop: 3, accentColor: GOLD, width: 18, height: 18, flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              J'accepte que mes données soient utilisées conformément à notre{' '}
              <a href="/politique-confidentialite" target="_blank" rel="noreferrer"
                 style={{ color: 'var(--accent-teal)' }}>
                politique de confidentialité
              </a>
              {' '}et aux{' '}
              <a href="/mentions-legales" target="_blank" rel="noreferrer"
                 style={{ color: 'var(--accent-teal)' }}>
                mentions légales
              </a>.
              <span style={{ color: 'var(--accent-red)' }}> *</span>
            </span>
          </label>
          {errors.consentement_rgpd && (
            <p style={{ fontSize: 12, color: 'var(--accent-red)', margin: '8px 0 0 30px' }}>
              {errors.consentement_rgpd}
            </p>
          )}
        </div>

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
            padding: '12px 14px', borderRadius: 8,
            background: '#fef2f2', border: '1px solid #fca5a5',
            color: '#dc2626', fontSize: 13,
          }}>
            {errors._form}
          </div>
        )}
      </div>
    );
  }

  function renderCurrentStep() {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return branche === 'A' ? renderStep5A() : renderStep5B();
      case 6: return renderStep6();
      default: return null;
    }
  }

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingBottom: 40,
    }}>

      {/* Barre de progression - sticky */}
      <div style={{
        width: '100%',
        background: 'var(--bg-primary)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
      }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>
              Étape {step} / {TOTAL_STEPS}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {STEP_TITLES[step - 1]}
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-input-border)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: GOLD,
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div style={{ width: '100%', maxWidth: 480, padding: '24px 20px 0' }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <Logo width={56} height={56} style={{ marginBottom: 12 }} />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--accent-teal)', letterSpacing: '-0.4px' }}>
            Phila Cité des Adorateurs
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Département de l'Intégration
          </p>
          <div style={{
            marginTop: 10,
            padding: '4px 14px',
            borderRadius: 20,
            background: '#FFF3E0',
            border: `1px solid ${GOLD}`,
            color: GOLD,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}>
            Formulaire en ligne
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Carte étape */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--bg-card-border)',
            borderRadius: 12,
            padding: '24px 20px',
            marginBottom: 16,
          }}>
            <h2 style={{ margin: '0 0 22px', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              {STEP_TITLES[step - 1]}
            </h2>
            {renderCurrentStep()}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 12 }}>
            {step > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                style={{
                  flex: 1, padding: 14, borderRadius: 10,
                  border: '1px solid var(--bg-input-border)',
                  background: 'var(--bg-card)', color: 'var(--text-primary)',
                  fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                ← Précédent
              </button>
            )}

            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={step === 1 && phoneError !== null}
                style={{
                  flex: 1, padding: 14, borderRadius: 10, border: 'none',
                  background: step === 1 && phoneError !== null ? 'var(--text-secondary)' : GOLD,
                  color: '#fff',
                  fontSize: 15, fontWeight: 700,
                  cursor: step === 1 && phoneError !== null ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Suivant →
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting || !turnstileToken}
                style={{
                  flex: 1, padding: 14, borderRadius: 10, border: 'none',
                  background: (submitting || !turnstileToken) ? 'var(--text-secondary)' : GOLD,
                  color: '#fff', fontSize: 15, fontWeight: 700,
                  cursor: (submitting || !turnstileToken) ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {submitting ? 'Envoi en cours …' : 'Soumettre'}
              </button>
            )}
          </div>
        </form>
      </div>

      <Footer />
    </div>
  );
}

// ─── Styles partagés ──────────────────────────────────────────────────────────

const txStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 8,
  border: '1px solid var(--bg-input-border)',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  fontSize: 16,
  width: '100%',
  boxSizing: 'border-box',
  resize: 'vertical',
  fontFamily: 'inherit',
  outline: 'none',
};
