// src/services/endpoints.ts
// Fonctions d'appel API organisées par ressource.
// Chaque fonction retourne directement la data Axios, sans try/catch :
// la gestion des erreurs est faite dans les hooks ou les composants appelants.

import api from './api';
import type {
  LoginPayload, LoginResponse, User, ConnectionLog,
  Contact, ContactRow, PaginatedResponse,
  Commentaire, HistoriqueStatut,
  Ouvrier, Message, Evenement, PlanningService,
  AffectationPlanning, RoleService,
  DashboardAlerts,
  StatutContact, Campus, Canal, Role,
  ChecklistItem, EtapeIntegration,
  Notification,
  InscriptionMoisData, ProfilData, StatutData, MessageSemaineData, AuditLog,
  TauxConversionData, TempsIntegrationData, PerformanceReferentData, EvolutionHebdomadaireData,
  ContactAvecBadge, SuggestionReferent,
} from '../types';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authEndpoints = {
  login:          (p: LoginPayload)       => api.post<LoginResponse>('/auth/login', p),
  me:             ()                      => api.get<User>('/auth/me'),
  listUsers:      (campus?: Campus)       => api.get<User[]>('/auth/users', { params: { campus } }),
  createUser:     (data: Partial<User> & { password: string }) => api.post<User>('/auth/users', data),
  updateUser:     (id: string, data: Partial<User> & { password?: string }) => api.patch<User>(`/auth/users/${id}`, data),
  deactivateUser: (id: string)            => api.delete(`/auth/users/${id}`),
};

// ─── Contacts ─────────────────────────────────────────────────────────────────

export interface ContactFilters {
  campus?:  Campus;
  profil?:  string;
  statut?:  StatutContact;
  canal?:   Canal;
  search?:  string;
  page?:    number;
  limit?:   number;
}

// Filtres de ciblage avancé — utilisés pour le compteur temps réel (MessageCompose)
// et transmis dans le body de createEvenement pour déterminer les destinataires.
export interface FiltresDestinataires {
  campus?:           string;  // 'paris' | 'paris_nord'
  profil?:           string;  // 'membre_phila' | 'visiteur_sans_eglise' | 'visiteur_avec_eglise'
  statut?:           string;  // StatutContact enum value
  besoin_spirituel?: string;  // BesoinSpirituel value (priere | bapteme | suivi | rencontrer_pasteur)
  interet_cellule?:  string;  // 'oui' | 'peut_etre'
  canal?:            string;  // 'presentiel' | 'en_ligne'
  date_debut?:       string;  // YYYY-MM-DD
  date_fin?:         string;  // YYYY-MM-DD
  rdv_pasteur?:      boolean;
}

export const contactsEndpoints = {
  list:             (filters?: ContactFilters) =>
    api.get<PaginatedResponse<ContactRow>>('/contacts', { params: filters }),
  get:              (id: string)              => api.get<Contact>(`/contacts/${id}`),
  create:           (data: Partial<Contact>)  => api.post<Contact>('/contacts', data),
  update:           (id: string, data: Partial<Contact>) => api.patch<Contact>(`/contacts/${id}`, data),
  updateFull:       (id: string, data: Partial<Contact>) => api.put<Contact>(`/contacts/${id}`, data),
  delete:           (id: string)              => api.delete(`/contacts/${id}`),
  updateStatut:     (id: string, statut: StatutContact, commentaire?: string) =>
    api.patch<Contact>(`/contacts/${id}/statut`, { statut, commentaire }),
  listCommentaires: (id: string)              => api.get<Commentaire[]>(`/contacts/${id}/commentaires`),
  createCommentaire:(id: string, contenu: string) =>
    api.post<Commentaire>(`/contacts/${id}/commentaires`, { contenu }),
  historique:       (id: string)              => api.get<HistoriqueStatut[]>(`/contacts/${id}/historique`),
  alerts:           ()                        => api.get<DashboardAlerts>('/contacts/alerts'),
  patchChecklist:   (id: string, etape: EtapeIntegration, complete: boolean, commentaire?: string) =>
    api.patch<ChecklistItem>(`/contacts/${id}/checklist`, { etape, complete, commentaire }),
  initChecklist:    (id: string) =>
    api.post<{ created: number; items: ChecklistItem[] }>(`/contacts/${id}/checklist/init`),
  patchReferents:   (id: string, referent_integration_id?: string | null, referent_eglise_id?: string | null) =>
    api.patch<Contact>(`/contacts/${id}/referents`, { referent_integration_id, referent_eglise_id }),
  count:            (params?: FiltresDestinataires) =>
    api.get<{ count: number }>('/contacts/count', { params }),
  checkPhone:       (phone: string, excludeId?: string) =>
    api.get<{ exists: boolean; id: string | null }>('/contacts/check-phone', { params: { phone, excludeId } }),
  mesContacts:        () => api.get<ContactAvecBadge[]>('/contacts/mes-contacts'),
  suggererReferent:   (id: string) => api.get<{ suggestion: SuggestionReferent | null; tous_les_referents: SuggestionReferent[] }>(`/contacts/${id}/suggerer-referent`),
};

// ─── Checklist ────────────────────────────────────────────────────────────────

export const checklistEndpoints = {
  byContact: (contactId: string) => api.get<ChecklistItem[]>(`/checklist/contact/${contactId}`),
};

// ─── Référents ────────────────────────────────────────────────────────────────

export const referentsEndpoints = {
  list:                 (campus?: Campus, role?: string) =>
    api.get<User[]>('/referents', { params: { campus, role } }),
  assignIntegration:    (contactId: string, referentId: string) =>
    api.patch<Contact>(`/referents/contacts/${contactId}/integration`, { referentId }),
  removeIntegration:    (contactId: string) =>
    api.delete<Contact>(`/referents/contacts/${contactId}/integration`),
  assignEglise:         (contactId: string, referentId: string) =>
    api.patch<Contact>(`/referents/contacts/${contactId}/eglise`, { referentId }),
  removeEglise:         (contactId: string) =>
    api.delete<Contact>(`/referents/contacts/${contactId}/eglise`),
  charge:               () =>
    api.get<{
      integration: ChargeReferent[];
      eglise:      ChargeReferent[];
      sans_referent: number;
    }>('/referents/charge'),
  reassigner: (data: { contact_ids: string[]; nouveau_referent_id: string; type: 'integration' | 'eglise' }) =>
    api.post<{ reassigned: number }>('/referents/reassigner', data),
};

export interface ChargeReferent {
  id:       string;
  prenom:   string;
  nom:      string;
  email:    string;
  role:     Role;
  campus:   Campus[];
  count:    number;
  contacts: Array<{ id: string; prenom: string; nom: string; statut: StatutContact; campus: Campus }>;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messagesEndpoints = {
  list:          (params?: { type?: string; statut?: string; campus?: string; periode?: string; page?: number }) =>
    api.get<{ messages: Message[]; total: number }>('/messages', { params }),
  byContact:     (contactId: string) => api.get<Message[]>(`/messages/contact/${contactId}`),
  sendBienvenue: (contactId: string) => api.post<{ message: Message }>(`/messages/bienvenue/${contactId}`),
  getMessage:    (id: string) => api.get<Message>(`/messages/${id}`),
  createEvenement: (data: {
    titre:               string;
    message_template:    string;
    date_evenement:      string;
    planifie_le?:        string;
    envoyer_maintenant?: boolean;
    dest_type?:          'contacts' | 'ouvriers' | 'tous';
    filtres?:            FiltresDestinataires;
    filtres_ouvriers?:   { campus?: string; service?: string };
  }) => api.post<Evenement>('/messages/evenement', data),
};

// ─── Ouvriers ─────────────────────────────────────────────────────────────────

export const ouvriersEndpoints = {
  list: (params?: { campus?: string; statut?: string; service?: string; search?: string }) =>
    api.get<Ouvrier[]>('/ouvriers', { params }),
  count: (params?: { campus?: string; service?: string }) =>
    api.get<{ count: number }>('/ouvriers/count', { params }),
  get:  (id: string) => api.get<Ouvrier>(`/ouvriers/${id}`),

  // Création unifiée : inscription_directe: true → direct, contact_id fourni → promotion
  create: (data: {
    contact_id?:         string;
    prenom:              string;
    nom:                 string;
    telephone:           string;
    email?:              string;
    campus:              string;
    services?:           string[];
    date_debut_service?: string;
    inscription_directe: boolean;
  }) => api.post<Ouvrier>('/ouvriers', data),

  update:       (id: string, data: Partial<Ouvrier>) => api.put<Ouvrier>(`/ouvriers/${id}`, data),
  toggleStatut: (id: string, statut: boolean)        =>
    api.patch<Ouvrier>(`/ouvriers/${id}/statut`, { statut }),
  deactivate:   (id: string) => api.delete(`/ouvriers/${id}`),

  // Routes publiques — formulaire candidature (/form/ouvrier)
  candidature: (data: {
    genre?:             string;
    prenom:             string;
    nom:                string;
    telephone:          string;
    email?:             string;
    ville:              string;
    code_postal?:       string;
    campus:             string;
    disponibilites:     string[];
    services:           string[];
    a_deja_servi:       boolean;
    eglise_precedente?: string;
    service_precedent?: string;
    motivation?:        string;
    consentement_rgpd:  true;
  }) => api.post<Ouvrier>('/ouvriers/candidature', data),

  checkPhone: (phone: string) =>
    api.get<{ exists: boolean }>('/ouvriers/check-phone', { params: { phone } }),
};

// ─── Événements ───────────────────────────────────────────────────────────────

export const evenementsEndpoints = {
  list:      (params?: { statut?: string; campus?: Campus }) =>
    api.get<Evenement[]>('/evenements', { params }),
  get:       (id: string)                 => api.get<Evenement>(`/evenements/${id}`),
  create:    (data: Partial<Evenement>)   => api.post<Evenement>('/evenements', data),
  update:    (id: string, data: Partial<Evenement>) => api.patch<Evenement>(`/evenements/${id}`, data),
  delete:    (id: string)                 => api.delete(`/evenements/${id}`),
  planifier: (id: string, planifie_le: string) =>
    api.post<Evenement>(`/evenements/${id}/planifier`, { planifie_le }),
  envoyer: (id: string) =>
    api.post<{ evenement: Evenement; sent: number; failed: number; total: number }>(
      `/evenements/${id}/envoyer`
    ),
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsEndpoints = {
  list:         (lue?: boolean) =>
    api.get<{ notifications: Notification[]; total: number; nonLues: number }>(
      '/notifications',
      lue !== undefined ? { params: { lue } } : undefined
    ),
  markAsRead:   (id: string) =>
    api.patch<Notification>(`/notifications/${id}/lue`),
  markAllAsRead: () =>
    api.patch<{ message: string }>('/notifications/lues'),
};

// ─── Planning ─────────────────────────────────────────────────────────────────

export const planningEndpoints = {
  list:   (params?: { campus?: Campus; from?: string; to?: string }) =>
    api.get<PlanningService[]>('/planning', { params }),
  get:    (id: string)                        => api.get<PlanningService>(`/planning/${id}`),
  create: (data: Partial<PlanningService>)    => api.post<PlanningService>('/planning', data),
  update: (id: string, data: Partial<PlanningService>) => api.patch<PlanningService>(`/planning/${id}`, data),
  delete: (id: string)                        => api.delete(`/planning/${id}`),
};

// ─── Profil utilisateur courant ───────────────────────────────────────────────

export const profileEndpoints = {
  get:                ()                                                   => api.get<User>('/users/me'),
  update:             (data: { prenom?: string; nom?: string })           => api.put<User>('/users/me', data),
  changePassword:     (data: { current_password: string; new_password: string }) =>
    api.patch<{ message: string }>('/users/me/password', data),
  completeOnboarding: ()                                                  => api.patch<User>('/users/me/onboarding'),
};

// ─── Users Admin ─────────────────────────────────────────────────────────────

export interface DeleteConflict {
  message:              string;
  contacts_integration: number;
  contacts_eglise:      number;
}

export const usersAdminEndpoints = {
  list:          (campus?: string, role?: string) =>
    api.get<User[]>('/users', { params: { campus, role } }),
  checkEmail:    (email: string, excludeId?: string) =>
    api.get<{ available: boolean }>('/users/check-email', { params: { email, excludeId } }),
  create:        (data: Partial<User>)             => api.post<User>('/users', data),
  update:        (id: string, data: Partial<User>) => api.put<User>(`/users/${id}`, data),
  toggleStatut:  (id: string)                      => api.patch<User>(`/users/${id}/statut`),
  resetPassword: (id: string, password: string)    => api.patch(`/users/${id}/password`, { password }),
  connexions:    (id: string)                      => api.get<ConnectionLog[]>(`/users/${id}/connexions`),
  delete:        (id: string)                      => api.delete<{ message: string }>(`/users/${id}`),
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export const settingsEndpoints = {
  get:    ()                                     => api.get<Record<string, string>>('/settings'),
  update: (entries: { key: string; value: string }[]) =>
    api.put<Record<string, string>>('/settings', entries),
};

// ─── Affectations ─────────────────────────────────────────────────────────────

export const affectationsEndpoints = {
  list:    (planningId: string) =>
    api.get<AffectationPlanning[]>('/affectations', { params: { planning_id: planningId } }),
  create:  (data: { planning_id: string; ouvrier_id: string; role_service: RoleService }) =>
    api.post<AffectationPlanning>('/affectations', data),
  respond: (id: string, statut: 'accepte' | 'decline') =>
    api.patch<AffectationPlanning>(`/affectations/${id}/statut`, { statut }),
  delete:  (id: string) => api.delete(`/affectations/${id}`),
  mes:     ()           => api.get<AffectationPlanning[]>('/affectations/mes'),
};

// ─── Statistiques ─────────────────────────────────────────────────────────────

export const statsEndpoints = {
  inscriptionsParMois: (params?: { campus?: string; mois?: number }) =>
    api.get<InscriptionMoisData[]>('/stats/inscriptions-par-mois', { params }),
  profils: (params?: { campus?: string }) =>
    api.get<ProfilData[]>('/stats/profils', { params }),
  statuts: (params?: { campus?: string }) =>
    api.get<StatutData[]>('/stats/statuts', { params }),
  messagesParSemaine: (params?: { semaines?: number }) =>
    api.get<MessageSemaineData[]>('/stats/messages-par-semaine', { params }),
  tauxConversion: () =>
    api.get<TauxConversionData[]>('/stats/taux-conversion'),
  tempsIntegration: () =>
    api.get<TempsIntegrationData>('/stats/temps-integration'),
  performanceReferents: () =>
    api.get<PerformanceReferentData[]>('/stats/performance-referents'),
  evolutionHebdomadaire: (params?: { semaines?: number }) =>
    api.get<EvolutionHebdomadaireData[]>('/stats/evolution-hebdomadaire', { params }),
  rapportHebdomadaire: () =>
    api.post<{ message: string; destinataires: number }>('/stats/rapport-hebdomadaire'),
};

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const auditEndpoints = {
  byContact: (contactId: string) =>
    api.get<AuditLog[]>(`/contacts/${contactId}/audit`),
};
