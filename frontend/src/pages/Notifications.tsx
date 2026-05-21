// src/pages/Notifications.tsx
// Page complète des notifications — liste paginée, filtre lu/non lu, marquage groupé.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsEndpoints } from '../services/endpoints';
import type { Notification, TypeNotification } from '../types';

// ─── Config par type ──────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<TypeNotification, { color: string; label: string; icon: string }> = {
  nouveau_contact_assigne:      { color: '#3B82F6', label: 'Contact assigné', icon: '👤' },
  contact_sans_referent:        { color: '#EF4444', label: 'Sans référent',   icon: '⚠️' },
  planning_non_confirme:        { color: '#F59E0B', label: 'Planning',        icon: '📋' },
  rappel_evenement:             { color: '#8B5CF6', label: 'Événement',       icon: '📅' },
  checklist_completee:          { color: '#10B981', label: 'Intégration',     icon: '✅' },
  nouvelle_candidature_ouvrier: { color: '#8B5CF6', label: 'Candidature',    icon: '⛪' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)     return "à l'instant";
  if (diff < 3600)   return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400)  return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'hier';
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)} jours`;
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

function resolveLink(notif: Notification): string {
  if (notif.lien && notif.lien !== '/notifications') return notif.lien;
  switch (notif.type) {
    case 'nouvelle_candidature_ouvrier': return '/ouvriers';
    case 'contact_sans_referent':        return '/contacts?sans_referent=true';
    case 'nouveau_contact_assigne':      return '/contacts';
    case 'rappel_evenement':             return '/messagerie';
    case 'planning_non_confirme':        return '/mon-planning';
    default:                             return '/dashboard';
  }
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filter,        setFilter]        = useState<'all' | 'unread'>('all');
  const [markingAll,    setMarkingAll]    = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await notificationsEndpoints.list();
      setNotifications(data.notifications);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleMarkAsRead(id: string) {
    try {
      await notificationsEndpoints.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, lue: true } : n));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleMarkAll() {
    setMarkingAll(true);
    try {
      await notificationsEndpoints.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, lue: true })));
    } catch (err) {
      console.error(err);
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleClick(notif: Notification) {
    await handleMarkAsRead(notif.id);
    navigate(resolveLink(notif));
  }

  const displayed    = filter === 'unread' ? notifications.filter(n => !n.lue) : notifications;
  const unreadCount  = notifications.filter(n => !n.lue).length;

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 24px) clamp(12px, 3vw, 32px)', maxWidth: 760, margin: '0 auto' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
            Notifications
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            {unreadCount > 0
              ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
              : 'Tout est lu'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            disabled={markingAll}
            style={{
              padding: '8px 16px', borderRadius: 8,
              border: '1px solid var(--accent-teal)', background: 'transparent',
              color: 'var(--accent-teal)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', opacity: markingAll ? 0.6 : 1,
              fontFamily: 'inherit',
            }}
          >
            {markingAll ? 'Marquage…' : 'Tout marquer comme lu'}
          </button>
        )}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', 'unread'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontFamily: 'inherit',
              border: `1px solid ${filter === f ? 'var(--accent-teal)' : 'var(--bg-card-border)'}`,
              background: filter === f ? 'var(--accent-teal)' : 'transparent',
              color: filter === f ? '#fff' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {f === 'all' ? `Toutes (${notifications.length})` : `Non lues (${unreadCount})`}
          </button>
        ))}
      </div>

      {/* Skeleton */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{
              height: 80, borderRadius: 8,
              background: 'var(--bg-secondary)',
              animation: 'notif-pulse 1.4s ease-in-out infinite',
            }} />
          ))}
          <style>{`@keyframes notif-pulse { 0%,100%{opacity:.6} 50%{opacity:1} }`}</style>
        </div>

      ) : displayed.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 12, padding: 64, color: 'var(--text-secondary)',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span style={{ fontSize: 14 }}>
            {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
          </span>
        </div>

      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayed.map(notif => {
            const cfg = TYPE_CONFIG[notif.type] ?? { color: '#6B7280', label: notif.type, icon: '🔔' };
            return (
              <button
                key={notif.id}
                onClick={() => handleClick(notif)}
                style={{
                  width: '100%', textAlign: 'left', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '14px 16px', borderRadius: 8,
                  background: notif.lue ? 'var(--bg-card)' : 'var(--bg-secondary)',
                  border:     '1px solid var(--bg-card-border)',
                  borderLeft: notif.lue ? '1px solid var(--bg-card-border)' : `3px solid ${cfg.color}`,
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
              >
                {/* Icône colorée */}
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: `${cfg.color}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17,
                }}>
                  {cfg.icon}
                </div>

                {/* Contenu */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {notif.titre}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {formatRelative(notif.created_at)}
                      </span>
                      {!notif.lue && (
                        <span style={{
                          padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                          background: `${cfg.color}22`, color: cfg.color,
                        }}>
                          Non lue
                        </span>
                      )}
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {notif.message}
                  </p>

                  <span style={{
                    display: 'inline-block', marginTop: 6,
                    padding: '2px 8px', borderRadius: 20, fontSize: 11,
                    background: 'var(--bg-secondary)', color: 'var(--text-tertiary)',
                  }}>
                    {cfg.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
