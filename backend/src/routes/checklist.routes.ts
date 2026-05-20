// src/routes/checklist.routes.ts
// Lecture et mise à jour des étapes de checklist d'intégration.
// Accès minimum : referent_integration (seul le référent ou un admin peut cocher les étapes).

import { Router } from 'express';
import { listChecklist, updateChecklistItem } from '../controllers/checklist.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole } from '../middlewares/roles.middleware';

const router = Router();

router.use(authenticate);

router.get('/contact/:contactId', requireMinRole('referent_integration'), listChecklist);
router.patch('/:id', requireMinRole('referent_integration'), updateChecklistItem);

export default router;
