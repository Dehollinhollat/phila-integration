// src/layout/AppBar.tsx
// Barre d'application sticky en haut de la zone de contenu.
// - Bouton hamburger (visible uniquement mobile) à gauche pour ouvrir la sidebar
// - Icône cloche avec badge de notifications à droite
// Props : onMenuToggle - callback du bouton hamburger

import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { layout } from '../components/ui/tokens';
import { useNotifications } from '../hooks/useNotifications';
import NotificationPanel from '../features/notifications/NotificationPanel';

// ─── Icône cloche SVG ─────────────────────────────────────────────────────────

function BellIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

// ─── Icône hamburger SVG ──────────────────────────────────────────────────────

function HamburgerIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

// ─── Composant ────────────────────────────────────────────────────────────────

interface AppBarProps {
  onMenuToggle: () => void;
}

export default function AppBar({ onMenuToggle }: AppBarProps) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh } =
    useNotifications();

  const bellRef  = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Ferme le panneau si un modal s'ouvre (évite la superposition)
  useEffect(() => {
    const handleModalOpen = () => setOpen(false);
    document.addEventListener('modal-opened', handleModalOpen);
    return () => document.removeEventListener('modal-opened', handleModalOpen);
  }, []);

  // Ferme le panneau à chaque changement de page
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Ferme le panneau avec la touche Échap
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  function handleToggle() {
    if (!open) refresh();
    setOpen(o => !o);
  }

  return (
    <header style={{
      height:         layout.appBarHeight,
      background:     'var(--bg-primary)',
      borderBottom:   '1px solid var(--bg-card-border)',
      position:       'sticky',
      top:            0,
      zIndex:         200,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '0 16px 0 12px',
      boxSizing:      'border-box',
      gap:            '8px',
    }}>

      {/* Bouton hamburger - visible uniquement sur mobile via CSS */}
      <button
        className="hamburger-btn"
        onClick={onMenuToggle}
        aria-label="Ouvrir le menu"
      >
        <HamburgerIcon size={22} />
      </button>

      {/* Spacer poussant la cloche à droite sur desktop */}
      <div style={{ flex: 1 }} />

      {/* Bouton cloche */}
      <div style={{ position: 'relative' }}>
        <button
          ref={bellRef}
          onClick={handleToggle}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
          style={{
            width:          36,
            height:         36,
            borderRadius:   '50%',
            border:         'none',
            background:     open ? 'var(--bg-secondary)' : 'transparent',
            color:          'var(--text-secondary)',
            cursor:         'pointer',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            position:       'relative',
            transition:     '120ms ease',
          }}
        >
          <BellIcon size={20} />

          {unreadCount > 0 && (
            <span style={{
              position:       'absolute',
              top:            2, right:  2,
              minWidth:       16, height: 16,
              borderRadius:   '9999px',
              background:     '#DC2626',
              color:          '#fff',
              fontSize:       10, fontWeight: 700,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              padding:        '0 3px',
              lineHeight:     1,
              border:         '1.5px solid var(--bg-primary)',
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <>
            {/* Overlay transparent - capture tous les clics hors panneau et ferme */}
            <div
              onClick={() => setOpen(false)}
              style={{
                position:   'fixed',
                inset:      0,
                zIndex:     898,
                background: 'transparent',
                cursor:     'default',
              }}
            />
            <NotificationPanel
              notifications={notifications}
              loading={loading}
              onMarkAsRead={markAsRead}
              onMarkAll={markAllAsRead}
              onClose={() => setOpen(false)}
              panelRef={panelRef}
            />
          </>
        )}
      </div>
    </header>
  );
}
