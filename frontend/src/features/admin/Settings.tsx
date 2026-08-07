// src/features/admin/Settings.tsx
// Paramètres : Seuils & Alertes (super_admin uniquement, globaux) + templates
// messages/infos église/certificat (par campus — super_admin sur les 4 campus,
// admin_campus limité aux campus de son user.campus[]).

import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, MessageSquare, GraduationCap, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { settingsEndpoints } from '../../services/endpoints';
import { CAMPUS_LABELS, CAMPUS_OPTIONS, ROLE_RANK } from '../../utils/constants';
import type { Campus } from '../../types';

// ─── Définition des paramètres ────────────────────────────────────────────────

interface SettingDef {
  key:         string;
  label:       string;
  description: string;
  type:        'number' | 'text' | 'textarea';
  placeholder?: string;
  min?:        number;
  max?:        number;
}

interface SettingSection {
  label:    string;
  subtitle?: string; // résumé affiché dans l'en-tête replié de l'accordéon
  icon:     ReactNode;
  settings: SettingDef[];
}

const GLOBAL_SECTIONS: SettingSection[] = [
  {
    label: 'Seuils & Alertes',
    icon:  <AlertTriangle size={16} />,
    settings: [
      {
        key: 'seuil_sans_referent',
        label: 'Alerte contact sans référent (jours)',
        description: 'Déclenche une notification si un contact n\'a pas de référent intégration après ce délai.',
        type: 'number', min: 1, max: 30, placeholder: '7',
      },
      {
        key: 'seuil_relance_contact',
        label: 'Délai relance contact (jours)',
        description: 'Rappel au référent si aucune interaction avec son contact depuis ce nombre de jours.',
        type: 'number', min: 1, max: 90, placeholder: '14',
      },
      {
        key: 'nb_jours_inactivite',
        label: 'Inactivité avant passage "inactif" (jours)',
        description: 'Un contact sans mise à jour depuis ce délai sera marqué comme inactif automatiquement.',
        type: 'number', min: 30, max: 365, placeholder: '90',
      },
    ],
  },
];

// 6 groupes d'origine fusionnés en 3 (Infos Église / Modèles de messages / Certificat) —
// la plupart des groupes précédents ne contenaient qu'un seul champ, ce qui allongeait
// inutilement l'écran (en-tête + carte pour chaque champ). Voir docs/BACKLOG.md.
const CAMPUS_SECTIONS: SettingSection[] = [
  {
    label:    'Infos Église',
    subtitle: 'nom, adresse, téléphone',
    icon:     '⛪',
    settings: [
      {
        key: 'nom_eglise',
        label: 'Nom de l\'église',
        description: 'Utilisé dans les messages envoyés aux contacts de ce campus.',
        type: 'text', placeholder: 'Cité des Adorateurs',
      },
      {
        key: 'adresse_eglise',
        label: 'Adresse',
        description: 'Adresse de ce campus.',
        type: 'text', placeholder: '12 rue de l\'Exemple, Paris',
      },
      {
        key: 'telephone_eglise',
        label: 'Téléphone',
        description: 'Numéro de contact de ce campus. Utilisé pour la variable [Telephone_Eglise] dans les messages.',
        type: 'text', placeholder: '+33 1 23 45 67 89',
      },
    ],
  },
  {
    label:    'Modèles de messages',
    subtitle: 'bienvenue, anniversaire, nouvel an, événement',
    icon:     <MessageSquare size={16} />,
    settings: [
      {
        key: 'message_bienvenue',
        label: 'Message de bienvenue',
        description: 'Envoyé automatiquement J+3 après l\'inscription. Variables : [Prenom], [Referent], [Telephone_Referent], [Telephone_Eglise], [Campus], [Date].',
        type: 'textarea',
        placeholder: 'Bonjour [Prenom], bienvenue ! Je suis [Referent], votre référent au [Telephone_Referent].',
      },
      {
        key: 'template_anniversaire',
        label: 'Message d\'anniversaire',
        description: 'Envoyé automatiquement chaque année le jour de l\'anniversaire à 9h00. Variable disponible : [Prenom].',
        type: 'textarea',
        placeholder: 'Joyeux anniversaire [Prenom] ! 🎂 Toute l\'équipe Phila vous souhaite une excellente journée. Que Dieu vous bénisse abondamment.',
      },
      {
        key:         'template_nouvel_an',
        label:       'Message du Nouvel An',
        description: 'Envoyé automatiquement le 1er janvier à 9h00 à tous les contacts et ouvriers actifs de ce campus. Variable disponible : [Prenom].',
        type:        'textarea' as const,
        placeholder: "Bonne année [Prenom] ! 🎉 Toute l'équipe de Phila Cité des Adorateurs vous souhaite une excellente année...",
      },
      {
        key:         'template_evenement',
        label:       'Message d\'invitation à un événement',
        description: 'Envoyé lors de la création d\'un événement pour ce campus. Variables : [Prenom], [Date], [Theme], [Adresse], [Telephone_Eglise].',
        type:        'textarea' as const,
        placeholder: 'Bonjour [Prenom] ! 🙏 Nous vous invitons à notre événement "[Theme]" le [Date].\n\n📍 [Adresse]\n📞 [Telephone_Eglise]',
      },
      {
        key: 'message_evenement_default',
        label: 'Template événement par défaut',
        description: 'Pré-rempli lors de la création d\'un événement pour ce campus. Variables : {prenom}, {titre_evenement}, {date_evenement}.',
        type: 'textarea',
        placeholder: 'Bonjour {prenom}, nous vous invitons à notre événement "{titre_evenement}" le {date_evenement}.',
      },
    ],
  },
  {
    label:    'Certificat d\'intégration',
    subtitle: 'verset biblique',
    icon:     <GraduationCap size={16} />,
    settings: [
      {
        key:         'certificat_verset',
        label:       'Verset biblique',
        description: 'Ce verset apparaît sur les certificats d\'intégration générés pour les contacts de ce campus.',
        type:        'textarea' as const,
        placeholder: '"Car je connais les projets que j\'ai formés sur vous..." - Jérémie 29:11',
      },
    ],
  },
];

// ─── Sous-composant : un champ, avec aperçu affiché à la demande ──────────────

function SettingField({
  def, value, onChange, computeApercu,
}: {
  def:      SettingDef;
  value:    string;
  onChange: (value: string) => void;
  computeApercu?: (key: string, raw: string) => string;
}) {
  const [showApercu, setShowApercu] = useState(false);

  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {def.label}
        </label>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
          {def.description}
        </p>
      </div>

      {def.type === 'textarea' ? (
        <>
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={def.placeholder}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
          {value && computeApercu && (
            <>
              <span
                onClick={() => setShowApercu(v => !v)}
                style={{ display: 'inline-block', marginTop: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--accent-teal)', cursor: 'pointer' }}
              >
                {showApercu ? "Masquer l'aperçu ▴" : "Voir l'aperçu ▾"}
              </span>
              {showApercu && (
                <div style={{
                  marginTop:    8,
                  padding:      '10px 12px',
                  background:   'var(--bg-secondary)',
                  borderRadius: 6,
                  fontSize:     12,
                  color:        def.key === 'certificat_verset' ? '#D4A24E' : 'var(--text-secondary)',
                  fontFamily:   def.key === 'certificat_verset' ? 'Georgia, serif' : 'monospace',
                  fontStyle:    def.key === 'certificat_verset' ? 'italic' : 'normal',
                  lineHeight:   1.6,
                  borderLeft:   `3px solid ${def.key === 'certificat_verset' ? '#D4A24E' : 'var(--accent-teal)'}`,
                  whiteSpace:   'pre-wrap',
                  textAlign:    def.key === 'certificat_verset' ? 'center' : 'left',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, color: 'var(--text-tertiary)', fontFamily: 'inherit', fontStyle: 'normal' }}>Aperçu</div>
                  {def.key === 'certificat_verset' ? value : computeApercu(def.key, value)}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <input
          type={def.type}
          min={def.min}
          max={def.max}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={def.placeholder}
          style={{ ...inputStyle, maxWidth: def.type === 'number' ? 120 : '100%' }}
        />
      )}
    </div>
  );
}

// ─── Sous-composant : un bloc de sections en accordéon, son propre état ───────
// La 1ère section est ouverte par défaut, les suivantes repliées — la plupart ne
// contiennent qu'un seul champ, les garder toutes dépliées allongeait inutilement
// le défilement. L'état ouvert/fermé n'est pas remis à zéro au changement de campus
// (le composant n'est pas démonté), ce qui est le comportement voulu.

function SettingsBlock({
  sections, values, onChange, computeApercu,
}: {
  sections: SettingSection[];
  values:   Record<string, string>;
  onChange: (key: string, value: string) => void;
  computeApercu?: (key: string, raw: string) => string;
}) {
  const [openLabel, setOpenLabel] = useState<string | null>(sections[0]?.label ?? null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {sections.map(section => {
        const isOpen = openLabel === section.label;
        return (
          <div key={section.label} style={{
            background:   'var(--bg-card)',
            border:       '1px solid var(--bg-card-border)',
            borderRadius: 12,
            overflow:     'hidden',
          }}>
            <div
              onClick={() => setOpenLabel(isOpen ? null : section.label)}
              style={{
                padding:     '14px 20px',
                borderBottom: isOpen ? '1px solid var(--bg-card-border)' : 'none',
                display:     'flex',
                alignItems:  'center',
                justifyContent: 'space-between',
                cursor:      'pointer',
                userSelect:  'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>{section.icon}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{section.label}</span>
                {section.subtitle && (
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{section.subtitle}</span>
                )}
              </div>
              <ChevronDown
                size={18}
                style={{
                  color: 'var(--text-secondary)',
                  transform: isOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 150ms ease',
                  flexShrink: 0,
                }}
              />
            </div>

            {isOpen && (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {section.settings.map(def => (
                  <SettingField
                    key={def.key}
                    def={def}
                    value={values[def.key] ?? ''}
                    onChange={v => onChange(def.key, v)}
                    computeApercu={computeApercu}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────────

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isSuperAdmin = user?.role === 'super_admin';
  const availableCampus: Campus[] = isSuperAdmin
    ? CAMPUS_OPTIONS.map(o => o.value)
    : (user?.campus ?? []);

  const [activeCampus, setActiveCampus] = useState<Campus | null>(availableCampus[0] ?? null);

  // ── Bloc global (seuils) — super_admin uniquement ──────────────────────────
  const [globalValues, setGlobalValues] = useState<Record<string, string>>({});
  const [globalSaved,  setGlobalSaved]  = useState<Record<string, string>>({});
  const [globalLoading, setGlobalLoading] = useState(isSuperAdmin);
  const [globalSaving,  setGlobalSaving]  = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    settingsEndpoints.getGlobal().then(res => {
      setGlobalValues(res.data);
      setGlobalSaved(res.data);
    }).finally(() => setGlobalLoading(false));
  }, [isSuperAdmin]);

  const globalDirty = JSON.stringify(globalValues) !== JSON.stringify(globalSaved);

  async function handleSaveGlobal() {
    setGlobalSaving(true);
    try {
      const entries = Object.entries(globalValues).map(([key, value]) => ({ key, value }));
      const res = await settingsEndpoints.updateGlobal(entries);
      setGlobalSaved(res.data);
      setGlobalValues(res.data);
      showToast('Seuils sauvegardés');
    } catch {
      showToast('Erreur lors de la sauvegarde');
    } finally { setGlobalSaving(false); }
  }

  // ── Bloc par campus — rechargé à chaque changement d'onglet ────────────────
  const [campusValues, setCampusValues] = useState<Record<string, string>>({});
  const [campusSaved,  setCampusSaved]  = useState<Record<string, string>>({});
  const [campusLoading, setCampusLoading] = useState(!!activeCampus);
  const [campusSaving,  setCampusSaving]  = useState(false);

  useEffect(() => {
    if (!activeCampus) {
      setCampusLoading(false);
      return;
    }
    setCampusLoading(true);
    settingsEndpoints.getCampus(activeCampus).then(res => {
      setCampusValues(res.data);
      setCampusSaved(res.data);
    }).finally(() => setCampusLoading(false));
  }, [activeCampus]);

  const campusDirty = JSON.stringify(campusValues) !== JSON.stringify(campusSaved);

  async function handleSaveCampus() {
    if (!activeCampus) return;
    setCampusSaving(true);
    try {
      const entries = Object.entries(campusValues).map(([key, value]) => ({ key, value }));
      const res = await settingsEndpoints.updateCampus(activeCampus, entries);
      setCampusSaved(res.data);
      setCampusValues(res.data);
      showToast(`Paramètres ${CAMPUS_LABELS[activeCampus]} sauvegardés`);
    } catch {
      showToast('Erreur lors de la sauvegarde');
    } finally { setCampusSaving(false); }
  }

  function computeApercu(key: string, raw: string): string {
    const adresse = campusValues['adresse_eglise']  || '8 rue Saint-Claude, 77340 Pontault-Combault';
    const tel     = campusValues['telephone_eglise'] || '+33 1 23 45 67 89';
    const base = raw
      .replace(/\[Pr[eé]nom\]/gi,          'Marie')
      .replace(/\[Date\]/gi,               '29 juin 2026')
      .replace(/\[Campus\]/gi,             activeCampus ? CAMPUS_LABELS[activeCampus] : 'Paris')
      .replace(/\[Telephone_Eglise\]/gi,   tel)
      .replace(/\[Telephone_Referent\]/gi, '+33 6 12 34 56 78')
      .replace(/\[Referent\]/gi,           'Jean Dupont');
    if (key === 'template_evenement') {
      return base
        .replace(/\[Theme\]/gi,   'La grâce de Dieu')
        .replace(/\[Adresse\]/gi, adresse);
    }
    return base;
  }

  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Guard : admin_campus minimum - redirection sinon (effect, pas un early return
  // avant les hooks ci-dessus — cf. Rules of Hooks)
  useEffect(() => {
    if (user && ROLE_RANK[user.role] < ROLE_RANK['admin_campus']) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  if (user && ROLE_RANK[user.role] < ROLE_RANK['admin_campus']) {
    return null;
  }

  if (globalLoading || campusLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
        Chargement…
      </div>
    );
  }

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px) clamp(12px, 3vw, 32px)', maxWidth: 780 }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Paramètres</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          {isSuperAdmin ? 'Configuration système et par campus.' : 'Configuration de votre/vos campus.'}
        </p>
      </div>

      {/* Onglets campus */}
      {availableCampus.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {availableCampus.map(c => (
            <button
              key={c}
              onClick={() => {
                if (c === activeCampus) return;
                if (campusDirty) {
                  const confirmed = window.confirm(
                    'Vous avez des modifications non enregistrées sur ce campus. Les abandonner et changer de campus ?'
                  );
                  if (!confirmed) return;
                }
                setActiveCampus(c);
              }}
              style={{
                padding: '8px 16px', borderRadius: 8,
                border: `1px solid ${activeCampus === c ? 'var(--accent-teal)' : 'var(--bg-card-border)'}`,
                background: activeCampus === c ? 'var(--accent-teal-light)' : 'var(--bg-card)',
                color: activeCampus === c ? 'var(--accent-teal)' : 'var(--text-primary)',
                fontWeight: activeCampus === c ? 700 : 500,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {CAMPUS_LABELS[c]}
            </button>
          ))}
        </div>
      ) : (
        <div style={{
          padding:      '20px',
          marginBottom: 20,
          textAlign:    'center',
          fontSize:     13,
          color:        'var(--text-secondary)',
          background:   'var(--bg-card)',
          border:       '1px solid var(--bg-card-border)',
          borderRadius: 12,
        }}>
          Aucun campus assigné à votre compte. Contactez un administrateur.
        </div>
      )}

      {/* Bloc par campus */}
      {activeCampus && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              onClick={handleSaveCampus}
              disabled={!campusDirty || campusSaving}
              style={{
                padding: '9px 22px',
                background:  campusDirty ? 'var(--accent-teal)' : 'var(--bg-secondary)',
                color:       campusDirty ? '#fff' : 'var(--text-tertiary)',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: campusDirty ? 'pointer' : 'default', fontFamily: 'inherit', transition: '120ms ease',
              }}
            >
              {campusSaving ? 'Enregistrement…' : `Sauvegarder (${CAMPUS_LABELS[activeCampus]})`}
            </button>
          </div>
          <SettingsBlock
            sections={CAMPUS_SECTIONS}
            values={campusValues}
            onChange={(key, value) => setCampusValues(prev => ({ ...prev, [key]: value }))}
            computeApercu={computeApercu}
          />
        </>
      )}

      {/* Bloc global — super_admin uniquement */}
      {isSuperAdmin && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              onClick={handleSaveGlobal}
              disabled={!globalDirty || globalSaving}
              style={{
                padding: '9px 22px',
                background:  globalDirty ? 'var(--accent-teal)' : 'var(--bg-secondary)',
                color:       globalDirty ? '#fff' : 'var(--text-tertiary)',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: globalDirty ? 'pointer' : 'default', fontFamily: 'inherit', transition: '120ms ease',
              }}
            >
              {globalSaving ? 'Enregistrement…' : 'Sauvegarder les seuils'}
            </button>
          </div>
          <SettingsBlock
            sections={GLOBAL_SECTIONS}
            values={globalValues}
            onChange={(key, value) => setGlobalValues(prev => ({ ...prev, [key]: value }))}
          />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
          borderRadius: 10, padding: '12px 20px', fontSize: 13, fontWeight: 600,
          color: 'var(--text-primary)', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          zIndex: 600, maxWidth: 'calc(100vw - 32px)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Style ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding:      '9px 12px',
  border:       '1px solid var(--bg-card-border)',
  borderRadius: 8,
  background:   'var(--bg-primary)',
  color:        'var(--text-primary)',
  fontSize:     13,
  outline:      'none',
  width:        '100%',
  boxSizing:    'border-box',
};
