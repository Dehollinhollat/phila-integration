// src/features/ouvriers/OuvrierForm.tsx
// Page de création (/ouvriers/new) et modification (/ouvriers/:id/edit) d'un ouvrier.
// Création : inscription_directe: true (pas de lien contact).
// Modification : PUT /api/ouvriers/:id avec les champs modifiés.

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ouvriersEndpoints } from '../../services/endpoints';

// ─── Constantes ───────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function splitPhone(full: string): { prefix: string; local: string } {
  for (const p of PREFIXES) {
    if (full.startsWith(p.code)) {
      return { prefix: p.code, local: full.slice(p.code.length).trim() };
    }
  }
  return { prefix: '+33', local: full };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
      {children}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%', padding: '8px 10px', borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--surface)', color: 'var(--text-primary)',
        fontSize: 14, boxSizing: 'border-box',
        ...props.style,
      }}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: '100%', padding: '8px 10px', borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--surface)', color: 'var(--text-primary)',
        fontSize: 14, boxSizing: 'border-box',
        ...props.style,
      }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OuvrierForm() {
  const { id } = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const isEdit    = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Form state
  const [prenom,       setPrenom]       = useState('');
  const [nom,          setNom]          = useState('');
  const [prefix,       setPrefix]       = useState('+33');
  const [localPhone,   setLocalPhone]   = useState('');
  const [email,        setEmail]        = useState('');
  const [campus,       setCampus]       = useState('paris');
  const [services,     setServices]     = useState<string[]>([]);
  const [dateDebut,    setDateDebut]    = useState('');

  // Load existing data in edit mode
  useEffect(() => {
    if (!isEdit || !id) return;
    ouvriersEndpoints.get(id)
      .then(res => {
        const o = res.data;
        setPrenom(o.prenom);
        setNom(o.nom);
        const { prefix: p, local } = splitPhone(o.telephone);
        setPrefix(p);
        setLocalPhone(local);
        setEmail(o.email ?? '');
        setCampus(o.campus);
        setServices(o.services ?? []);
        setDateDebut(
          o.date_debut_service
            ? new Date(o.date_debut_service).toISOString().slice(0, 10)
            : ''
        );
      })
      .catch(() => setError('Impossible de charger l\'ouvrier.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  function toggleService(value: string) {
    setServices(prev =>
      prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const telephone = `${prefix}${localPhone.trim()}`;
    if (!prenom.trim() || !nom.trim() || !localPhone.trim() || !campus) {
      setError('Prénom, nom, téléphone et campus sont obligatoires.');
      return;
    }

    setSaving(true);
    try {
      if (isEdit && id) {
        await ouvriersEndpoints.update(id, {
          prenom:              prenom.trim(),
          nom:                 nom.trim(),
          telephone,
          email:               email.trim() || undefined,
          campus:              campus as 'paris' | 'paris_nord',
          services,
          date_debut_service:  dateDebut || undefined,
        });
      } else {
        await ouvriersEndpoints.create({
          prenom:              prenom.trim(),
          nom:                 nom.trim(),
          telephone,
          email:               email.trim() || undefined,
          campus,
          services,
          date_debut_service:  dateDebut || undefined,
          inscription_directe: true,
        });
      }
      navigate('/ouvriers');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Une erreur est survenue.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid var(--border)', borderTopColor: 'var(--accent-teal)',
          animation: 'of-spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes of-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 24px) clamp(12px, 3vw, 32px)', maxWidth: 680, margin: '0 auto' }}>

      {/* Back */}
      <button
        onClick={() => navigate('/ouvriers')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--accent-teal)', fontSize: 14, marginBottom: 20,
          padding: 0, display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        ← Retour aux ouvriers
      </button>

      <h1 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
        {isEdit ? 'Modifier l\'ouvrier' : 'Nouvel ouvrier'}
      </h1>

      {error && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 6,
          background: '#fef2f2', border: '1px solid #fca5a5',
          color: '#b91c1c', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 24,
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>

          {/* Prénom / Nom */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <FieldLabel required>Prénom</FieldLabel>
              <Input
                type="text"
                value={prenom}
                onChange={e => setPrenom(e.target.value)}
                placeholder="Jean"
                autoFocus
              />
            </div>
            <div>
              <FieldLabel required>Nom</FieldLabel>
              <Input
                type="text"
                value={nom}
                onChange={e => setNom(e.target.value)}
                placeholder="Dupont"
              />
            </div>
          </div>

          {/* Téléphone */}
          <div>
            <FieldLabel required>Téléphone</FieldLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <Select
                value={prefix}
                onChange={e => setPrefix(e.target.value)}
                style={{ width: 180, flexShrink: 0 }}
              >
                {PREFIXES.map(p => (
                  <option key={p.code} value={p.code}>{p.label}</option>
                ))}
              </Select>
              <Input
                type="tel"
                value={localPhone}
                onChange={e => setLocalPhone(e.target.value)}
                placeholder="6 12 34 56 78"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <FieldLabel>Email</FieldLabel>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jean.dupont@email.com"
            />
          </div>

          {/* Campus */}
          <div>
            <FieldLabel required>Campus</FieldLabel>
            <Select value={campus} onChange={e => setCampus(e.target.value)}>
              <option value="paris">Paris</option>
              <option value="paris_nord">Paris Nord</option>
            </Select>
          </div>

          {/* Services */}
          <div>
            <FieldLabel>Services</FieldLabel>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '8px 16px',
              padding: '12px 14px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface-hover)',
            }}>
              {SERVICES_LIST.map(s => (
                <label
                  key={s.value}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={services.includes(s.value)}
                    onChange={() => toggleService(s.value)}
                    style={{ accentColor: 'var(--accent-teal)', cursor: 'pointer' }}
                  />
                  {s.label}
                </label>
              ))}
            </div>
            {services.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                {services.length} service{services.length > 1 ? 's' : ''} sélectionné{services.length > 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Date de début */}
          <div>
            <FieldLabel>Date de début de service</FieldLabel>
            <Input
              type="date"
              value={dateDebut}
              onChange={e => setDateDebut(e.target.value)}
              style={{ maxWidth: 220 }}
            />
          </div>

        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => navigate('/ouvriers')}
            style={{
              padding: '8px 20px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text-primary)',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '8px 24px', borderRadius: 6, border: 'none',
              background: 'var(--accent-teal)', color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer l\'ouvrier'}
          </button>
        </div>
      </form>
    </div>
  );
}
