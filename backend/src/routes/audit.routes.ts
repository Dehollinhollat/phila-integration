// src/routes/audit.routes.ts
// Journal d'audit — super_admin uniquement.

import { Router } from 'express';
import { listAuditLogs } from '../controllers/audit.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole } from '../middlewares/roles.middleware';

const router = Router();

router.use(authenticate);
router.use(requireMinRole('super_admin'));

router.get('/', listAuditLogs);

export default router;
