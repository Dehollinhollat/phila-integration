// src/layout/ProtectedLayout.tsx
// Wrapper pour toutes les routes de l'interface d'administration.
// - Redirige vers /login si l'utilisateur n'est pas authentifié
// - Affiche la Sidebar + la zone de contenu principale
// - Applique le décalage gauche pour laisser place à la sidebar fixe

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import { colors, layout, spacing } from '../components/ui/tokens';

export default function ProtectedLayout() {
  const { isAuthenticated } = useAuth();

  // Redirige non-authentifiés vers la page de login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div
      style={{
        display:    'flex',
        minHeight:  '100vh',
        background: colors.gray50,
      }}
    >
      <Sidebar />

      {/* Zone de contenu — décalée de la largeur de la sidebar */}
      <main
        style={{
          flex:       1,
          marginLeft: layout.sidebarWidth,
          minWidth:   0,
          display:    'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            flex:      1,
            padding:   spacing[6],
            maxWidth:  layout.contentMaxWidth,
            width:     '100%',
            boxSizing: 'border-box' as const,
          }}
        >
          {/* Outlet rend la page correspondant à la route active */}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
