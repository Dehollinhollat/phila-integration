// src/hooks/useNotifications.ts
// Hook de gestion des notifications in-app.
// Charge la liste complète au montage, puis interroge le compteur
// non-lues toutes les 30 secondes en arrière-plan.

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Notification } from '../types';
import { notificationsEndpoints } from '../services/endpoints';

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount:   number;
  loading:       boolean;
  markAsRead:    (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh:       () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Récupère uniquement le compteur non-lues (requête légère pour le polling)
  const fetchCount = useCallback(async () => {
    try {
      const res = await notificationsEndpoints.list(false);
      setUnreadCount(res.data.nonLues);
    } catch { /* silent - polling non bloquant */ }
  }, []);

  // Récupère la liste complète (50 max, triées par date desc)
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsEndpoints.list();
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.nonLues);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  // Chargement initial + polling toutes les 30 secondes
  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(fetchCount, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh, fetchCount]);

  // Marque une notification comme lue (optimistic update)
  const markAsRead = useCallback(async (id: string) => {
    const prev = notifications.find(n => n.id === id);
    if (!prev || prev.lue) return;
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, lue: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
    try {
      await notificationsEndpoints.markAsRead(id);
    } catch {
      // Rollback si l'API échoue
      setNotifications(ns => ns.map(n => n.id === id ? { ...n, lue: false } : n));
      setUnreadCount(c => c + 1);
    }
  }, [notifications]);

  // Marque toutes les notifications comme lues
  const markAllAsRead = useCallback(async () => {
    const prevNotifs = notifications;
    const prevCount  = unreadCount;
    setNotifications(ns => ns.map(n => ({ ...n, lue: true })));
    setUnreadCount(0);
    try {
      await notificationsEndpoints.markAllAsRead();
    } catch {
      setNotifications(prevNotifs);
      setUnreadCount(prevCount);
    }
  }, [notifications, unreadCount]);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh };
}
