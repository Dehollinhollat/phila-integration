// src/services/api.ts
// Instance Axios centralisée pour tous les appels vers le backend Phila Intégration.
//
// Intercepteurs :
// - Request  : injecte automatiquement le Bearer token depuis localStorage
// - Response : redirige vers /login sur toute réponse 401

import axios from 'axios';
import { API_BASE } from '../utils/constants';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Intercepteur requête — injection du JWT ───────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('phila_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Intercepteur réponse — gestion des erreurs globales ──────────────────────
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !window.location.pathname.includes('/login')
    ) {
      localStorage.removeItem('phila_token');
      localStorage.removeItem('phila_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
