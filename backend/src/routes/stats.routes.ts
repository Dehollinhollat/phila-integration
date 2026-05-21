// src/routes/stats.routes.ts
// Statistiques agrégées pour les graphiques du Dashboard.
// Toutes les routes sont protégées — admin_campus minimum.

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
router.use(requireMinRole('admin_campus'));

router.get('/inscriptions-par-mois',   inscriptionsParMois);
router.get('/profils',                 profilsStats);
router.get('/statuts',                 statutsStats);
router.get('/messages-par-semaine',    messagesParSemaine);
router.get('/taux-conversion',         tauxConversion);
router.get('/temps-integration',       tempsIntegration);
router.get('/performance-referents',   performanceReferents);
router.get('/evolution-hebdomadaire',  evolutionHebdomadaire);
router.post('/rapport-hebdomadaire',   envoyerRapportHebdomadaire);

export default router;
