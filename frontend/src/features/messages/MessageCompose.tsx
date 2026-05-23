// src/features/messages/MessageCompose.tsx
// Page de composition d'un message événement ou actualité avec ciblage avancé.
// Accessible uniquement aux admin_campus et super_admin.
//
// Deux colonnes :
//   Gauche (40%) — configuration (type, titre, date, planification)
//                + filtres destinataires avec compteur temps réel (debounce 500ms)
//   Droite (60%) — zone de rédaction avec insertion de variables + aperçu live

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { messagesEndpoints, contactsEndpoints, ouvriersEndpoints } from '../../services/endpoints';
import type { FiltresDestinataires } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import { ROLE_RANK } from '../../utils/constants';

// ─── Variables disponibles dans le template ───────────────────────────────────

const VARIABLES: Array<{ label: string; value: string }> = [
  { label: 'Prénom',       value: '[Prénom]'            },
  { label: 'Date',         value: '[Date]'              },
  { label: 'Thème',        value: '[Thème]'             },
  { label: 'Campus',       value: '[Campus]'            },
  { label: 'Référent',     value: '[Référent]'          },
  { label: 'Tél. Référent', value: '[Telephone_Referent]' },
  { label: 'Tél. Église',   value: '[Telephone_Eglise]'   },
  { label: 'Adresse',       value: '[Adresse]'             },
];

const VARIABLE_EXAMPLES: Record<string, string> = {
  '[Prénom]':              'Marie',
  '[Date]':                (() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  })(),
  '[Thème]':               'Culte du dimanche',
  '[Campus]':              'Paris',
  '[Référent]':            'Jean Martin',
  '[Telephone_Referent]':  '+33 6 12 34 56 78',
  '[Telephone_Eglise]':    '+33 1 23 45 67 89',
  '[Adresse]':             '12 rue de l\'Exemple, Paris',
};

// ─── Helper : conversion période → bornes de dates ───────────────────────────

function computePeriodDates(
  periode: string,
  dateDebut: string,
  dateFin: string
): { date_debut?: string; date_fin?: string } {
  if (!periode) return {};
  const today = new Date().toISOString().split('T')[0];

  if (periode === 'perso') {
    return {
      ...(dateDebut ? { date_debut: dateDebut } : {}),
      ...(dateFin   ? { date_fin:   dateFin   } : {}),
    };
  }
  if (periode === 'semaine') {
    const now = new Date();
    const dow = now.getDay() || 7; // 1 = lundi, 7 = dimanche
    const monday = new Date(now);
    monday.setDate(now.getDate() - dow + 1);
    return { date_debut: monday.toISOString().split('T')[0], date_fin: today };
  }
  if (periode === 'mois') {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { date_debut: first.toISOString().split('T')[0], date_fin: today };
  }
  if (periode === '3mois') {
    const ago = new Date();
    ago.setDate(ago.getDate() - 90);
    return { date_debut: ago.toISOString().split('T')[0], date_fin: today };
  }
  return {};
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function MessageCompose() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isAdmin = user ? ROLE_RANK[user.role] >= ROLE_RANK['admin_campus'] : false;
  if (!isAdmin) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔒</div>
        <h2 style={{ color: 'var(--text-primary)', margin: '0 0 8px' }}>Accès refusé</h2>
        <p style={{ margin: 0 }}>Vous n'avez pas les droits nécessaires pour accéder à cette page.</p>
      </div>
    );
  }

  // ── État formulaire ───────────────────────────────────────────────────────
  const [type,              setType]             = useState<'evenement' | 'actu'>('evenement');
  const [titre,             setTitre]            = useState('');
  const [dateEvenement,     setDateEvenement]    = useState('');
  const [envoyerMaintenant, setEnvoyerMaintenant] = useState(false);
  const [planifieDate,      setPlanifieDate]     = useState('');
  const [planifieTime,      setPlanifieTime]     = useState('');
  const [template,          setTemplate]         = useState('');

  // ── Type de destinataire ──────────────────────────────────────────────────
  const [destType, setDestType] = useState<'contacts' | 'ouvriers' | 'tous'>('contacts');

  // ── Filtres contacts ──────────────────────────────────────────────────────
  const [fCampus,         setFCampus]         = useState('');
  const [fProfil,         setFProfil]         = useState('');
  const [fStatut,         setFStatut]         = useState('');
  const [fBesoin,         setFBesoin]         = useState('');
  const [fInteretCellule, setFInteretCellule] = useState('');
  const [fCanal,          setFCanal]          = useState('');
  const [fPeriode,        setFPeriode]        = useState('');
  const [fDateDebut,      setFDateDebut]      = useState('');
  const [fDateFin,        setFDateFin]        = useState('');
  const [fRdvPasteur,     setFRdvPasteur]     = useState(false);

  // ── Filtres ouvriers ──────────────────────────────────────────────────────
  const [fOuvrierCampus,  setFOuvrierCampus]  = useState('');
  const [fOuvrierService, setFOuvrierService] = useState('');

  // ── Compteur temps réel ───────────────────────────────────────────────────
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  // ── UI ────────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Debounce 500ms sur les filtres → compteur temps réel ─────────────────
  useEffect(() => {
    setCountLoading(true);
    const timer = setTimeout(async () => {
      try {
        if (destType === 'ouvriers') {
          const params: { campus?: string; service?: string } = {};
          if (fOuvrierCampus)  params.campus  = fOuvrierCampus;
          if (fOuvrierService) params.service = fOuvrierService;
          const { data } = await ouvriersEndpoints.count(params);
          setContactCount(data.count);
        } else {
          const params: FiltresDestinataires = {};
          if (fCampus)         params.campus           = fCampus;
          if (fProfil)         params.profil           = fProfil;
          if (fStatut)         params.statut           = fStatut;
          if (fBesoin)         params.besoin_spirituel = fBesoin;
          if (fInteretCellule) params.interet_cellule  = fInteretCellule;
          if (fCanal)          params.canal            = fCanal;
          if (fRdvPasteur)     params.rdv_pasteur      = true;
          Object.assign(params, computePeriodDates(fPeriode, fDateDebut, fDateFin));
          const { data } = await contactsEndpoints.count(params);
          setContactCount(data.count);
        }
      } catch {
        setContactCount(null);
      } finally {
        setCountLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [destType, fCampus, fProfil, fStatut, fBesoin, fInteretCellule, fCanal, fPeriode, fDateDebut, fDateFin, fRdvPasteur, fOuvrierCampus, fOuvrierService]);

  // ── Insertion de variable au curseur ─────────────────────────────────────
  function insertVariable(varStr: string) {
    const ta = textareaRef.current;
    if (!ta) { setTemplate(prev => prev + varStr); return; }
    const start = ta.selectionStart ?? template.length;
    const end   = ta.selectionEnd   ?? template.length;
    setTemplate(template.slice(0, start) + varStr + template.slice(end));
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + varStr.length, start + varStr.length);
    }, 0);
  }

  // ── Aperçu avec substitutions exemple ────────────────────────────────────
  const preview = Object.entries(VARIABLE_EXAMPLES).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(k.replace(/[[\]]/g, '\\$&'), 'g'), v),
    template
  );

  // ── Construction des objets filtres pour la soumission ───────────────────
  function buildFiltres(): FiltresDestinataires {
    const filtres: FiltresDestinataires = {};
    if (fCampus)         filtres.campus           = fCampus;
    if (fProfil)         filtres.profil           = fProfil;
    if (fStatut)         filtres.statut           = fStatut;
    if (fBesoin)         filtres.besoin_spirituel = fBesoin;
    if (fInteretCellule) filtres.interet_cellule  = fInteretCellule;
    if (fCanal)          filtres.canal            = fCanal;
    if (fRdvPasteur)     filtres.rdv_pasteur      = true;
    Object.assign(filtres, computePeriodDates(fPeriode, fDateDebut, fDateFin));
    return filtres;
  }

  function buildFiltresOuvriers(): { campus?: string; service?: string } {
    const f: { campus?: string; service?: string } = {};
    if (fOuvrierCampus)  f.campus  = fOuvrierCampus;
    if (fOuvrierService) f.service = fOuvrierService;
    return f;
  }

  // ── Soumission ────────────────────────────────────────────────────────────
  async function handleSubmit(mode: 'maintenant' | 'planifier') {
    setError('');

    if (!template.trim()) { setError('Le contenu du message est requis.'); return; }
    if (type === 'evenement') {
      if (!titre.trim())  { setError('Le titre est requis pour un événement.'); return; }
      if (!dateEvenement) { setError("La date de l'événement est requise."); return; }
    }
    if (mode === 'planifier' && (!planifieDate || !planifieTime)) {
      setError('Veuillez sélectionner une date et une heure de planification.');
      return;
    }

    const titreFinal  = type === 'evenement' ? titre : `Actu — ${new Date().toLocaleDateString('fr-FR')}`;
    const dateEvFinal = type === 'evenement' ? dateEvenement : new Date().toISOString().split('T')[0];

    setLoading(true);
    try {
      await messagesEndpoints.createEvenement({
        titre:             titreFinal,
        message_template:  template,
        date_evenement:    dateEvFinal,
        dest_type:         destType,
        filtres:           buildFiltres(),
        filtres_ouvriers:  buildFiltresOuvriers(),
        ...(mode === 'maintenant'
          ? { envoyer_maintenant: true }
          : { planifie_le: `${planifieDate}T${planifieTime}:00` }),
      });
      const msg = mode === 'maintenant'
        ? 'Messages envoyés avec succès.'
        : 'Événement planifié avec succès.';
      localStorage.setItem('compose_success', msg);
      navigate('/messagerie');
    } catch (err: unknown) {
      const axiosMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(axiosMsg ?? 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  }

  const charCount  = template.length;
  const canPlanify = envoyerMaintenant || (!!planifieDate && !!planifieTime);

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px) clamp(12px, 3vw, 32px)', fontFamily: 'inherit' }}>

      {/* En-tête */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Nouveau message
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Composez et planifiez un envoi WhatsApp groupé.
        </p>
      </div>

      {error && (
        <div style={{
          marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
          background: 'rgba(239,68,68,0.1)', color: 'var(--accent-red)',
          border: '1px solid rgba(239,68,68,0.25)', fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

        {/* ── Colonne gauche : Config + Filtres (40%) ─────────────────────── */}
        <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Bloc configuration */}
          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>Configuration</h2>

            <div style={fieldGroup}>
              <label style={labelStyle}>Type de message</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'evenement' | 'actu')}
                style={inputStyle}
              >
                <option value="bienvenue" disabled style={{ fontStyle: 'italic', color: 'var(--text-tertiary)' }}>
                  Bienvenue — Automatique (système)
                </option>
                <option value="evenement">Événement</option>
                <option value="actu">Actualité</option>
              </select>
            </div>

            {type === 'evenement' && (
              <div style={fieldGroup}>
                <label style={labelStyle}>Titre</label>
                <input
                  type="text"
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  placeholder="Ex : Culte de Pentecôte"
                  style={inputStyle}
                />
              </div>
            )}

            {type === 'evenement' && (
              <div style={fieldGroup}>
                <label style={labelStyle}>Date de l'événement</label>
                <input
                  type="date"
                  value={dateEvenement}
                  onChange={(e) => setDateEvenement(e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}

            <div style={{ ...fieldGroup, flexDirection: 'row', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <input
                id="envoyer_maintenant"
                type="checkbox"
                checked={envoyerMaintenant}
                onChange={(e) => setEnvoyerMaintenant(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-teal)' }}
              />
              <label htmlFor="envoyer_maintenant" style={{ ...labelStyle, margin: 0, cursor: 'pointer' }}>
                Envoyer maintenant
              </label>
            </div>

            {!envoyerMaintenant && (
              <div style={fieldGroup}>
                <label style={labelStyle}>Planifier l'envoi</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="date"
                    value={planifieDate}
                    onChange={(e) => setPlanifieDate(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <input
                    type="time"
                    value={planifieTime}
                    onChange={(e) => setPlanifieTime(e.target.value)}
                    style={{ ...inputStyle, flex: '0 0 110px' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bloc filtres destinataires */}
          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>Destinataires</h2>

            {/* Type de destinataire */}
            <div style={fieldGroup}>
              <label style={labelStyle}>Type de destinataire</label>
              <select
                value={destType}
                onChange={(e) => setDestType(e.target.value as 'contacts' | 'ouvriers' | 'tous')}
                style={inputStyle}
              >
                <option value="contacts">Contacts uniquement</option>
                <option value="ouvriers">Ouvriers uniquement</option>
                <option value="tous">Contacts + Ouvriers</option>
              </select>
            </div>

            {/* ── Filtres contacts ───────────────────────────────────────── */}
            {(destType === 'contacts' || destType === 'tous') && (
              <>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Campus</label>
                  <select value={fCampus} onChange={(e) => setFCampus(e.target.value)} style={inputStyle}>
                    <option value="">Tous les campus</option>
                    <option value="paris">Paris uniquement</option>
                    <option value="paris_nord">Paris Nord uniquement</option>
                  </select>
                </div>

                <div style={fieldGroup}>
                  <label style={labelStyle}>Profil</label>
                  <select value={fProfil} onChange={(e) => setFProfil(e.target.value)} style={inputStyle}>
                    <option value="">Tous les profils</option>
                    <option value="membre_phila">Membre Phila</option>
                    <option value="visiteur_sans_eglise">Visiteur sans église</option>
                    <option value="visiteur_avec_eglise">Visiteur avec église</option>
                  </select>
                </div>

                <div style={fieldGroup}>
                  <label style={labelStyle}>Statut du contact</label>
                  <select value={fStatut} onChange={(e) => setFStatut(e.target.value)} style={inputStyle}>
                    <option value="">Tous les statuts</option>
                    <option value="nouveau">Nouveau</option>
                    <option value="contacte">Contacté</option>
                    <option value="en_suivi">En suivi</option>
                    <option value="integre">Intégré</option>
                    <option value="inactif">Inactif</option>
                  </select>
                </div>

                <div style={fieldGroup}>
                  <label style={labelStyle}>
                    Besoin spirituel
                    <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: '6px' }}>(Visiteurs)</span>
                  </label>
                  <select value={fBesoin} onChange={(e) => setFBesoin(e.target.value)} style={inputStyle}>
                    <option value="">Tous</option>
                    <option value="priere">Prière</option>
                    <option value="bapteme">Baptême</option>
                    <option value="suivi">Suivi pastoral</option>
                    <option value="rencontrer_pasteur">Rencontrer le pasteur</option>
                  </select>
                </div>

                <div style={fieldGroup}>
                  <label style={labelStyle}>Intérêt cellule</label>
                  <select value={fInteretCellule} onChange={(e) => setFInteretCellule(e.target.value)} style={inputStyle}>
                    <option value="">Tous</option>
                    <option value="oui">Oui</option>
                    <option value="peut_etre">Peut-être</option>
                  </select>
                </div>

                <div style={fieldGroup}>
                  <label style={labelStyle}>Canal d'inscription</label>
                  <select value={fCanal} onChange={(e) => setFCanal(e.target.value)} style={inputStyle}>
                    <option value="">Tous les canaux</option>
                    <option value="presentiel">Présentiel uniquement</option>
                    <option value="en_ligne">En ligne uniquement</option>
                  </select>
                </div>

                <div style={fieldGroup}>
                  <label style={labelStyle}>Période d'inscription</label>
                  <select
                    value={fPeriode}
                    onChange={(e) => { setFPeriode(e.target.value); setFDateDebut(''); setFDateFin(''); }}
                    style={inputStyle}
                  >
                    <option value="">Toute la période</option>
                    <option value="semaine">Cette semaine</option>
                    <option value="mois">Ce mois</option>
                    <option value="3mois">Les 3 derniers mois</option>
                    <option value="perso">Personnalisé</option>
                  </select>
                </div>

                {fPeriode === 'perso' && (
                  <div style={fieldGroup}>
                    <label style={labelStyle}>Dates personnalisées</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="date" value={fDateDebut}
                        onChange={(e) => setFDateDebut(e.target.value)}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', flexShrink: 0 }}>→</span>
                      <input
                        type="date" value={fDateFin}
                        onChange={(e) => setFDateFin(e.target.value)}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                    </div>
                  </div>
                )}

                <div style={{ ...fieldGroup, flexDirection: 'row', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <input
                    id="rdv_pasteur" type="checkbox" checked={fRdvPasteur}
                    onChange={(e) => setFRdvPasteur(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-teal)' }}
                  />
                  <label htmlFor="rdv_pasteur" style={{ ...labelStyle, margin: 0, cursor: 'pointer' }}>
                    RDV Pasteur souhaité uniquement
                  </label>
                </div>
              </>
            )}

            {/* ── Filtres ouvriers ───────────────────────────────────────── */}
            {(destType === 'ouvriers' || destType === 'tous') && (
              <>
                {destType === 'tous' && (
                  <div style={{
                    padding: '8px 12px', borderRadius: '6px', marginBottom: '4px',
                    background: 'var(--accent-teal-light)', fontSize: '0.78rem',
                    color: 'var(--accent-teal)', fontWeight: 500,
                  }}>
                    Filtres ouvriers
                  </div>
                )}

                <div style={fieldGroup}>
                  <label style={labelStyle}>Campus (ouvriers)</label>
                  <select value={fOuvrierCampus} onChange={(e) => setFOuvrierCampus(e.target.value)} style={inputStyle}>
                    <option value="">Tous les campus</option>
                    <option value="paris">Paris</option>
                    <option value="paris_nord">Paris Nord</option>
                  </select>
                </div>

                <div style={fieldGroup}>
                  <label style={labelStyle}>Service (ouvriers)</label>
                  <select value={fOuvrierService} onChange={(e) => setFOuvrierService(e.target.value)} style={inputStyle}>
                    <option value="">Tous les services</option>
                    <option value="accueil">Accueil</option>
                    <option value="louange">Louange</option>
                    <option value="technique">Technique</option>
                    <option value="medias">Médias</option>
                    <option value="priere">Prière</option>
                    <option value="enfants">Enfants</option>
                    <option value="securite">Sécurité</option>
                  </select>
                </div>
              </>
            )}

            {/* Compteur temps réel */}
            <div style={{
              marginTop: '12px', padding: '10px 14px', borderRadius: '8px',
              background: 'var(--bg-secondary)', border: '1px solid var(--bg-card-border)',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              {countLoading ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Calcul en cours…</span>
              ) : contactCount === null ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-red)' }}>Erreur de comptage</span>
              ) : (
                <>
                  <span style={{
                    fontSize: '1.375rem', fontWeight: 700,
                    color: contactCount === 0 ? 'var(--accent-red)' : 'var(--accent-teal)',
                  }}>
                    {contactCount}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                    {destType === 'ouvriers' ? 'ouvrier' : 'contact'}{contactCount !== 1 ? 's' : ''}
                    {' '}correspond{contactCount === 1 ? '' : 'ent'} à ces critères
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Colonne droite : Rédaction + Aperçu ─────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Bloc rédaction */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 style={{ ...cardTitleStyle, margin: 0 }}>Message</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                {charCount} caractère{charCount !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Pills variables */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {VARIABLES.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => insertVariable(v.value)}
                  style={{
                    padding: '4px 10px', borderRadius: '20px',
                    background: 'var(--accent-teal-light, rgba(12,94,107,0.1))',
                    color: 'var(--accent-teal)',
                    border: '1px solid var(--accent-teal)',
                    fontSize: '12px', cursor: 'pointer',
                    fontFamily: 'inherit', fontWeight: 500,
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              rows={10}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="Bonjour [Prénom] ! Nous vous invitons à notre événement le [Date] au campus [Campus]…"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px', borderRadius: '8px',
                border: '1px solid var(--bg-card-border)',
                background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                fontFamily: 'inherit', fontSize: '0.875rem', lineHeight: 1.6,
                resize: 'vertical', outline: 'none',
              }}
            />
          </div>

          {/* Bloc aperçu */}
          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>Aperçu</h2>
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: '10px', padding: '16px',
              color: 'var(--text-primary)', fontSize: '0.875rem', lineHeight: 1.7,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', minHeight: '80px',
            }}>
              {preview || (
                <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                  L'aperçu s'affiche ici au fur et à mesure de la saisie…
                </span>
              )}
            </div>
            <p style={{ margin: '10px 0 0', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Les variables sont remplacées par des exemples dans l'aperçu.
            </p>
          </div>
        </div>
      </div>

      {/* Barre d'actions */}
      <div style={{
        display: 'flex', gap: '12px', justifyContent: 'flex-end',
        marginTop: '28px', paddingTop: '20px',
        borderTop: '1px solid var(--bg-card-border)',
      }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          disabled={loading}
          style={{
            padding: '9px 18px', borderRadius: '8px',
            background: 'none', border: '1px solid var(--bg-card-border)',
            color: 'var(--text-secondary)', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '0.875rem',
          }}
        >
          Annuler
        </button>

        <button
          type="button"
          disabled
          title="Bientôt disponible"
          style={{
            padding: '9px 18px', borderRadius: '8px',
            background: 'none', border: '1px solid var(--bg-card-border)',
            color: 'var(--text-tertiary)', cursor: 'not-allowed',
            fontFamily: 'inherit', fontSize: '0.875rem', opacity: 0.5,
          }}
        >
          Enregistrer brouillon
        </button>

        {!envoyerMaintenant && (
          <button
            type="button"
            onClick={() => handleSubmit('planifier')}
            disabled={loading || !canPlanify}
            style={{
              padding: '9px 18px', borderRadius: '8px',
              background: canPlanify && !loading ? 'var(--accent-teal)' : 'var(--bg-secondary)',
              color: canPlanify && !loading ? '#fff' : 'var(--text-tertiary)',
              border: 'none', cursor: canPlanify && !loading ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Envoi…' : 'Planifier'}
          </button>
        )}

        <button
          type="button"
          onClick={() => handleSubmit('maintenant')}
          disabled={loading}
          style={{
            padding: '9px 18px', borderRadius: '8px',
            background: loading ? 'var(--bg-secondary)' : 'var(--accent-teal)',
            color: loading ? 'var(--text-tertiary)' : '#fff',
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Envoi…' : 'Envoyer maintenant'}
        </button>
      </div>
    </div>
  );
}

// ─── Styles utilitaires ───────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
  borderRadius: '12px', padding: '24px',
};

const cardTitleStyle: React.CSSProperties = {
  margin: '0 0 20px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)',
};

const fieldGroup: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem', fontWeight: 600,
  color: 'var(--text-secondary)', letterSpacing: '0.02em',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: '7px',
  border: '1px solid var(--bg-card-border)',
  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
  fontFamily: 'inherit', fontSize: '0.875rem', outline: 'none',
  width: '100%', boxSizing: 'border-box',
};
