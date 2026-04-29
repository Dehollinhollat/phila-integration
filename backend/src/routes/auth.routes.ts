// src/routes/auth.routes.ts
// Routes d'authentification — publiques (pas de JWT requis).

import { Router } from 'express';
import { login, getMe, createUser, listUsers, updateUser, deactivateUser } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole, requireMinRole } from '../middlewares/roles.middleware';

const router = Router();

// POST /api/auth/login — connexion, retourne un JWT
router.post('/login', login);

// GET /api/auth/me — profil de l'utilisateur connecté
router.get('/me', authenticate, getMe);

// POST /api/auth/users — création d'un compte (super_admin uniquement)
router.post('/users', authenticate, requireRole('super_admin'), createUser);

// GET /api/auth/users — liste des utilisateurs (admin+)
router.get('/users', authenticate, requireMinRole('admin_campus'), listUsers);

// PATCH /api/auth/users/:id — mise à jour d'un compte
router.patch('/users/:id', authenticate, requireRole('super_admin'), updateUser);

// DELETE /api/auth/users/:id — désactivation d'un compte (soft delete)
router.delete('/users/:id', authenticate, requireRole('super_admin'), deactivateUser);

export default router;
