// src/lib/campusSettings.ts
// Paramètres de messagerie scopés par campus (templates WhatsApp, infos église,
// verset certificat). Remplace l'ancienne table Settings globale pour ces clés —
// voir scripts/migrate-campus-settings.ts. Les seuils d'alerte restent dans
// Settings (globaux, super_admin uniquement).

import prisma from './prisma';

// Les clés scopées par campus — toute nouvelle clé de messagerie par campus doit être ajoutée ici.
// 'template_evenement' a été retiré : sa description ("envoyé à la création d'un
// événement") ne correspondait à rien de réel — un événement est toujours composé
// manuellement (voir MessageCompose.tsx), rien ne s'envoie automatiquement depuis
// ce template. 'message_evenement_default' reste car il correspond à un besoin
// plausible (pré-remplir le formulaire de création), même si pas encore branché
// — voir docs/BACKLOG.md.
export const CAMPUS_SETTINGS_KEYS = [
  'message_bienvenue',
  'template_anniversaire',
  'template_nouvel_an',
  'message_evenement_default',
  'nom_eglise',
  'adresse_eglise',
  'telephone_eglise',
  'certificat_verset',
] as const;

export type CampusSettingKey = typeof CAMPUS_SETTINGS_KEYS[number];

// Template par défaut utilisé si la clé 'message_bienvenue' n'est pas encore configurée.
// Déplacé ici depuis messages.controller.ts (qui le ré-exporte pour compatibilité).
export const DEFAULT_BIENVENUE_TEMPLATE =
  `Bonjour [Prenom], en espérant que votre semaine se passe très bien par la grâce de Dieu. ` +
  `L'église Phila Cité des Adorateurs est ravie de vous compter parmi ses fidèles ! ` +
  `Je suis [Referent], votre référent d'intégration. ` +
  `N'hésitez pas à me contacter au [Telephone_Referent]. ` +
  `Vous pouvez aussi joindre l'église au [Telephone_Eglise]. ` +
  `Nous allons prier pour vous. Avez-vous des sujets particuliers de prière ?`;

// Valeur de repli si une clé n'a pas encore de ligne CampusSettings pour un campus donné.
export const DEFAULT_CAMPUS_SETTINGS: Record<CampusSettingKey, string> = {
  message_bienvenue:          DEFAULT_BIENVENUE_TEMPLATE,
  template_anniversaire:      'Joyeux anniversaire [Prenom] ! 🎂 Toute l\'équipe Phila vous souhaite une excellente journée. Que Dieu vous bénisse abondamment.',
  template_nouvel_an:         "Bonne année [Prenom] ! 🎉 Toute l'équipe de Phila Cité des Adorateurs vous souhaite une excellente année, pleine de grâce, de santé et de victoires. Que Dieu vous comble de Ses bénédictions en cette nouvelle année !",
  message_evenement_default:  'Bonjour {prenom}, nous vous invitons à notre événement "{titre_evenement}" le {date_evenement}.',
  nom_eglise:                 'Cité des Adorateurs',
  adresse_eglise:             '',
  telephone_eglise:           '',
  certificat_verset:          "\"Car je connais les projets que j'ai formés sur vous, dit l'Éternel, projets de paix et non de malheur, afin de vous donner un avenir et de l'espérance.\" - Jérémie 29:11",
};

// Charge un sous-ensemble de clés pour UN campus, avec repli sur DEFAULT_CAMPUS_SETTINGS
// pour toute clé sans ligne en base.
export async function getCampusSettingsWithDefaults(
  campus: string,
  keys: readonly CampusSettingKey[] = CAMPUS_SETTINGS_KEYS
): Promise<Record<CampusSettingKey, string>> {
  const rows = await prisma.campusSettings.findMany({
    where: { campus: campus as never, key: { in: keys as string[] } },
  });
  const found: Record<string, string> = {};
  for (const row of rows) found[row.key] = row.value;

  const result = {} as Record<CampusSettingKey, string>;
  for (const key of keys) result[key] = found[key] ?? DEFAULT_CAMPUS_SETTINGS[key];
  return result;
}

// Charge les mêmes clés pour plusieurs campus en un seul aller-retour DB — utilisé par
// le cron pour traiter un lot de contacts multi-campus sans recharger les réglages à
// chaque contact. Chaque campus du tableau obtient une entrée dans la Map (repli déjà
// appliqué), même s'il n'a aucune ligne en base. Les campus en double sont dédupliqués
// avant la requête DB.
export async function getCampusSettingsForMany(
  campuses: readonly string[],
  keys: readonly CampusSettingKey[] = CAMPUS_SETTINGS_KEYS
): Promise<Map<string, Record<CampusSettingKey, string>>> {
  const uniqueCampuses = [...new Set(campuses)];
  const rows = await prisma.campusSettings.findMany({
    where: { campus: { in: uniqueCampuses as never[] }, key: { in: keys as string[] } },
  });

  const byCampus = new Map<string, Record<string, string>>();
  for (const c of uniqueCampuses) byCampus.set(c, {});
  for (const row of rows) byCampus.get(row.campus)![row.key] = row.value;

  const result = new Map<string, Record<CampusSettingKey, string>>();
  for (const c of uniqueCampuses) {
    const found = byCampus.get(c)!;
    const withDefaults = {} as Record<CampusSettingKey, string>;
    for (const key of keys) withDefaults[key] = found[key] ?? DEFAULT_CAMPUS_SETTINGS[key];
    result.set(c, withDefaults);
  }
  return result;
}
