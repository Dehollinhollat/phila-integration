// src/routes/users.routes.ts
// Deux groupes de routes dans ce routeur :
//   1. /me — tout utilisateur authentifié (pas de requireRole)
//      Déclarées AVANT router.use(requireRole) pour ne pas être bloquées.
//   2. Routes admin — super_admin uniquement.
//      /check-email déclaré AVANT /:id pour éviter la collision de paramètre.

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/roles.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createUserSchema } from '../schemas/auth.schema';
import {
  getMyProfile, updateMyProfile, changeMyPassword, completeOnboarding,
  listUsers, checkEmail, createUser, updateUser, toggleStatut, resetPassword, listConnexions, deleteUser,
} from '../controllers/users.controller';

const router = Router();

router.use(authenticate);

// ── Routes /me — accessibles à tous les utilisateurs connectés ────────────────
router.get('/me',               getMyProfile);
router.put('/me',               updateMyProfile);
router.patch('/me/password',    changeMyPassword);
router.patch('/me/onboarding',  completeOnboarding);

// ── Routes admin — super_admin + admin_campus ─────────────────────────────────
// Les vérifications métier (admin_campus ne peut pas gérer un super_admin,
// filtrage par campus) sont dans le controller, pas ici.
const requireAdmin = requireRole('super_admin', 'admin_campus');

router.get('/check-email',    requireAdmin, checkEmail);
router.get('/',               requireAdmin, listUsers);
router.post('/',              requireAdmin, validate(createUserSchema), createUser);
router.get('/:id/connexions', requireAdmin, listConnexions);
router.put('/:id',            requireAdmin, updateUser);
router.patch('/:id/statut',   requireAdmin, toggleStatut);
router.patch('/:id/password', requireAdmin, resetPassword);
router.delete('/:id',         requireRole('super_admin'), deleteUser);

export default router;
