// src/routes/feedback.routes.ts
// Questionnaire de satisfaction.
// POST /:token — public (pas d'authenticate)
// GET  /       — referent_integration, referent_eglise, admin_campus, super_admin

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole }  from '../middlewares/roles.middleware';
import { submitFeedback, getFeedbacks } from '../controllers/feedback.controller';

const router = Router();

// Route publique — vérification du token dans le contrôleur
router.post('/:token', submitFeedback);

// Route protégée — accessible aux référents et admins (pas aux lecteurs)
router.get('/', authenticate, requireRole('super_admin', 'admin_campus', 'referent_integration', 'referent_eglise'), getFeedbacks);

export default router;
