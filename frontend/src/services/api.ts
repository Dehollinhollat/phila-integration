// src/services/api.ts
// Instance Axios centralisée pour tous les appels vers le backend Phila Intégration.
//
// Intercepteurs :
// - Request  : injecte automatiquement le Bearer token depuis localStorage
// - Response : sur 401, tente un refresh silencieux avant de rediriger vers /login

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

// ── Refresh token — évite les races conditions avec une file d'attente ────────
let isRefreshing = false;
type QueueEntry = { resolve: (token: string) => void; reject: (err: unknown) => void };
let failedQueue: QueueEntry[] = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(entry => {
    if (error) entry.reject(error);
    else       entry.resolve(token!);
  });
  failedQueue = [];
}

// ── Intercepteur réponse — renouvellement silencieux du token ─────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const status = error.response?.status;

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !window.location.pathname.includes('/login')
    ) {
      const refreshToken = localStorage.getItem('phila_refresh_token');

      // Pas de refresh token → déconnexion immédiate
      if (!refreshToken) {
        localStorage.removeItem('phila_token');
        localStorage.removeItem('phila_refresh_token');
        localStorage.removeItem('phila_user');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // D'autres requêtes attendent déjà le refresh — on les met en file
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers!['Authorization'] = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post<{ accessToken: string }>(
          `${API_BASE}/auth/refresh`,
          { refreshToken }
        );
        const newToken = data.accessToken;
        localStorage.setItem('phila_token', newToken);
        processQueue(null, newToken);
        originalRequest.headers!['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('phila_token');
        localStorage.removeItem('phila_refresh_token');
        localStorage.removeItem('phila_user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
