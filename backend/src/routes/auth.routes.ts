// src/routes/auth.routes.ts
// Routes d'authentification — publiques (pas de JWT requis).

import { Router } from 'express';
import { login, getMe, createUser, listUsers, updateUser, deactivateUser, refreshToken, logout, forgotPassword, resetPassword } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole, requireMinRole } from '../middlewares/roles.middleware';
import { validate } from '../middlewares/validate.middleware';
import { loginRateLimit } from '../middlewares/rateLimit.middleware';
import { loginSchema, createUserSchema } from '../schemas/auth.schema';

const router = Router();

// POST /api/auth/login — connexion, retourne un JWT
// loginRateLimit : 10 tentatives max / 15 min par IP — protège contre le brute force
// validate(loginSchema) : vérifie email + password avant d'interroger la BDD
router.post('/login', loginRateLimit, validate(loginSchema), login);

// POST /api/auth/refresh — échange un refresh token contre un nouvel access token
router.post('/refresh', refreshToken);

// POST /api/auth/logout — révoque le refresh token
router.post('/logout', logout);

// POST /api/auth/forgot-password — envoie un email de réinitialisation
router.post('/forgot-password', forgotPassword);

// POST /api/auth/reset-password — utilise le token pour changer le mot de passe
router.post('/reset-password', resetPassword);

// GET /api/auth/me — profil de l'utilisateur connecté
router.get('/me', authenticate, getMe);

// POST /api/auth/users — création d'un compte (super_admin uniquement)
// validate(createUserSchema) : vérifie les champs et le format du mot de passe
router.post('/users', authenticate, requireRole('super_admin'), validate(createUserSchema), createUser);

// GET /api/auth/users — liste des utilisateurs (admin+)
router.get('/users', authenticate, requireMinRole('admin_campus'), listUsers);

// PATCH /api/auth/users/:id — mise à jour d'un compte
router.patch('/users/:id', authenticate, requireRole('super_admin'), updateUser);

// DELETE /api/auth/users/:id — désactivation d'un compte (soft delete)
router.delete('/users/:id', authenticate, requireRole('super_admin'), deactivateUser);

export default router;
