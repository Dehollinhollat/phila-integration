// src/utils/constants.ts
// Constantes métier — labels, couleurs et options des enums pour l'affichage UI.
// Source unique de vérité pour toutes les listes de sélection et badges.
// Les couleurs des badges utilisent des CSS variables pour le support light/dark.

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
  nouveau:  { bg: 'var(--badge-nouveau-bg)',  text: 'var(--badge-nouveau-text)' },
  contacte: { bg: 'var(--badge-contacte-bg)', text: 'var(--badge-contacte-text)' },
  en_suivi: { bg: 'var(--badge-ensuivi-bg)',  text: 'var(--badge-ensuivi-text)' },
  integre:  { bg: 'var(--badge-integre-bg)',  text: 'var(--badge-integre-text)' },
  ouvrier:  { bg: 'var(--badge-presentiel-bg)', text: 'var(--badge-presentiel-text)' },
  inactif:  { bg: 'var(--badge-inactif-bg)',  text: 'var(--badge-inactif-text)' },
};

export const STATUT_OPTIONS = Object.entries(STATUT_LABELS).map(
  ([value, label]) => ({ value: value as StatutContact, label })
);

// ─── Profils ─────────────────────────────────────────────────────────────────

export const PROFIL_LABELS: Record<Profil, string> = {
  membre_phila:          'Membre Phila',
  visiteur_sans_eglise:  'Sans église',
  visiteur_avec_eglise:  'Avec église',
};

export const PROFIL_BADGE: Record<Profil, { bg: string; text: string }> = {
  membre_phila:         { bg: 'var(--badge-profil-a-bg)', text: 'var(--badge-profil-a-text)' },
  visiteur_sans_eglise: { bg: 'var(--badge-profil-b-bg)', text: 'var(--badge-profil-b-text)' },
  visiteur_avec_eglise: { bg: 'var(--badge-profil-c-bg)', text: 'var(--badge-profil-c-text)' },
};

export const CANAL_BADGE: Record<Canal, { bg: string; text: string }> = {
  presentiel: { bg: 'var(--badge-presentiel-bg)', text: 'var(--badge-presentiel-text)' },
  en_ligne:   { bg: 'var(--badge-enligne-bg)',    text: 'var(--badge-enligne-text)' },
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

// VITE_API_URL doit inclure le chemin /api (ex: http://localhost:4000/api).
// Pour tester sur téléphone, remplacer localhost par l'IP LAN dans frontend/.env.
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
