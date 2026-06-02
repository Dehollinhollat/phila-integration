// src/layout/AppBar.tsx
// Barre d'application sticky en haut de la zone de contenu.
// - Bouton hamburger (mobile) à gauche
// - Barre de recherche globale avec debounce 300ms + dropdown groupé
// - Icône cloche avec badge de notifications à droite
//
// Recherche : frappe min. 2 caractères → appel GET /api/search?q=…
// Résultats groupés : Contacts / Ouvriers / Utilisateurs
// Ferme au clic en dehors, à la navigation, ou touche Escape.
// Sur mobile : icône loupe → bascule en plein écran de recherche.

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { layout } from '../components/ui/tokens';
import { useNotifications } from '../hooks/useNotifications';
import NotificationPanel from '../features/notifications/NotificationPanel';
import api from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchContact {
  id: string; prenom: string; nom: string;
  telephone: string; profil: string; statut: string;
}
interface SearchOuvrier {
  id: string; prenom: string; nom: string;
  services: string[]; statut: boolean;
}
interface SearchUser {
  id: string; prenom: string; nom: string;
  email: string; role: string;
}
interface SearchResults {
  contacts:     SearchContact[];
  ouvriers:     SearchOuvrier[];
  utilisateurs: SearchUser[];
}

// ─── Icônes SVG ───────────────────────────────────────────────────────────────

function BellIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function HamburgerIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// ─── Composant ────────────────────────────────────────────────────────────────

interface AppBarProps {
  onMenuToggle: () => void;
}

export default function AppBar({ onMenuToggle }: AppBarProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const location    = useLocation();
  const navigate    = useNavigate();

  // ── Notifications ──
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh } =
    useNotifications();
  const bellRef  = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Recherche globale ──
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState<SearchResults | null>(null);
  const [searching,   setSearching]   = useState(false);
  const [searchOpen,  setSearchOpen]  = useState(false); // mobile: loupe expand
  const [dropOpen,    setDropOpen]    = useState(false); // dropdown résultats
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef     = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);
  const [isMobile,    setIsMobile]    = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Ferme tout à chaque changement de page
  useEffect(() => {
    setNotifOpen(false);
    setDropOpen(false);
    setQuery('');
    setSearchOpen(false);
  }, [location.pathname]);

  // Ferme avec Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setNotifOpen(false); setDropOpen(false); setSearchOpen(false); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Ferme le panneau notif si un modal s'ouvre
  useEffect(() => {
    const handler = () => setNotifOpen(false);
    document.addEventListener('modal-opened', handler);
    return () => document.removeEventListener('modal-opened', handler);
  }, []);

  // Ferme le dropdown au clic en dehors de la zone de recherche
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropOpen(false);
        if (isMobile) setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isMobile]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); setDropOpen(false); return; }
    setSearching(true);
    try {
      const { data } = await api.get<SearchResults>('/search', { params: { q } });
      setResults(data);
      setDropOpen(true);
    } catch {
      setResults(null);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleQueryChange(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  }

  function handleNavigate(path: string) {
    navigate(path);
    setDropOpen(false);
    setQuery('');
    setSearchOpen(false);
  }

  const hasResults = results && (
    results.contacts.length > 0 || results.ouvriers.length > 0 || results.utilisateurs.length > 0
  );

  // ── Rendu ─────────────────────────────────────────────────────────────────

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

      {/* Hamburger — mobile uniquement */}
      <button
        className="hamburger-btn"
        onClick={onMenuToggle}
        aria-label="Ouvrir le menu"
      >
        <HamburgerIcon size={22} />
      </button>

      {/* ── Zone de recherche ───────────────────────────────────────────── */}
      {isMobile ? (
        /* Mobile : icône loupe qui expande en plein écran */
        <>
          {searchOpen ? (
            <div ref={searchRef} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg-primary)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-secondary)', border: '1px solid var(--bg-card-border)', borderRadius: 8, padding: '8px 12px' }}>
                  <SearchIcon size={16} />
                  <input
                    ref={inputRef}
                    autoFocus
                    value={query}
                    onChange={e => handleQueryChange(e.target.value)}
                    placeholder="Rechercher un contact, ouvrier, utilisateur…"
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: 'var(--text-primary)' }}
                  />
                  {searching && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>…</span>}
                </div>
                <button onClick={() => { setSearchOpen(false); setDropOpen(false); setQuery(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, padding: '4px 8px' }}>
                  Annuler
                </button>
              </div>
              {dropOpen && <SearchDropdown results={results} hasResults={!!hasResults} onNavigate={handleNavigate} />}
            </div>
          ) : (
            <button
              onClick={() => { setSearchOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: 6 }}
              aria-label="Rechercher"
            >
              <SearchIcon size={20} />
            </button>
          )}
        </>
      ) : (
        /* Desktop : barre inline avec dropdown */
        <div ref={searchRef} style={{ flex: 1, maxWidth: 420, position: 'relative', zIndex: 1100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-secondary)', border: '1px solid var(--bg-card-border)', borderRadius: 8, padding: '7px 12px' }}>
            <SearchIcon size={15} />
            <input
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onFocus={() => { if (results && query.length >= 2) setDropOpen(true); }}
              placeholder="Rechercher…"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)' }}
            />
            {searching && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>…</span>}
          </div>
          {dropOpen && <SearchDropdown results={results} hasResults={!!hasResults} onNavigate={handleNavigate} />}
        </div>
      )}

      {/* Spacer sur desktop quand pas de recherche déployée */}
      {isMobile && !searchOpen && <div style={{ flex: 1 }} />}

      {/* ── Bouton cloche ────────────────────────────────────────────────── */}
      <div style={{ position: 'relative' }}>
        <button
          ref={bellRef}
          onClick={() => { if (!notifOpen) refresh(); setNotifOpen(o => !o); }}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
          style={{
            width:          36, height: 36,
            borderRadius:   '50%',
            border:         'none',
            background:     notifOpen ? 'var(--bg-secondary)' : 'transparent',
            color:          'var(--text-secondary)',
            cursor:         'pointer',
            display:        'flex', alignItems: 'center', justifyContent: 'center',
            position:       'relative',
            transition:     '120ms ease',
          }}
        >
          <BellIcon size={20} />
          {unreadCount > 0 && (
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
              style={{
                position:       'absolute', top: 2, right: 2,
                minWidth: 16, height: 16,
                borderRadius:   '9999px',
                background:     '#DC2626',
                color:          '#fff',
                fontSize: 10, fontWeight: 700,
                display:        'flex', alignItems: 'center', justifyContent: 'center',
                padding:        '0 3px', lineHeight: 1,
                border:         '1.5px solid var(--bg-primary)',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </button>

        {notifOpen && (
          <>
            <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 898, background: 'transparent', cursor: 'default' }} />
            <NotificationPanel
              notifications={notifications}
              loading={loading}
              onMarkAsRead={markAsRead}
              onMarkAll={markAllAsRead}
              onClose={() => setNotifOpen(false)}
              panelRef={panelRef}
            />
          </>
        )}
      </div>
    </header>
  );
}

// ─── Dropdown de résultats ────────────────────────────────────────────────────

const PROFIL_LABELS: Record<string, string> = {
  membre_phila:          'Membre Phila',
  visiteur_sans_eglise:  'Sans église',
  visiteur_avec_eglise:  'Avec église',
};

const ROLE_LABELS: Record<string, string> = {
  super_admin:          'Super Admin',
  admin_campus:         'Admin Campus',
  referent_eglise:      'Réf. Église',
  referent_integration: 'Réf. Intégration',
  lecteur:              'Lecteur',
};

function SearchDropdown({
  results, hasResults, onNavigate,
}: { results: SearchResults | null; hasResults: boolean; onNavigate: (path: string) => void }) {
  const dropStyle: React.CSSProperties = {
    position:     'absolute',
    top:          '100%',
    left:         0,
    right:        0,
    marginTop:    '4px',
    background:   'var(--bg-card-solid, var(--bg-card))',
    border:       '1px solid var(--bg-card-border)',
    borderRadius: 12,
    boxShadow:    '0 8px 32px rgba(0,0,0,0.3)',
    zIndex:       1100,
    maxHeight:    400,
    overflowY:    'auto',
  };

  if (!hasResults) {
    return (
      <div style={dropStyle}>
        <p style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, margin: 0 }}>
          Aucun résultat
        </p>
      </div>
    );
  }

  return (
    <div style={dropStyle}>
      {results!.contacts.length > 0 && (
        <Group label="Contacts">
          {results!.contacts.map(c => (
            <ResultRow
              key={c.id}
              primary={`${c.prenom} ${c.nom}`}
              secondary={`${PROFIL_LABELS[c.profil] ?? c.profil} · ${c.telephone}`}
              icon="👤"
              onClick={() => onNavigate(`/contacts/${c.id}`)}
            />
          ))}
        </Group>
      )}
      {results!.ouvriers.length > 0 && (
        <Group label="Ouvriers">
          {results!.ouvriers.map(o => (
            <ResultRow
              key={o.id}
              primary={`${o.prenom} ${o.nom}`}
              secondary={o.services.length > 0 ? o.services.join(', ') : '—'}
              icon="⛪"
              onClick={() => onNavigate(`/ouvriers/${o.id}/edit`)}
            />
          ))}
        </Group>
      )}
      {results!.utilisateurs.length > 0 && (
        <Group label="Utilisateurs">
          {results!.utilisateurs.map(u => (
            <ResultRow
              key={u.id}
              primary={`${u.prenom} ${u.nom}`}
              secondary={`${ROLE_LABELS[u.role] ?? u.role} · ${u.email}`}
              icon="🔑"
              onClick={() => onNavigate('/admin')}
            />
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ResultRow({
  primary, secondary, icon, onClick,
}: { primary: string; secondary: string; icon: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:        10,
        padding:    '8px 14px',
        cursor:     'pointer',
        background: hover ? 'var(--bg-secondary)' : 'transparent',
        transition: '100ms ease',
      }}
    >
      <span style={{ fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <div style={{ overflow: 'hidden' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{primary}</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{secondary}</div>
      </div>
    </div>
  );
}
