// src/routes/ouvriers.routes.ts

import { Router } from 'express';
import {
  listOuvriers,
  getOuvrier,
  createOuvrier,
  promoteContact,
  updateOuvrier,
  deactivateOuvrier,
} from '../controllers/ouvriers.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole, requireRole } from '../middlewares/roles.middleware';

const router = Router();

router.use(authenticate);

router.get('/', requireMinRole('lecteur'), listOuvriers);
router.get('/:id', requireMinRole('lecteur'), getOuvrier);

// Inscription directe d'un ouvrier existant (avant le lancement de l'app)
router.post('/', requireRole('super_admin', 'admin_campus'), createOuvrier);

// Promotion d'un contact existant en ouvrier
router.post('/contacts/:contactId/promouvoir', requireRole('super_admin', 'admin_campus'), promoteContact);

router.patch('/:id', requireRole('super_admin', 'admin_campus'), updateOuvrier);
router.delete('/:id', requireRole('super_admin', 'admin_campus'), deactivateOuvrier);

export default router;
