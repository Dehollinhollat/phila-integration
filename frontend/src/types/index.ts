// src/types/index.ts
// Types TypeScript — miroir du schéma Prisma côté frontend.
// Chaque interface correspond exactement à un modèle ou enum de schema.prisma.

// ─── Enums ───────────────────────────────────────────────────────────────────

export type Genre           = 'homme' | 'femme';
export type EtatCivil       = 'celibataire' | 'fiance' | 'marie' | 'divorce' | 'veuf';
export type StatutPhila     = 'oui' | 'non' | 'premiere_visite';
export type Extension       = 'paris' | 'paris_nord' | 'orleans' | 'montpellier';
export type Canal           = 'presentiel' | 'en_ligne';
export type Profil          = 'membre_phila' | 'visiteur_sans_eglise' | 'visiteur_avec_eglise';
export type Souhait         = 'devenir_membre' | 'servir' | 'juste_visiter';
export type BesoinSpirituel = 'priere' | 'bapteme' | 'suivi' | 'rencontrer_pasteur';
export type InteretCellule  = 'oui' | 'non' | 'peut_etre';
export type DisponibiliteSuivi = 'message' | 'appel' | 'email';

export type StatutContact =
  | 'nouveau'
  | 'contacte'
  | 'en_suivi'
  | 'integre'
  | 'ouvrier'
  | 'inactif';

export type Campus = 'paris' | 'paris_nord';

export type Role =
  | 'super_admin'
  | 'admin_campus'
  | 'referent_eglise'
  | 'referent_integration'
  | 'lecteur';

export type EtapeIntegration =
  | 'message_bienvenue_envoye'
  | 'premier_appel_effectue'
  | 'inscription_cellule'
  | 'journee_integration'
  | 'cours_antioche_valides'
  | 'service_departement'
  | 'integration_confirmee';

export interface ChecklistItem {
  id:            string;
  contact_id:    string;
  etape:         EtapeIntegration;
  complete:      boolean;
  complete_par?: { id: string; prenom: string; nom: string } | null;
  complete_le?:  string | null;
  commentaire?:  string | null;
  created_at:    string;
}

export type TypeNotification =
  | 'nouveau_contact_assigne'
  | 'contact_sans_referent'
  | 'planning_non_confirme'
  | 'rappel_evenement'
  | 'checklist_completee'
  | 'nouvelle_candidature_ouvrier';

export interface Notification {
  id:         string;
  user_id:    string;
  type:       TypeNotification;
  titre:      string;
  message:    string;
  lue:        boolean;
  lien?:      string | null;
  created_at: string;
}

export type StatutMessage   = 'en_attente' | 'envoye' | 'echoue';
export type TypeMessage     = 'bienvenue' | 'evenement' | 'actu';
export type StatutEvenement = 'brouillon' | 'planifie' | 'envoye';
export type DestinataireEvenement =
  | 'tous'
  | 'profil_membre_phila'
  | 'profil_visiteur'
  | 'campus_paris'
  | 'campus_paris_nord';

// ─── Modèles ─────────────────────────────────────────────────────────────────

export interface User {
  id:                  string;
  prenom:              string;
  nom:                 string;
  email:               string;
  role:                Role;
  campus:              Campus[];
  actif:               boolean;
  onboarding_complete: boolean;
  created_at:          string;
  updated_at:          string;
}

export interface ConnectionLog {
  id:         string;
  ip:         string;
  user_agent: string | null;
  succes:     boolean;
  raison:     string | null;
  created_at: string;
}

// Version allégée pour les listes de sélection (référents)
export type UserSummary = Pick<User, 'id' | 'prenom' | 'nom' | 'email' | 'role' | 'campus'>;

export interface Contact {
  id:                   string;
  genre:                Genre;
  prenom:               string;
  nom:                  string;
  telephone:            string;
  email?:               string;
  date_naissance?:      string;
  ville:                string;
  code_postal?:         string;
  etat_civil:           EtatCivil;
  statut_phila:         StatutPhila;
  extension_phila?:     Extension;
  profil:               Profil;
  statut:               StatutContact;
  campus:               Campus;
  canal:                Canal;
  saisi_par_membre:     boolean;
  // Profil A
  interet_cellule?:     InteretCellule;
  comment_connu?:       string;
  // Profil B
  souhait?:             Souhait;
  besoins:              BesoinSpirituel[];
  autre_eglise?:        boolean;
  nom_autre_eglise?:    string;
  sert_autre_eglise?:   boolean;
  service_autre_eglise?: string;
  // Commun
  rdv_pasteur:          boolean;
  don?:                 boolean;
  disponibilite_suivi?: DisponibiliteSuivi;
  // Référents
  referent_integration_id?:  string;
  referent_integration?:     UserSummary;
  referent_eglise_id?:       string;
  referent_eglise?:          UserSummary;
  date_attribution_referent?: string;
  // RGPD
  consentement_rgpd:    boolean;
  date_consentement:    string;
  // Ouvrier lié
  ouvrier?:             { id: string; statut: boolean } | null;
  // Meta
  date_inscription:     string;
  derniere_interaction?: string;
  created_at:           string;
  updated_at:           string;
}

// Version allégée pour les listes et tableaux
export type ContactRow = Pick<
  Contact,
  | 'id' | 'genre' | 'prenom' | 'nom' | 'telephone'
  | 'ville' | 'profil' | 'statut' | 'campus' | 'canal'
  | 'date_inscription' | 'derniere_interaction'
> & {
  referent_integration?: UserSummary;
  referent_eglise?:      UserSummary;
};

export interface Commentaire {
  id:          string;
  contact_id:  string;
  auteur_id:   string;
  auteur:      UserSummary & { role: Role };
  role_auteur: Role;
  contenu:     string;
  created_at:  string;
  updated_at:  string;
}

export interface HistoriqueStatut {
  id:            string;
  contact_id:    string;
  statut_avant:  StatutContact;
  statut_apres:  StatutContact;
  change_par_id: string;
  change_par:    UserSummary & { role: Role };
  commentaire?:  string;
  created_at:    string;
}

export interface Ouvrier {
  id:                  string;
  contact_id?:         string;
  contact?:            Pick<Contact, 'id' | 'profil' | 'statut'>;
  prenom:              string;
  nom:                 string;
  telephone:           string;
  email?:              string;
  campus:              Campus;
  services:            string[];
  date_debut_service?: string;
  statut:              boolean;
  inscription_directe: boolean;
  created_at:          string;
  updated_at:          string;
}

export interface Message {
  id:          string;
  contact_id?: string;
  contact?:    Pick<Contact, 'id' | 'prenom' | 'nom' | 'telephone'>;
  type:        TypeMessage;
  contenu:     string;
  canal:       string;
  statut:      StatutMessage;
  twilio_sid?: string;
  planifie_le?: string;
  envoye_le?:  string;
  created_by?: string;
  evenement_id?: string;
  created_at:  string;
}

export interface Evenement {
  id:               string;
  titre:            string;
  description?:     string;
  campus?:          Campus;
  date_evenement:   string;
  message_template: string;
  destinataires:    DestinataireEvenement;
  statut:           StatutEvenement;
  planifie_le?:     string;
  envoye_le?:       string;
  created_by:       string;
  createur:         UserSummary;
  created_at:       string;
  updated_at:       string;
  _count?:          { messages: number };
}

export type RoleService      = 'identification_nm' | 'service_salle' | 'preparation_salle' | 'service_en_ligne';
export type StatutAffectation = 'en_attente' | 'accepte' | 'decline';

export interface AffectationPlanning {
  id:           string;
  planning_id:  string;
  ouvrier_id:   string;
  // Present in listAffectations (admin view); absent in mesAffectations (self view)
  ouvrier?: { id: string; prenom: string; nom: string; telephone: string; campus: Campus };
  role_service: RoleService;
  statut:       StatutAffectation;
  repondu_le?:  string | null;
  created_at:   string;
  // Present in mesAffectations
  planning?: { id: string; date_dimanche: string; campus: Campus; nouveaux_membres?: string | null };
}

export interface PlanningService {
  id:               string;
  date_dimanche:    string;
  campus:           Campus;
  nouveaux_membres?: string | null;
  service_salle?:   string | null;
  preparation_salle?: string | null;
  priere_lundi?:    string | null;
  created_by:       string;
  createur?:        UserSummary;
  affectations?:    AffectationPlanning[];
  _count?:          { affectations: number };
  created_at:       string;
  updated_at:       string;
}

// ─── Payloads API ─────────────────────────────────────────────────────────────

export interface LoginPayload   { email: string; password: string }
export interface LoginResponse  { accessToken: string; refreshToken: string; user: User }

export interface PaginatedResponse<T> {
  contacts?: T[];     // /contacts retourne "contacts"
  total:     number;
  page:      number;
  limit:     number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthState {
  user:  User | null;
  token: string | null;
}

// ─── Stats / Graphiques ───────────────────────────────────────────────────────

export interface InscriptionMoisData {
  mois:       string;
  presentiel: number;
  en_ligne:   number;
}

export interface ProfilData {
  name:  string;
  value: number;
  color: string;
}

export interface StatutData {
  statut: string;
  count:  number;
}

export interface MessageSemaineData {
  semaine: string;
  count:   number;
}

export interface TauxConversionData {
  campus:   string;
  total:    number;
  integres: number;
  taux:     number;
}

export interface TempsIntegrationData {
  moyenne_jours: number;
  median_jours:  number;
  min_jours:     number;
  max_jours:     number;
}

export interface PerformanceReferentData {
  id:                string;
  prenom:            string;
  nom:               string;
  contacts_total:    number;
  contacts_integres: number;
  contacts_actifs:   number;
  taux_conversion:   number;
  temps_moyen_jours: number;
}

export interface EvolutionHebdomadaireData {
  semaine:  string;
  nouveaux: number;
  integres: number;
  messages: number;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'creation'
  | 'modification'
  | 'suppression'
  | 'changement_statut'
  | 'assignation_referent'
  | 'checklist_cochee';

export interface AuditLog {
  id:              string;
  entite:          string;
  entite_id:       string;
  action:          AuditAction;
  champ?:          string | null;
  ancienne_valeur?: string | null;
  nouvelle_valeur?: string | null;
  description:     string;
  auteur_id:       string;
  auteur:          { id: string; prenom: string; nom: string; role: Role };
  created_at:      string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardAlerts {
  message:  string;
  contacts: ContactRow[];
}

export interface ContactStats {
  total:   number;
  nouveau: number;
  contacte: number;
  en_suivi: number;
  integre:  number;
  ouvrier:  number;
  inactif:  number;
}
