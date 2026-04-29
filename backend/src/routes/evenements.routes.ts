// src/routes/evenements.routes.ts

import { Router } from 'express';
import {
  listEvenements,
  getEvenement,
  createEvenement,
  updateEvenement,
  deleteEvenement,
  planifierEvenement,
} from '../controllers/evenements.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole, requireRole } from '../middlewares/roles.middleware';

const router = Router();

router.use(authenticate);

router.get('/', requireMinRole('referent_integration'), listEvenements);
router.get('/:id', requireMinRole('referent_integration'), getEvenement);
router.post('/', requireRole('super_admin', 'admin_campus'), createEvenement);
router.patch('/:id', requireRole('super_admin', 'admin_campus'), updateEvenement);
router.delete('/:id', requireRole('super_admin', 'admin_campus'), deleteEvenement);

// Planifie l'envoi groupé — passe le statut à 'planifie' et enregistre la date d'envoi
router.post('/:id/planifier', requireRole('super_admin', 'admin_campus'), planifierEvenement);

export default router;
