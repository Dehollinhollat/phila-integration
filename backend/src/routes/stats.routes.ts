// src/routes/stats.routes.ts
// Statistiques agrégées pour les graphiques du Dashboard et la page Statistiques avancée.
//
// Deux niveaux d'accès :
// - Les 4 graphiques du Tableau de bord (inscriptions/mois, profils, statuts,
//   messages/semaine) sont ouverts dès referent_integration — ce rôle voit déjà
//   tout le campus sur cette page (cf. authorization.ts::filtreContactsParRole).
//   Chaque contrôleur filtre par req.user.campus pour les non super_admin.
// - Le reste (page "Statistiques" avancée : conversion, temps d'intégration,
//   performance des référents, rapport hebdomadaire) reste réservé à
//   admin_campus minimum.

import { Router } from 'express';
import {
  inscriptionsParMois,
  profilsStats,
  statutsStats,
  messagesParSemaine,
  tauxConversion,
  tempsIntegration,
  performanceReferents,
  evolutionHebdomadaire,
  envoyerRapportHebdomadaire,
} from '../controllers/stats.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole } from '../middlewares/roles.middleware';

const router = Router();

router.use(authenticate);

router.get('/inscriptions-par-mois',   requireMinRole('referent_integration'), inscriptionsParMois);
router.get('/profils',                 requireMinRole('referent_integration'), profilsStats);
router.get('/statuts',                 requireMinRole('referent_integration'), statutsStats);
router.get('/messages-par-semaine',    requireMinRole('referent_integration'), messagesParSemaine);

router.get('/taux-conversion',         requireMinRole('admin_campus'), tauxConversion);
router.get('/temps-integration',       requireMinRole('admin_campus'), tempsIntegration);
router.get('/performance-referents',   requireMinRole('admin_campus'), performanceReferents);
router.get('/evolution-hebdomadaire',  requireMinRole('admin_campus'), evolutionHebdomadaire);
router.post('/rapport-hebdomadaire',   requireMinRole('admin_campus'), envoyerRapportHebdomadaire);

export default router;
