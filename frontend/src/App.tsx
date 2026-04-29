// src/App.tsx
// Point d'entrée React — définit le routing complet de l'application.
//
// Structure des routes :
//   /                   → redirige vers /dashboard (ou /login si non auth)
//   /login              → page de connexion (publique)
//   /dashboard          → tableau de bord                    [protected]
//   /contacts           → liste des contacts                 [protected]
//   /contacts/:id       → fiche détail d'un contact          [protected]
//   /referents          → gestion des référents              [admin+]
//   /messages           → historique des messages            [referent+]
//   /ouvriers           → liste des ouvriers                 [protected]
//   /evenements         → événements & envois groupés        [admin+]
//   /planning           → planning dominical                 [protected]
//   /admin              → gestion des utilisateurs           [admin+]
//   *                   → page 404

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedLayout from './layout/ProtectedLayout';
import Login     from './pages/Login';
import Dashboard from './pages/Dashboard';

// Pages placeholder — remplacées au fur et à mesure du développement
function Placeholder({ name }: { name: string }) {
  return (
    <div style={{ padding: '32px', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ color: '#0C5E6B', margin: '0 0 8px' }}>{name}</h2>
      <p style={{ margin: 0, color: '#6b7280' }}>Page en cours de développement.</p>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Route racine → dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Page publique */}
          <Route path="/login" element={<Login />} />

          {/* Routes protégées — imbriquées sous ProtectedLayout */}
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard"    element={<Dashboard />} />
            <Route path="/contacts"     element={<Placeholder name="Contacts" />} />
            <Route path="/contacts/:id" element={<Placeholder name="Détail Contact" />} />
            <Route path="/referents"    element={<Placeholder name="Référents" />} />
            <Route path="/messages"     element={<Placeholder name="Messages" />} />
            <Route path="/ouvriers"     element={<Placeholder name="Ouvriers" />} />
            <Route path="/evenements"   element={<Placeholder name="Événements" />} />
            <Route path="/planning"     element={<Placeholder name="Planning" />} />
            <Route path="/admin"        element={<Placeholder name="Administration" />} />
          </Route>

          {/* 404 */}
          <Route
            path="*"
            element={
              <div style={{
                minHeight: '100vh', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                fontFamily: 'system-ui, sans-serif', gap: '16px',
              }}>
                <span style={{ fontSize: '48px' }}>🔍</span>
                <h1 style={{ margin: 0, color: '#0C5E6B' }}>Page introuvable</h1>
                <a href="/dashboard" style={{ color: '#0C5E6B' }}>← Retour au tableau de bord</a>
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
