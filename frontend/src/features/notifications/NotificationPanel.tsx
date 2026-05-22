// src/features/notifications/NotificationPanel.tsx
// Panneau déroulant des notifications - s'affiche sous l'icône cloche de l'AppBar.
// Reçoit les données et callbacks du hook useNotifications via AppBar.

import { useNavigate } from 'react-router-dom';
import type { Notification, TypeNotification } from '../../types';

// ─── Config par type ──────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<TypeNotification, { color: string; label: string }> = {
  nouveau_contact_assigne:      { color: 'var(--accent-blue)',   label: 'Contact assigné' },
  contact_sans_referent:        { color: 'var(--accent-red)',    label: 'Sans référent' },
  planning_non_confirme:        { color: 'var(--accent-gold)',   label: 'Planning' },
  rappel_evenement:             { color: 'var(--accent-violet)', label: 'Événement' },
  checklist_completee:          { color: 'var(--accent-teal)',   label: 'Intégration' },
  nouvelle_candidature_ouvrier: { color: '#8B5CF6',              label: 'Candidature' },
  alerte_risque:                { color: '#EF4444',              label: 'Alerte risque' },
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  notifications: Notification[];
  loading:       boolean;
  onMarkAsRead:  (id: string) => Promise<void>;
  onMarkAll:     () => Promise<void>;
  onClose:       () => void;
  panelRef:      React.RefObject<HTMLDivElement | null>;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function NotificationPanel({
  notifications, loading, onMarkAsRead, onMarkAll, onClose, panelRef,
}: Props) {
  const navigate = useNavigate();

  function resolveLink(notif: Notification): string {
    // Priorité au lien explicite stocké sur la notification, sauf /notifications qui n'existe pas
    if (notif.lien && notif.lien !== '/notifications') return notif.lien;
    // Fallback basé sur le type
    switch (notif.type) {
      case 'nouvelle_candidature_ouvrier': return '/ouvriers';
      case 'contact_sans_referent':        return '/contacts?sans_referent=true';
      case 'nouveau_contact_assigne':      return '/contacts';
      case 'rappel_evenement':             return '/messagerie';
      case 'planning_non_confirme':        return '/mon-planning';
      default:                             return '/dashboard';
    }
  }

  function handleClick(notif: Notification) {
    onMarkAsRead(notif.id).catch(console.error);
    onClose();
    navigate(resolveLink(notif));
  }

  const hasUnread = notifications.some(n => !n.lue);

  return (
    <div
      ref={panelRef}
      style={{
        position:     'fixed',
        top:          '60px',
        right:        '16px',
        width:        '380px',
        maxHeight:    '80vh',
        overflowY:    'auto',
        zIndex:       900,
        background:   'var(--bg-card-solid, var(--bg-card))',
        border:       '1px solid var(--bg-card-border)',
        borderRadius: '12px',
        boxShadow:    '0 8px 32px rgba(0,0,0,0.3)',
        display:      'flex',
        flexDirection:'column',
        overflow:     'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display:       'flex',
        alignItems:    'center',
        justifyContent:'space-between',
        padding:       '14px 16px',
        borderBottom:  '1px solid var(--bg-card-border)',
        flexShrink:    0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          Notifications
        </span>
        {hasUnread && (
          <button
            onClick={onMarkAll}
            style={{
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              fontSize:   12,
              color:      'var(--accent-teal)',
              fontWeight: 600,
              padding:    0,
              fontFamily: 'inherit',
            }}
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Liste */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            Chargement…
          </div>
        ) : notifications.length === 0 ? (
          <div style={{
            padding:       48,
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            gap:           10,
            color:         'var(--text-secondary)',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span style={{ fontSize: 13 }}>Aucune notification</span>
          </div>
        ) : (
          notifications.map(notif => {
            const cfg = TYPE_CONFIG[notif.type];
            return (
              <button
                key={notif.id}
                onClick={() => handleClick(notif)}
                style={{
                  width:      '100%',
                  display:    'flex',
                  gap:        12,
                  padding:    '12px 16px',
                  background: notif.lue ? 'transparent' : 'var(--bg-secondary)',
                  border:     'none',
                  borderLeft: notif.lue ? '3px solid transparent' : `3px solid ${cfg.color}`,
                  borderBottom: '1px solid var(--bg-card-border)',
                  cursor:     'pointer',
                  textAlign:  'left',
                  transition: 'background 0.15s',
                  fontFamily: 'inherit',
                }}
              >
                {/* Pastille colorée */}
                <div style={{
                  width:        8,
                  height:       8,
                  borderRadius: '50%',
                  background:   cfg.color,
                  flexShrink:   0,
                  marginTop:    5,
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize:   13,
                    fontWeight: 600,
                    color:      'var(--text-primary)',
                    marginBottom: 2,
                    overflow:    'hidden',
                    textOverflow:'ellipsis',
                    whiteSpace:  'nowrap',
                  }}>
                    {notif.titre}
                  </div>
                  <div style={{
                    fontSize:   12,
                    color:      'var(--text-secondary)',
                    lineHeight: 1.4,
                    marginBottom: 4,
                    display:    '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as const,
                    overflow:   'hidden',
                  }}>
                    {notif.message}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {formatRelative(notif.created_at)}
                  </div>
                </div>

                {/* Point non-lu */}
                {!notif.lue && (
                  <div style={{
                    width:        6,
                    height:       6,
                    borderRadius: '50%',
                    background:   'var(--accent-teal)',
                    flexShrink:   0,
                    marginTop:    6,
                  }} />
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Footer - lien vers page complète */}
      <div style={{
        borderTop:  '1px solid var(--bg-card-border)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => { onClose(); navigate('/notifications'); }}
          style={{
            width:      '100%',
            padding:    '12px 16px',
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            fontSize:   13,
            fontWeight: 600,
            color:      'var(--accent-teal)',
            textAlign:  'center',
            fontFamily: 'inherit',
          }}
        >
          Voir tout →
        </button>
      </div>
    </div>
  );
}
