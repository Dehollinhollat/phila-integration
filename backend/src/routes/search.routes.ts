// src/routes/search.routes.ts
// Recherche globale cross-modèles — accessible à tous les utilisateurs connectés.
// GET /api/search?q=terme → { contacts[], ouvriers[], utilisateurs[] }

import { Router } from 'express';
import { globalSearch } from '../controllers/contacts.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/', globalSearch);

export default router;
