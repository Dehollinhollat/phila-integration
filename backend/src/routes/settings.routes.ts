// src/routes/settings.routes.ts
// Paramètres système — super_admin uniquement.

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/roles.middleware';
import { getSettings, updateSettings } from '../controllers/settings.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole('super_admin'));

router.get('/', getSettings);
router.put('/', updateSettings);

export default router;
