// src/routes/affectations.routes.ts
// Affectations ouvriers ↔ plannings de service.
// La création et suppression nécessitent le rôle admin_campus minimum.
// La réponse (accepte/decline) est accessible à tous les utilisateurs authentifiés.

import { Router } from 'express';
import {
  listAffectations,
  createAffectation,
  respondToAffectation,
  deleteAffectation,
  mesAffectations,
} from '../controllers/affectations.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole } from '../middlewares/roles.middleware';

const router = Router();

router.use(authenticate);

router.get('/mes', requireMinRole('lecteur'), mesAffectations);
router.get('/', requireMinRole('lecteur'), listAffectations);
router.post('/', requireMinRole('admin_campus'), createAffectation);
router.patch('/:id/statut', requireMinRole('lecteur'), respondToAffectation);
router.delete('/:id', requireMinRole('admin_campus'), deleteAffectation);

export default router;
