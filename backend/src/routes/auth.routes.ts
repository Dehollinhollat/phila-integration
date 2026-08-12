// src/routes/auth.routes.ts
// Routes d'authentification — publiques (pas de JWT requis).
//
// La gestion des comptes (création/liste/modification/désactivation) vit
// exclusivement dans users.routes.ts (/api/users) — ce routeur avait une copie
// parallèle (createUser/listUsers/updateUser/deactivateUser) jamais appelée par
// le frontend, mais toujours joignable directement en API, et qui ne
// bénéficiait d'aucun des correctifs de sécurité apportés à users.controller.ts
// (notamment l'interdiction de l'auto-promotion). Supprimée le 8 août 2026 —
// voir docs/BACKLOG.md.

import { Router } from 'express';
import { login, getMe, refreshToken, logout, forgotPassword, resetPassword } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { loginRateLimit, formRateLimit } from '../middlewares/rateLimit.middleware';
import { loginSchema } from '../schemas/auth.schema';

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
// formRateLimit : réutilise la même limite que les formulaires publics — sans
// elle, rien n'empêchait de spammer un utilisateur réel d'emails de réinitialisation.
router.post('/forgot-password', formRateLimit, forgotPassword);

// POST /api/auth/reset-password — utilise le token pour changer le mot de passe
router.post('/reset-password', resetPassword);

// GET /api/auth/me — profil de l'utilisateur connecté
router.get('/me', authenticate, getMe);

export default router;
