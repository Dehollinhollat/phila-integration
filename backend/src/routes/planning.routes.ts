// src/routes/planning.routes.ts

import { Router } from 'express';
import {
  listPlannings,
  getPlanning,
  createPlanning,
  updatePlanning,
  deletePlanning,
} from '../controllers/planning.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole, requireRole } from '../middlewares/roles.middleware';

const router = Router();

router.use(authenticate);

router.get('/', requireMinRole('lecteur'), listPlannings);
router.get('/:id', requireMinRole('lecteur'), getPlanning);
router.post('/', requireRole('super_admin', 'admin_campus'), createPlanning);
router.patch('/:id', requireRole('super_admin', 'admin_campus'), updatePlanning);
router.delete('/:id', requireRole('super_admin', 'admin_campus'), deletePlanning);

export default router;
