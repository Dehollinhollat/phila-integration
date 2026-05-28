// src/features/admin/Settings.tsx
// Paramètres système - super_admin uniquement.
// Trois sections : Seuils & Alertes, Infos Église, Templates Messages.
// Toutes les clés sont persistées en clé-valeur via PUT /api/settings.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { settingsEndpoints } from '../../services/endpoints';

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

const SECTIONS: { label: string; icon: string; settings: SettingDef[] }[] = [
  {
    label: 'Seuils & Alertes',
    icon:  '⚠️',
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
  {
    label: 'Infos Église',
    icon:  '⛪',
    settings: [
      {
        key: 'nom_eglise',
        label: 'Nom de l\'église',
        description: 'Utilisé dans les messages envoyés aux contacts.',
        type: 'text', placeholder: 'Cité des Adorateurs',
      },
      {
        key: 'adresse_eglise',
        label: 'Adresse',
        description: 'Adresse principale de l\'église.',
        type: 'text', placeholder: '12 rue de l\'Exemple, Paris',
      },
      {
        key: 'telephone_eglise',
        label: 'Téléphone',
        description: 'Numéro de contact de l\'église. Utilisé pour la variable [Telephone_Eglise] dans les messages.',
        type: 'text', placeholder: '+33 1 23 45 67 89',
      },
    ],
  },
  {
    label: 'Templates Messages',
    icon:  '💬',
    settings: [
      {
        key: 'message_bienvenue',
        label: 'Message de bienvenue',
        description: 'Envoyé automatiquement J+3 après l\'inscription. Variables : [Prenom], [Referent], [Telephone_Referent], [Telephone_Eglise], [Campus], [Date].',
        type: 'textarea',
        placeholder: 'Bonjour [Prenom], bienvenue ! Je suis [Referent], votre référent au [Telephone_Referent].',
      },
      {
        key: 'message_evenement_default',
        label: 'Template événement par défaut',
        description: 'Pré-rempli lors de la création d\'un événement. Variables : {prenom}, {titre_evenement}, {date_evenement}.',
        type: 'textarea',
        placeholder: 'Bonjour {prenom}, nous vous invitons à notre événement "{titre_evenement}" le {date_evenement}.',
      },
    ],
  },
  {
    label: 'Messages d\'anniversaire',
    icon:  '🎂',
    settings: [
      {
        key: 'template_anniversaire',
        label: 'Message d\'anniversaire',
        description: 'Envoyé automatiquement chaque année le jour de l\'anniversaire à 9h00. Variable disponible : [Prenom].',
        type: 'textarea',
        placeholder: 'Joyeux anniversaire [Prenom] ! 🎂 Toute l\'équipe Phila vous souhaite une excellente journée. Que Dieu vous bénisse abondamment.',
      },
    ],
  },
  {
    label: 'Message Nouvel An',
    icon:  '🎉',
    settings: [
      {
        key:         'template_nouvel_an',
        label:       'Message du Nouvel An',
        description: 'Envoyé automatiquement le 1er janvier à 9h00 à tous les contacts et ouvriers actifs. Variable disponible : [Prenom].',
        type:        'textarea' as const,
        placeholder: "Bonne année [Prenom] ! 🎉 Toute l'équipe de Phila Cité des Adorateurs vous souhaite une excellente année...",
      },
    ],
  },
  {
    label: 'Template Événement',
    icon:  '📅',
    settings: [
      {
        key:         'template_evenement',
        label:       'Message d\'invitation à un événement',
        description: 'Envoyé lors de la création d\'un événement. Variables : [Prenom], [Date], [Theme], [Adresse], [Telephone_Eglise].',
        type:        'textarea' as const,
        placeholder: 'Bonjour [Prenom] ! 🙏 Nous vous invitons à notre événement "[Theme]" le [Date].\n\n📍 [Adresse]\n📞 [Telephone_Eglise]',
      },
    ],
  },
  {
    label: 'Certificat d\'intégration',
    icon:  '🎓',
    settings: [
      {
        key:         'certificat_verset',
        label:       'Verset biblique',
        description: 'Ce verset apparaît sur tous les certificats d\'intégration générés.',
        type:        'textarea' as const,
        placeholder: '"Car je connais les projets que j\'ai formés sur vous..." — Jérémie 29:11',
      },
    ],
  },
];

// ─── Composant ────────────────────────────────────────────────────────────────

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Guard : uniquement super_admin - redirection immédiate sinon
  if (user && user.role !== 'super_admin') {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const [values,  setValues]  = useState<Record<string, string>>({});

  function computeApercu(key: string, raw: string): string {
    const adresse = values['adresse_eglise']  || '8 rue Saint-Claude, 77340 Pontault-Combault';
    const tel     = values['telephone_eglise'] || '+33 1 23 45 67 89';
    const base = raw
      .replace(/\[Pr[eé]nom\]/gi,          'Marie')
      .replace(/\[Date\]/gi,               '29 juin 2026')
      .replace(/\[Campus\]/gi,             'Paris')
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
  const [saved,   setSaved]   = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState<string | null>(null);

  useEffect(() => {
    settingsEndpoints.get().then(res => {
      setValues(res.data);
      setSaved(res.data);
    }).finally(() => setLoading(false));
  }, []);

  const isDirty = JSON.stringify(values) !== JSON.stringify(saved);

  function set(key: string, value: string) {
    setValues(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const entries = Object.entries(values).map(([key, value]) => ({ key, value }));
      const res = await settingsEndpoints.update(entries);
      setSaved(res.data);
      setValues(res.data);
      showToast('Paramètres sauvegardés');
    } catch {
      showToast('Erreur lors de la sauvegarde');
    } finally { setSaving(false); }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
        Chargement…
      </div>
    );
  }

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px) clamp(12px, 3vw, 32px)', maxWidth: 780 }}>

      {/* Titre + bouton sauvegarder */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Paramètres</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Configuration système -super_admin uniquement.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          style={{
            padding:    '9px 22px',
            background:  isDirty ? 'var(--accent-teal)' : 'var(--bg-secondary)',
            color:       isDirty ? '#fff' : 'var(--text-tertiary)',
            border:     'none',
            borderRadius: 8,
            fontSize:   13,
            fontWeight: 600,
            cursor:     isDirty ? 'pointer' : 'default',
            fontFamily: 'inherit',
            transition: '120ms ease',
          }}
        >
          {saving ? 'Enregistrement…' : 'Sauvegarder les modifications'}
        </button>
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {SECTIONS.map(section => (
          <div key={section.label} style={{
            background:   'var(--bg-card)',
            border:       '1px solid var(--bg-card-border)',
            borderRadius: 12,
            overflow:     'hidden',
          }}>
            {/* En-tête section */}
            <div style={{
              padding:     '14px 20px',
              borderBottom: '1px solid var(--bg-card-border)',
              display:     'flex',
              alignItems:  'center',
              gap:         8,
            }}>
              <span style={{ fontSize: 16 }}>{section.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{section.label}</span>
            </div>

            {/* Champs */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {section.settings.map(def => (
                <div key={def.key}>
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
                        value={values[def.key] ?? ''}
                        onChange={e => set(def.key, e.target.value)}
                        placeholder={def.placeholder}
                        rows={4}
                        style={{
                          ...inputStyle,
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          lineHeight: 1.5,
                        }}
                      />
                      {values[def.key] && (
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
                          {def.key === 'certificat_verset' ? values[def.key] : computeApercu(def.key, values[def.key] || '')}
                        </div>
                      )}
                    </>
                  ) : (
                    <input
                      type={def.type}
                      min={def.min}
                      max={def.max}
                      value={values[def.key] ?? ''}
                      onChange={e => set(def.key, e.target.value)}
                      placeholder={def.placeholder}
                      style={{ ...inputStyle, maxWidth: def.type === 'number' ? 120 : '100%' }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position:   'fixed',
          bottom:     24,
          right:      24,
          background: 'var(--bg-card)',
          border:     '1px solid var(--bg-card-border)',
          borderRadius: 10,
          padding:    '12px 20px',
          fontSize:   13,
          fontWeight: 600,
          color:      'var(--text-primary)',
          boxShadow:  '0 4px 20px rgba(0,0,0,0.12)',
          zIndex:     600,
          maxWidth:   'calc(100vw - 32px)',
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
