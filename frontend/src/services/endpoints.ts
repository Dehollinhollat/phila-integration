// src/services/endpoints.ts
// Fonctions d'appel API organisées par ressource.
// Chaque fonction retourne directement la data Axios, sans try/catch :
// la gestion des erreurs est faite dans les hooks ou les composants appelants.

import api from './api';
import type {
  LoginPayload, LoginResponse, User,
  Contact, ContactRow, PaginatedResponse,
  Commentaire, HistoriqueStatut,
  Ouvrier, Message, Evenement, PlanningService,
  DashboardAlerts,
  StatutContact, Campus,
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
  search?:  string;
  page?:    number;
  limit?:   number;
}

export const contactsEndpoints = {
  list:             (filters?: ContactFilters) =>
    api.get<PaginatedResponse<ContactRow>>('/contacts', { params: filters }),
  get:              (id: string)              => api.get<Contact>(`/contacts/${id}`),
  create:           (data: Partial<Contact>)  => api.post<Contact>('/contacts', data),
  update:           (id: string, data: Partial<Contact>) => api.patch<Contact>(`/contacts/${id}`, data),
  delete:           (id: string)              => api.delete(`/contacts/${id}`),
  updateStatut:     (id: string, statut: StatutContact, commentaire?: string) =>
    api.patch<Contact>(`/contacts/${id}/statut`, { statut, commentaire }),
  listCommentaires: (id: string)              => api.get<Commentaire[]>(`/contacts/${id}/commentaires`),
  createCommentaire:(id: string, contenu: string) =>
    api.post<Commentaire>(`/contacts/${id}/commentaires`, { contenu }),
  historique:       (id: string)              => api.get<HistoriqueStatut[]>(`/contacts/${id}/historique`),
  alerts:           ()                        => api.get<DashboardAlerts>('/contacts/alerts'),
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
};

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messagesEndpoints = {
  list:          (params?: { type?: string; statut?: string; page?: number }) =>
    api.get<{ messages: Message[]; total: number }>('/messages', { params }),
  byContact:     (contactId: string) => api.get<Message[]>(`/messages/contact/${contactId}`),
  sendBienvenue: (contactId: string) => api.post<{ message: Message }>(`/messages/bienvenue/${contactId}`),
};

// ─── Ouvriers ─────────────────────────────────────────────────────────────────

export const ouvriersEndpoints = {
  list:       (campus?: Campus) => api.get<Ouvrier[]>('/ouvriers', { params: { campus } }),
  get:        (id: string)      => api.get<Ouvrier>(`/ouvriers/${id}`),
  create:     (data: Partial<Ouvrier>) => api.post<Ouvrier>('/ouvriers', data),
  promote:    (contactId: string, data: { services?: string[]; date_debut_service?: string }) =>
    api.post<Ouvrier>(`/ouvriers/contacts/${contactId}/promouvoir`, data),
  update:     (id: string, data: Partial<Ouvrier>) => api.patch<Ouvrier>(`/ouvriers/${id}`, data),
  deactivate: (id: string) => api.delete(`/ouvriers/${id}`),
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
