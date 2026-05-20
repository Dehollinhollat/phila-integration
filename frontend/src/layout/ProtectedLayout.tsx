// src/layout/ProtectedLayout.tsx
// Wrapper pour toutes les routes protégées.
// - Redirige vers /login si non authentifié ou si le JWT est expiré
// - Redirige vers /onboarding si onboarding_complete = false (première connexion)
// - Déconnexion automatique dès que le token expire (vérifié à chaque navigation)
// - Gère l'état ouvert/fermé de la sidebar sur mobile
// - Sur desktop : sidebar fixe à gauche via var(--sidebar-width)
// - Sur mobile  : sidebar en overlay (transform CSS) + backdrop sombre

import { useState, useMemo, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import AppBar from './AppBar';

// Décode le claim `exp` du JWT sans vérifier la signature (lecture seule).
// La vérification cryptographique est toujours faite côté backend sur chaque requête.
function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' && Date.now() >= payload.exp * 1000;
  } catch {
    return true; // token malformé → considéré expiré par sécurité
  }
}

export default function ProtectedLayout() {
  const { isAuthenticated, token, user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Évaluation synchrone : évite un flash du contenu protégé si le token est expiré
  const tokenExpired = useMemo(
    () => !!token && isJwtExpired(token),
    [token]
  );

  // Nettoie localStorage après le rendu (setState pendant le rendu est interdit en React)
  useEffect(() => {
    if (tokenExpired) logout();
  }, [tokenExpired, logout]);

  if (!isAuthenticated || tokenExpired) {
    return <Navigate to="/login" replace />;
  }

  // Première connexion - redirige vers le guide d'onboarding sauf si déjà sur /onboarding
  if (user && user.onboarding_complete === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>

      {/* Overlay mobile - clic ferme la sidebar */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Zone de contenu - margin-left géré par var(--sidebar-width) en CSS */}
      <main className="main-content">
        <AppBar onMenuToggle={() => setSidebarOpen(o => !o)} />

        <div style={{
          flex:      1,
          padding:   'clamp(16px, 4vw, 32px) clamp(16px, 3vw, 32px)',
          width:     '100%',
          maxWidth:  '1200px',
          boxSizing: 'border-box',
        }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
