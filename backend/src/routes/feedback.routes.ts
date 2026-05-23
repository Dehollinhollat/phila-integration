// src/routes/feedback.routes.ts
// Questionnaire de satisfaction.
// POST /:token — public (pas d'authenticate)
// GET  /       — admin_campus+

import { Router } from 'express';
import { authenticate }   from '../middlewares/auth.middleware';
import { requireMinRole } from '../middlewares/roles.middleware';
import { submitFeedback, getFeedbacks } from '../controllers/feedback.controller';

const router = Router();

// Route publique — vérification du token dans le contrôleur
router.post('/:token', submitFeedback);

// Route protégée
router.get('/', authenticate, requireMinRole('admin_campus'), getFeedbacks);

export default router;
