// src/layout/Sidebar.tsx
// Sidebar de navigation principale.
// - Fond teal foncé (#0C5E6B), texte blanc
// - Items filtrés selon le rôle de l'utilisateur connecté
// - Item actif avec fond rgba(255,255,255,0.12)
// - Affiche le logo Phila en haut et les infos utilisateur en bas

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { colors, layout, typography, spacing, radius, transitions } from '../components/ui/tokens';
import { ROLE_LABELS, ROLE_RANK } from '../utils/constants';
import type { Role } from '../types';

// ─── Définition des items de navigation ──────────────────────────────────────

interface NavItem {
  to:       string;
  label:    string;
  icon:     string;    // emoji unicode — pas de lib d'icônes pour garder le bundle léger
  minRole:  Role;      // rôle minimum requis pour voir cet item
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',  label: 'Tableau de bord', icon: '📊', minRole: 'lecteur' },
  { to: '/contacts',   label: 'Contacts',         icon: '👥', minRole: 'lecteur' },
  { to: '/referents',  label: 'Référents',         icon: '🤝', minRole: 'admin_campus' },
  { to: '/messages',   label: 'Messages',          icon: '💬', minRole: 'referent_integration' },
  { to: '/ouvriers',   label: 'Ouvriers',          icon: '⛪', minRole: 'lecteur' },
  { to: '/evenements', label: 'Événements',        icon: '📅', minRole: 'admin_campus' },
  { to: '/planning',   label: 'Planning',          icon: '🗓️',  minRole: 'lecteur' },
  { to: '/admin',      label: 'Administration',    icon: '⚙️',  minRole: 'admin_campus' },
];

// ─── Styles inline ────────────────────────────────────────────────────────────

const S = {
  sidebar: {
    width:           layout.sidebarWidth,
    minHeight:       '100vh',
    background:      colors.sidebarBg,
    display:         'flex',
    flexDirection:   'column' as const,
    flexShrink:      0,
    position:        'fixed' as const,
    top:             0,
    left:            0,
    bottom:          0,
    zIndex:          100,
    overflowY:       'auto' as const,
  },
  logoArea: {
    padding:         `${spacing[6]} ${spacing[4]}`,
    borderBottom:    '1px solid rgba(255,255,255,0.1)',
    display:         'flex',
    alignItems:      'center',
    gap:             spacing[3],
  },
  logoImg: {
    width:           '36px',
    height:          'auto',
    filter:          'brightness(0) invert(1)',
  },
  appName: {
    color:           colors.sidebarText,
    fontSize:        typography.fontSize.md,
    fontWeight:      typography.fontWeight.semibold,
    letterSpacing:   '-0.3px',
    lineHeight:      1.2,
  },
  appSub: {
    color:           'rgba(255,255,255,0.55)',
    fontSize:        typography.fontSize.xs,
    marginTop:       '2px',
  },
  nav: {
    flex:     1,
    padding:  `${spacing[3]} 0`,
  },
  navSection: {
    padding:    `${spacing[2]} ${spacing[4]} ${spacing[1]}`,
    color:      'rgba(255,255,255,0.4)',
    fontSize:   typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  navLink: (active: boolean): React.CSSProperties => ({
    display:        'flex',
    alignItems:     'center',
    gap:            spacing[3],
    padding:        `${spacing[2]} ${spacing[4]}`,
    color:          active ? colors.sidebarText : 'rgba(255,255,255,0.72)',
    background:     active ? colors.sidebarActive : 'transparent',
    borderRadius:   0,
    textDecoration: 'none',
    fontSize:       typography.fontSize.base,
    fontWeight:     active ? typography.fontWeight.medium : typography.fontWeight.normal,
    transition:     transitions.fast,
    borderLeft:     active ? `3px solid ${colors.white}` : '3px solid transparent',
    cursor:         'pointer',
  }),
  navIcon: {
    fontSize:  '15px',
    lineHeight: 1,
    width:     '18px',
    textAlign: 'center' as const,
  },
  userArea: {
    padding:      spacing[4],
    borderTop:    '1px solid rgba(255,255,255,0.1)',
    display:      'flex',
    alignItems:   'center',
    gap:          spacing[3],
  },
  avatar: {
    width:          '34px',
    height:         '34px',
    borderRadius:   radius.full,
    background:     'rgba(255,255,255,0.15)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    color:          colors.white,
    fontSize:       typography.fontSize.sm,
    fontWeight:     typography.fontWeight.semibold,
    flexShrink:     0,
  },
  userName: {
    color:       colors.white,
    fontSize:    typography.fontSize.sm,
    fontWeight:  typography.fontWeight.medium,
    overflow:    'hidden' as const,
    textOverflow:'ellipsis' as const,
    whiteSpace:  'nowrap' as const,
  },
  userRole: {
    color:      'rgba(255,255,255,0.5)',
    fontSize:   typography.fontSize.xs,
    marginTop:  '1px',
  },
  logoutBtn: {
    marginLeft:  'auto',
    background:  'none',
    border:      'none',
    color:       'rgba(255,255,255,0.5)',
    cursor:      'pointer',
    padding:     spacing[1],
    borderRadius:radius.sm,
    fontSize:    '16px',
    lineHeight:  1,
    transition:  transitions.fast,
  },
} as const;

// ─── Composant ────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const userRank = ROLE_RANK[user.role];

  // Items visibles selon le rôle de l'utilisateur
  const visibleItems = NAV_ITEMS.filter(
    (item) => userRank >= ROLE_RANK[item.minRole]
  );

  const initials = `${user.prenom[0]}${user.nom[0]}`.toUpperCase();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside style={S.sidebar}>
      {/* Logo */}
      <div style={S.logoArea}>
        <img
          src="/src/assets/images/LOGO-PHILA-BLEU.png"
          alt="Phila"
          style={S.logoImg}
        />
        <div>
          <div style={S.appName}>Phila Intégration</div>
          <div style={S.appSub}>Cité des Adorateurs</div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={S.nav}>
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => S.navLink(isActive)}
          >
            <span style={S.navIcon}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Utilisateur connecté */}
      <div style={S.userArea}>
        <div style={S.avatar}>{initials}</div>
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div style={S.userName}>{user.prenom} {user.nom}</div>
          <div style={S.userRole}>{ROLE_LABELS[user.role]}</div>
        </div>
        <button
          style={S.logoutBtn}
          onClick={handleLogout}
          title="Se déconnecter"
        >
          ↩
        </button>
      </div>
    </aside>
  );
}
