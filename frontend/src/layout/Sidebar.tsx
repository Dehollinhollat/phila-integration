// src/layout/Sidebar.tsx
// Sidebar de navigation principale.
// - Desktop : toujours visible, position fixed à gauche
// - Mobile  : cachée par défaut (transform CSS), s'ouvre via hamburger dans AppBar
//             se ferme automatiquement après chaque navigation
// Props : isOpen (mobile), onClose (fermer au clic nav ou overlay)

import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart2, Home, TrendingUp, Users, Handshake, MessageSquare,
  Calendar, Bell, Church, ClipboardList, Smartphone, User,
  Star, Settings2, FileText, Moon, Sun, LogOut,
} from 'lucide-react';
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
  icon:    ReactNode;
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
      { to: '/dashboard',           label: 'Tableau de bord', icon: <BarChart2 size={18} />,     minRole: 'lecteur' },
      { to: '/mon-tableau-de-bord', label: 'Mon tableau',     icon: <Home size={18} />,           minRole: 'referent_integration' },
      { to: '/statistiques',        label: 'Statistiques',    icon: <TrendingUp size={18} />,     minRole: 'admin_campus' },
      { to: '/contacts',            label: 'Contacts',        icon: <Users size={18} />,           minRole: 'lecteur' },
      { to: '/referents',           label: 'Référents',       icon: <Handshake size={18} />,      minRole: 'admin_campus' },
      { to: '/messagerie',          label: 'Messagerie',      icon: <MessageSquare size={18} />,  minRole: 'referent_integration' },
      { to: '/evenements',          label: 'Événements',      icon: <Calendar size={18} />,       minRole: 'referent_integration' },
      { to: '/notifications',       label: 'Notifications',   icon: <Bell size={18} />,           minRole: 'lecteur' },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { to: '/ouvriers',     label: 'Ouvriers',     icon: <Church size={18} />,        minRole: 'lecteur' },
      { to: '/planning',     label: 'Planning',     icon: <Calendar size={18} />,      minRole: 'lecteur' },
      { to: '/mon-planning', label: 'Mon planning', icon: <ClipboardList size={18} />, minRole: 'referent_integration' },
      { to: '/qrcodes',      label: 'QR Codes',     icon: <Smartphone size={18} />,    minRole: 'admin_campus' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/admin',              label: 'Comptes',      icon: <User size={18} />,        minRole: 'admin_campus' },
      { to: '/feedback-resultats', label: 'Satisfaction', icon: <Star size={18} />,        minRole: 'referent_integration' },
      { to: '/parametres',         label: 'Paramètres',   icon: <Settings2 size={18} />,   minRole: 'super_admin' },
      { to: '/audit',              label: 'Audit',        icon: <FileText size={18} />,    minRole: 'super_admin' },
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

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  if (!user) return null;

  const userRank = ROLE_RANK[user.role];
  const initials = `${user.prenom[0]}${user.nom[0]}`.toUpperCase();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function handleNavClick() {
    onClose();
  }

  return (
    <>
      {/* Overlay mobile derrière la sidebar */}
      {isMobile && isOpen && (
        <div
          onClick={onClose}
          style={{
            position:   'fixed',
            inset:      0,
            background: 'rgba(0,0,0,0.75)',
            zIndex:     999,
          }}
        />
      )}
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
        height:        '100%',
        zIndex:        1000,
        overflowY:     'auto',
      }}
    >
      {/* Logo */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '12px',
        padding:      '20px 16px',
        paddingTop:   isMobile ? '64px' : '20px',
        borderBottom: '1px solid var(--bg-card-border)',
      }}>
        <img
          src={logoPhila}
          alt="Phila"
          style={{
            width:        '40px',
            height:       '40px',
            borderRadius: '8px',
            objectFit:    'contain',
            filter:       'none',
            opacity:      1,
          }}
        />
        <div>
          <p style={{
            margin:     0,
            fontWeight: 700,
            fontSize:   '15px',
            color:      'var(--text-primary)',
            opacity:    1,
          }}>
            Phila Intégration
          </p>
          <p style={{
            margin:   0,
            fontSize: '11px',
            color:    'var(--text-secondary)',
            opacity:  1,
          }}>
            Cité des Adorateurs
          </p>
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
                  <motion.span
                    whileHover={{ x: 4 }}
                    transition={{ duration: 0.15 }}
                    style={{ display: 'flex', alignItems: 'center', gap: spacing[3], width: '100%' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', width: '18px', flexShrink: 0 }}>
                      {item.icon}
                    </span>
                    {item.label}
                  </motion.span>
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
            flexShrink:     0,
            transition:     '120ms ease',
          }}
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
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
            flexShrink:     0,
            transition:     '120ms ease',
          }}
        >
          <LogOut size={14} />
        </button>
      </div>
    </aside>
    </>
  );
}
