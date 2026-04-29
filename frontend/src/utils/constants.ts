// src/utils/constants.ts
// Constantes métier — labels, couleurs et options des enums pour l'affichage UI.
// Source unique de vérité pour toutes les listes de sélection et badges.

import { colors } from '../components/ui/tokens';
import type {
  Campus, Role, StatutContact, Profil,
  Canal, EtatCivil, StatutPhila, Genre,
  Souhait, BesoinSpirituel, InteretCellule,
  DisponibiliteSuivi, Extension,
  StatutMessage, TypeMessage, StatutEvenement,
} from '../types';

// ─── Campus ──────────────────────────────────────────────────────────────────

export const CAMPUS_LABELS: Record<Campus, string> = {
  paris:      'Paris',
  paris_nord: 'Paris Nord',
};

export const CAMPUS_OPTIONS = Object.entries(CAMPUS_LABELS).map(
  ([value, label]) => ({ value: value as Campus, label })
);

// ─── Rôles ───────────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<Role, string> = {
  super_admin:          'Super Admin',
  admin_campus:         'Admin Campus',
  referent_eglise:      'Référent Église',
  referent_integration: 'Référent Intégration',
  lecteur:              'Lecteur',
};

export const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(
  ([value, label]) => ({ value: value as Role, label })
);

// ─── Statuts contact ─────────────────────────────────────────────────────────

export const STATUT_LABELS: Record<StatutContact, string> = {
  nouveau:   'Nouveau',
  contacte:  'Contacté',
  en_suivi:  'En suivi',
  integre:   'Intégré',
  ouvrier:   'Ouvrier',
  inactif:   'Inactif',
};

export const STATUT_COLORS: Record<StatutContact, { bg: string; text: string }> = {
  nouveau:   { bg: colors.infoLight,    text: colors.info },
  contacte:  { bg: colors.primaryLight, text: colors.primaryText },
  en_suivi:  { bg: colors.warningLight, text: colors.secondaryText },
  integre:   { bg: colors.successLight, text: colors.success },
  ouvrier:   { bg: colors.primaryLight, text: colors.primary },
  inactif:   { bg: colors.gray100,      text: colors.gray500 },
};

export const STATUT_OPTIONS = Object.entries(STATUT_LABELS).map(
  ([value, label]) => ({ value: value as StatutContact, label })
);

// ─── Profils ─────────────────────────────────────────────────────────────────

export const PROFIL_LABELS: Record<Profil, string> = {
  A: 'Profil A — Croyant',
  B: 'Profil B — Visiteur',
};

export const PROFIL_BADGE: Record<Profil, { bg: string; text: string }> = {
  A: { bg: colors.primaryLight,   text: colors.primaryText },
  B: { bg: colors.secondaryLight, text: colors.secondaryText },
};

// ─── Canal ───────────────────────────────────────────────────────────────────

export const CANAL_LABELS: Record<Canal, string> = {
  presentiel: 'Présentiel',
  en_ligne:   'En ligne',
};

// ─── Genre ───────────────────────────────────────────────────────────────────

export const GENRE_LABELS: Record<Genre, string> = {
  homme:  'Homme',
  femme:  'Femme',
};

export const GENRE_OPTIONS = Object.entries(GENRE_LABELS).map(
  ([value, label]) => ({ value: value as Genre, label })
);

// ─── État civil ───────────────────────────────────────────────────────────────

export const ETAT_CIVIL_LABELS: Record<EtatCivil, string> = {
  celibataire: 'Célibataire',
  fiance:      'Fiancé(e)',
  marie:       'Marié(e)',
  divorce:     'Divorcé(e)',
  veuf:        'Veuf / Veuve',
};

export const ETAT_CIVIL_OPTIONS = Object.entries(ETAT_CIVIL_LABELS).map(
  ([value, label]) => ({ value: value as EtatCivil, label })
);

// ─── Statut Phila ─────────────────────────────────────────────────────────────

export const STATUT_PHILA_LABELS: Record<StatutPhila, string> = {
  oui:             'Membre Phila',
  non:             'Non membre',
  premiere_visite: 'Première visite',
};

export const STATUT_PHILA_OPTIONS = Object.entries(STATUT_PHILA_LABELS).map(
  ([value, label]) => ({ value: value as StatutPhila, label })
);

// ─── Extension (campus Phila d'origine) ──────────────────────────────────────

export const EXTENSION_LABELS: Record<Extension, string> = {
  paris:       'Paris',
  paris_nord:  'Paris Nord',
  orleans:     'Orléans',
  montpellier: 'Montpellier',
};

// ─── Souhait ─────────────────────────────────────────────────────────────────

export const SOUHAIT_LABELS: Record<Souhait, string> = {
  devenir_membre: 'Devenir membre',
  servir:         'Servir / Être ouvrier',
  juste_visiter:  'Juste visiter',
};

// ─── Besoins spirituels ───────────────────────────────────────────────────────

export const BESOIN_LABELS: Record<BesoinSpirituel, string> = {
  priere:             'Prière',
  bapteme:            'Baptême',
  suivi:              'Suivi pastoral',
  rencontrer_pasteur: 'Rencontrer le pasteur',
};

// ─── Intérêt cellule ─────────────────────────────────────────────────────────

export const INTERET_CELLULE_LABELS: Record<InteretCellule, string> = {
  oui:      'Oui',
  non:      'Non',
  peut_etre: 'Peut-être',
};

// ─── Disponibilité suivi ─────────────────────────────────────────────────────

export const DISPO_LABELS: Record<DisponibiliteSuivi, string> = {
  message: 'Message',
  appel:   'Appel téléphonique',
  email:   'Email',
};

// ─── Messages ─────────────────────────────────────────────────────────────────

export const STATUT_MESSAGE_LABELS: Record<StatutMessage, string> = {
  en_attente: 'En attente',
  envoye:     'Envoyé',
  echoue:     'Échoué',
};

export const TYPE_MESSAGE_LABELS: Record<TypeMessage, string> = {
  bienvenue: 'Bienvenue',
  evenement: 'Événement',
  actu:      'Actualité',
};

export const STATUT_EVENEMENT_LABELS: Record<StatutEvenement, string> = {
  brouillon: 'Brouillon',
  planifie:  'Planifié',
  envoye:    'Envoyé',
};

// ─── Rang des rôles (hiérarchie) ─────────────────────────────────────────────

export const ROLE_RANK: Record<Role, number> = {
  super_admin:          5,
  admin_campus:         4,
  referent_eglise:      3,
  referent_integration: 2,
  lecteur:              1,
};

export const API_BASE = 'http://localhost:4000/api';
