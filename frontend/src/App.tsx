// src/App.tsx
// Point d'entrée React -définit le routing complet de l'application.
//
// Structure des routes :
//   /                      → redirige vers /dashboard (ou /login si non auth)
//   /login                 → page de connexion (publique)
//   /form/presentiel       → formulaire d'inscription QR code (publique)
//   /success               → page de confirmation après inscription (publique)
//   /dashboard             → tableau de bord                    [protected]
//   /contacts              → liste des contacts                 [protected]
//   /contacts/:id/edit     → modification d'un contact          [admin_campus+]
//   /contacts/:id          → fiche détail d'un contact          [protected]
//   /referents             → gestion des référents              [admin+]
//   /messagerie            → historique des messages            [admin_campus+]
//   /messagerie/nouveau    → composer un nouveau message        [admin_campus+]
//   /ouvriers              → liste des ouvriers                 [protected]
//   /evenements            → événements & envois groupés        [admin+]
//   /planning              → planning dominical                 [protected]
//   /admin                 → gestion des utilisateurs           [admin+]
//   *                      → page 404

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedLayout   from './layout/ProtectedLayout';
import Login             from './pages/Login';
import FormPresentiel    from './pages/FormPresentiel';
import FormEnLigne       from './pages/FormEnLigne';
import Success           from './pages/Success';
import FormOuvrier            from './pages/FormOuvrier';
import SuccessOuvrier         from './pages/SuccessOuvrier';
import MentionsLegales        from './pages/MentionsLegales';
import PolitiqueConfidentialite from './pages/PolitiqueConfidentialite';
import Dashboard         from './pages/Dashboard';
import ContactList       from './features/contacts/ContactList';
import ContactForm       from './features/contacts/ContactForm';
import ContactEdit       from './features/contacts/ContactEdit';
import ContactDetail     from './features/contacts/ContactDetail';
import QRManager         from './features/admin/QRManager';
import EventScheduler    from './features/messages/EventScheduler';
import ReferentList      from './features/referents/ReferentList';
import UserManagement    from './features/admin/UserManagement';
import Settings          from './features/admin/Settings';
import MessageHistory    from './features/messages/MessageHistory';
import MessageCompose    from './features/messages/MessageCompose';
import OuvrierList       from './features/ouvriers/OuvrierList';
import OuvrierForm       from './features/ouvriers/OuvrierForm';
import PlanningTable     from './features/planning/PlanningTable';
import PlanningDetail    from './features/planning/PlanningDetail';
import MesPlannings      from './features/planning/MesPlannings';
import UserProfile       from './features/auth/UserProfile';
import Onboarding        from './features/auth/Onboarding';
import ForgotPassword    from './pages/ForgotPassword';
import ResetPassword     from './pages/ResetPassword';
import NotFound          from './pages/NotFound';
import NotificationsPage from './pages/Notifications';
import AuditLogs        from './pages/AuditLogs';
import Maintenance          from './pages/Maintenance';
import StatistiquesAvancees from './pages/StatistiquesAvancees';
import MonTableauDeBord    from './pages/MonTableauDeBord';
import { InstallPWA }      from './components/common/InstallPWA';
import FormFeedback      from './pages/FormFeedback';
import FeedbackResultats from './pages/FeedbackResultats';


// AnimatePresence nécessite useLocation, qui exige d'être dans le contexte BrowserRouter
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Route racine → dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Pages publiques */}
        <Route path="/login"                         element={<Login />} />
        <Route path="/forgot-password"               element={<ForgotPassword />} />
        <Route path="/reset-password"                element={<ResetPassword />} />
        <Route path="/form/presentiel"               element={<FormPresentiel />} />
        <Route path="/form/en-ligne"                 element={<FormEnLigne />} />
        <Route path="/success"                       element={<Success />} />
        <Route path="/form/ouvrier"                  element={<FormOuvrier />} />
        <Route path="/success-ouvrier"               element={<SuccessOuvrier />} />
        <Route path="/mentions-legales"              element={<MentionsLegales />} />
        <Route path="/politique-confidentialite"     element={<PolitiqueConfidentialite />} />
        <Route path="/form/feedback/:token"          element={<FormFeedback />} />

        {/* Routes protégées -imbriquées sous ProtectedLayout */}
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard"      element={<Dashboard />} />
          <Route path="/statistiques"        element={<StatistiquesAvancees />} />
          <Route path="/mon-tableau-de-bord" element={<MonTableauDeBord />} />
          <Route path="/contacts"           element={<ContactList />} />
          <Route path="/contacts/nouveau"   element={<ContactForm />} />
          <Route path="/contacts/:id/edit"  element={<ContactEdit />} />
          <Route path="/contacts/:id"       element={<ContactDetail />} />
          <Route path="/referents"          element={<ReferentList />} />
          <Route path="/messagerie"         element={<MessageHistory />} />
          <Route path="/messagerie/nouveau" element={<MessageCompose />} />
          <Route path="/ouvriers"           element={<OuvrierList />} />
          <Route path="/ouvriers/new"       element={<OuvrierForm />} />
          <Route path="/ouvriers/:id/edit"  element={<OuvrierForm />} />
          <Route path="/evenements"         element={<EventScheduler />} />
          <Route path="/evenements/nouveau" element={<MessageCompose />} />
          <Route path="/planning"           element={<PlanningTable />} />
          <Route path="/planning/:id"       element={<PlanningDetail />} />
          <Route path="/mon-planning"       element={<MesPlannings />} />
          <Route path="/notifications"      element={<NotificationsPage />} />
          <Route path="/profil"             element={<UserProfile />} />
          <Route path="/onboarding"         element={<Onboarding />} />
          <Route path="/admin"              element={<UserManagement />} />
          <Route path="/parametres"         element={<Settings />} />
          <Route path="/qrcodes"            element={<QRManager />} />
          <Route path="/audit"              element={<AuditLogs />} />
          <Route path="/feedback-resultats" element={<FeedbackResultats />} />
        </Route>

        {/* 404 -doit rester la dernière route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  const MAINTENANCE_MODE = import.meta.env.VITE_MAINTENANCE_MODE === 'true';

  if (MAINTENANCE_MODE) return <Maintenance />;

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AnimatedRoutes />
          <InstallPWA />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
