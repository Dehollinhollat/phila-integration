// src/routes/referents.routes.ts
// Gestion des assignations de référents sur les contacts.

import { Router } from 'express';
import {
  listReferents,
  assignReferentIntegration,
  assignReferentEglise,
  removeReferentIntegration,
  removeReferentEglise,
} from '../controllers/referents.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole } from '../middlewares/roles.middleware';

const router = Router();

router.use(authenticate);

// GET /api/referents — liste des référents disponibles (filtrés par campus)
router.get('/', requireMinRole('admin_campus'), listReferents);

// Assignation référent intégration
router.patch('/contacts/:contactId/integration', requireMinRole('admin_campus'), assignReferentIntegration);
router.delete('/contacts/:contactId/integration', requireMinRole('admin_campus'), removeReferentIntegration);

// Assignation référent église
router.patch('/contacts/:contactId/eglise', requireMinRole('admin_campus'), assignReferentEglise);
router.delete('/contacts/:contactId/eglise', requireMinRole('admin_campus'), removeReferentEglise);

export default router;
