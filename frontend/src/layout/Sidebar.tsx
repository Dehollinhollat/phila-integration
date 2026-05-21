// src/layout/Sidebar.tsx
// Sidebar de navigation principale.
// - Desktop : toujours visible, position fixed à gauche
// - Mobile  : cachée par défaut (transform CSS), s'ouvre via hamburger dans AppBar
//             se ferme automatiquement après chaque navigation
// Props : isOpen (mobile), onClose (fermer au clic nav ou overlay)

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { typography, spacing } from '../components/ui/tokens';
import { ROLE_LABELS, ROLE_RANK } from '../utils/constants';
import logoPhila from '../assets/images/LOGO-PHILA-BLEU.png';
import type { Role } from '../types';

// ─── Structure de navigation ──────────────────────────────────────────────────

interface NavItem {
  to:      string;
  label:   string;
  icon:    string;
  minRole: Role;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Principal',
    items: [
      { to: '/dashboard',  label: 'Tableau de bord', icon: '📊', minRole: 'lecteur' },
      { to: '/contacts',   label: 'Contacts',         icon: '👥', minRole: 'lecteur' },
      { to: '/referents',  label: 'Référents',         icon: '🤝', minRole: 'admin_campus' },
      { to: '/messagerie',     label: 'Messagerie',     icon: '💬', minRole: 'referent_integration' },
      { to: '/evenements',     label: 'Événements',     icon: '📅', minRole: 'admin_campus' },
      { to: '/notifications',  label: 'Notifications',  icon: '🔔', minRole: 'lecteur' },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { to: '/ouvriers',     label: 'Ouvriers',     icon: '⛪', minRole: 'lecteur' },
      { to: '/planning',     label: 'Planning',     icon: '🗓️',  minRole: 'lecteur' },
      { to: '/mon-planning', label: 'Mon planning', icon: '📋', minRole: 'referent_integration' },
      { to: '/qrcodes',      label: 'QR Codes',     icon: '📱', minRole: 'admin_campus' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/admin',      label: 'Comptes',    icon: '👤', minRole: 'admin_campus' },
      { to: '/parametres', label: 'Paramètres', icon: '⚙️', minRole: 'super_admin' },
    ],
  },
];

// ─── Composant ────────────────────────────────────────────────────────────────

interface SidebarProps {
  isOpen:  boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  if (!user) return null;

  const userRank = ROLE_RANK[user.role];
  const initials = `${user.prenom[0]}${user.nom[0]}`.toUpperCase();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // Ferme la sidebar sur mobile après navigation
  function handleNavClick() {
    onClose();
  }

  return (
    <aside
      className={`sidebar-aside${isOpen ? ' open' : ''}`}
      style={{
        width:         '240px',
        minHeight:     '100vh',
        background:    'var(--bg-sidebar)',
        display:       'flex',
        flexDirection: 'column',
        flexShrink:    0,
        position:      'fixed',
        top:           0,
        left:          0,
        bottom:        0,
        zIndex:        100,
        overflowY:     'auto',
      }}
    >
      {/* Logo */}
      <div style={{
        padding:      `${spacing[6]} ${spacing[4]}`,
        borderBottom: '1px solid var(--sidebar-border)',
        display:      'flex',
        alignItems:   'center',
        gap:          spacing[3],
      }}>
        <img src={logoPhila} alt="Phila" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
        <div>
          <div style={{
            color:         'var(--text-on-sidebar)',
            fontSize:      typography.fontSize.md,
            fontWeight:    typography.fontWeight.semibold,
            letterSpacing: '-0.3px',
            lineHeight:    1.2,
          }}>
            Phila Intégration
          </div>
          <div style={{
            color:     'var(--text-on-sidebar-muted)',
            fontSize:  typography.fontSize.xs,
            marginTop: '2px',
          }}>
            Cité des Adorateurs
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: `${spacing[3]} 0` }}>
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(
            (item) => userRank >= ROLE_RANK[item.minRole]
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label}>
              <div style={{
                padding:       `${spacing[3]} ${spacing[4]} ${spacing[1]}`,
                color:         'var(--sidebar-section-label)',
                fontSize:      typography.fontSize.xs,
                fontWeight:    typography.fontWeight.semibold,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                {section.label}
              </div>

              {visibleItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={handleNavClick}
                  style={({ isActive }) => ({
                    display:        'flex',
                    alignItems:     'center',
                    gap:            spacing[3],
                    padding:        `${spacing[2]} ${spacing[4]}`,
                    color:          isActive ? 'var(--text-on-sidebar)' : 'var(--text-on-sidebar-muted)',
                    background:     isActive ? 'var(--sidebar-item-active)' : 'transparent',
                    textDecoration: 'none',
                    fontSize:       typography.fontSize.base,
                    fontWeight:     isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
                    transition:     '120ms ease',
                    borderLeft:     isActive ? '3px solid var(--text-on-sidebar)' : '3px solid transparent',
                    cursor:         'pointer',
                  })}
                >
                  <span style={{ fontSize: '15px', lineHeight: 1, width: '18px', textAlign: 'center' }}>
                    {item.icon}
                  </span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* Footer utilisateur */}
      <div style={{
        padding:    spacing[4],
        borderTop:  '1px solid var(--sidebar-border)',
        display:    'flex',
        alignItems: 'center',
        gap:        spacing[3],
      }}>
        {/* Avatar - clic → profil */}
        <div
          onClick={() => { navigate('/profil'); onClose(); }}
          title="Mon profil"
          style={{
            width:          '34px',
            height:         '34px',
            borderRadius:   '9999px',
            background:     'rgba(255,255,255,0.15)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            color:          'var(--text-on-sidebar)',
            fontSize:       typography.fontSize.sm,
            fontWeight:     typography.fontWeight.semibold,
            flexShrink:     0,
            cursor:         'pointer',
            transition:     '120ms ease',
          }}
        >
          {initials}
        </div>

        {/* Nom + rôle */}
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div style={{
            color:        'var(--text-on-sidebar)',
            fontSize:     typography.fontSize.sm,
            fontWeight:   typography.fontWeight.medium,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {user.prenom} {user.nom}
          </div>
          <div style={{ color: 'var(--text-on-sidebar-muted)', fontSize: typography.fontSize.xs, marginTop: '1px' }}>
            {ROLE_LABELS[user.role]}
          </div>
        </div>

        {/* Toggle thème */}
        <button
          onClick={toggleTheme}
          title={theme === 'light' ? 'Mode sombre' : 'Mode clair'}
          style={{
            width:          '28px',
            height:         '28px',
            borderRadius:   'var(--border-radius-sm)',
            border:         '1px solid var(--sidebar-border)',
            background:     'transparent',
            color:          'var(--text-on-sidebar-muted)',
            cursor:         'pointer',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       '14px',
            lineHeight:     1,
            flexShrink:     0,
            transition:     '120ms ease',
          }}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        {/* Déconnexion */}
        <button
          onClick={handleLogout}
          title="Se déconnecter"
          style={{
            width:          '28px',
            height:         '28px',
            borderRadius:   'var(--border-radius-sm)',
            border:         'none',
            background:     'none',
            color:          'var(--text-on-sidebar-muted)',
            cursor:         'pointer',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       '16px',
            lineHeight:     1,
            flexShrink:     0,
            transition:     '120ms ease',
          }}
        >
          ↩
        </button>
      </div>
    </aside>
  );
}
