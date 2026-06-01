// src/controllers/auth.controller.ts
// Authentification JWT + refresh tokens + réinitialisation mot de passe.
// La création de comptes est réservée au super_admin.

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { sendPasswordResetEmail } from '../lib/email';
import { JwtPayload } from '../middlewares/auth.middleware';

const ACCESS_TOKEN_TTL  = '8h';
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 * 1000; // 7 jours en ms

// Hash factice pré-calculé pour bcrypt.compare quand l'email n'existe pas.
// Égalise le temps de réponse et empêche les attaques par timing qui révèlent
// l'existence d'un compte (user_not_found ≈ 0ms vs wrong_password ≈ 100ms).
// Valeur : hash bcrypt coût 12 d'une chaîne aléatoire — ne correspond à rien.
const DUMMY_HASH = '$2b$12$RKiAVCWLPiMZKQZQGGaTPe4WKMuBvKnfW4K1JQvGqK5H6OjhN9rqO';

function buildJwtPayload(user: { id: string; email: string; role: string; campus: string[] }): JwtPayload {
  return {
    id:     user.id,
    email:  user.email,
    role:   user.role as JwtPayload['role'],
    campus: user.campus as JwtPayload['campus'],
  };
}

// POST /api/auth/login
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    res.status(400).json({ message: 'Email et mot de passe requis' });
    return;
  }

  const ip        = String(req.headers['x-forwarded-for'] ?? req.ip ?? 'unknown').split(',')[0].trim();
  const userAgent = req.headers['user-agent'];

  const user = await prisma.user.findUnique({ where: { email } });

  // Toujours comparer le mot de passe — hash factice si l'email n'existe pas —
  // pour égaliser le temps de réponse et prévenir l'énumération d'emails.
  const hashToCompare = user?.password ?? DUMMY_HASH;
  const valid = await bcrypt.compare(password, hashToCompare);

  if (!user || !user.actif || !valid) {
    const raison = !user ? 'user_not_found' : !user.actif ? 'compte_inactif' : 'mot_de_passe_incorrect';
    console.warn(`[AUTH][FAILED_LOGIN] email=${email} ip=${ip} reason=${raison} time=${new Date().toISOString()}`);
    if (user) {
      await prisma.connectionLog.create({ data: { user_id: user.id, ip, user_agent: userAgent, succes: false, raison } });
    }
    res.status(401).json({ message: 'Identifiants invalides' });
    return;
  }

  const secret      = process.env.JWT_SECRET!;
  const accessToken = jwt.sign(buildJwtPayload(user), secret, { expiresIn: ACCESS_TOKEN_TTL, algorithm: 'HS256' });

  // Refresh token — aléatoire, stocké en base, durée 7 jours
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const expiresAt    = new Date(Date.now() + REFRESH_TOKEN_TTL);
  await prisma.refreshToken.create({ data: { token: refreshToken, user_id: user.id, expires_at: expiresAt } });

  await prisma.connectionLog.create({ data: { user_id: user.id, ip, user_agent: userAgent, succes: true, raison: null } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.auditLog as any).create({
    data: {
      action:      'LOGIN',
      entite:      'User',
      entite_id:   user.id,
      description: `Connexion réussie depuis IP ${ip}`,
      auteur_id:   user.id,
    },
  });
  console.info(`[AUTH][LOGIN_SUCCESS] email=${email} ip=${ip} time=${new Date().toISOString()}`);

  res.json({
    accessToken,
    refreshToken,
    user: {
      id:                  user.id,
      prenom:              user.prenom,
      nom:                 user.nom,
      email:               user.email,
      role:                user.role,
      campus:              user.campus,
      onboarding_complete: user.onboarding_complete,
    },
  });
}

// POST /api/auth/refresh — échange un refresh token contre un nouvel access token
export async function refreshToken(req: Request, res: Response): Promise<void> {
  const { refreshToken: token } = req.body as { refreshToken?: string };
  if (!token) {
    res.status(400).json({ message: 'Refresh token manquant' });
    return;
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token }, include: { user: true } });
  if (!stored || stored.revoked || stored.expires_at < new Date()) {
    // Token invalide, révoqué ou expiré — pas de suppression : le cron nettoie
    res.status(401).json({ message: 'Session expirée ou révoquée, veuillez vous reconnecter' });
    return;
  }

  if (!stored.user.actif) {
    res.status(401).json({ message: 'Compte désactivé' });
    return;
  }

  // Rafraîchit last_used_at → le cron de nettoyage 3 jours ne supprimera pas ce token
  await prisma.refreshToken.update({
    where: { token },
    data:  { last_used_at: new Date() },
  });

  const secret      = process.env.JWT_SECRET!;
  const accessToken = jwt.sign(buildJwtPayload(stored.user), secret, { expiresIn: ACCESS_TOKEN_TTL, algorithm: 'HS256' });

  res.json({ accessToken });
}

// POST /api/auth/logout — révoque toutes les sessions de l'utilisateur (blacklist)
// On marque revoked=true au lieu de supprimer pour conserver la trace d'audit.
// Le cron de nettoyage purge les tokens révoqués depuis > 30 jours.
export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken: token } = req.body as { refreshToken?: string };
  if (token) {
    const stored = await prisma.refreshToken.findUnique({ where: { token } }).catch(() => null);
    if (stored) {
      await prisma.refreshToken.updateMany({
        where: { user_id: stored.user_id },
        data:  { revoked: true, revoked_at: new Date() },
      }).catch(() => {});
    }
  }
  res.json({ message: 'Déconnexion réussie' });
}

// POST /api/auth/forgot-password — demande de réinitialisation
// Retourne TOUJOURS le même message 200 que l'email existe ou non (anti-énumération).
// La protection timing : si l'email n'existe pas, on effectue un hash bcrypt factice
// pour occuper le CPU le même temps que la création d'un vrai token.
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const RESPONSE = { message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' };

  const { email } = req.body as { email?: string };
  if (!email) {
    res.json(RESPONSE);
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user && user.actif) {
    await prisma.passwordResetToken.updateMany({
      where: { user_id: user.id, used: false },
      data:  { used: true },
    });

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.passwordResetToken.create({ data: { token, user_id: user.id, expires_at: expiresAt } });

    const resetUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, user.prenom, resetUrl).catch(err => {
      console.error('[AUTH][FORGOT_PASSWORD] Erreur envoi email:', err);
    });
  } else {
    // Égalise le temps CPU — empêche la détection d'emails via timing
    await bcrypt.hash('_timing_protection_', 10);
  }

  res.json(RESPONSE);
}

// POST /api/auth/reset-password — utilise le token pour changer le mot de passe
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };

  if (!token || !newPassword) {
    res.status(400).json({ message: 'Token et nouveau mot de passe requis' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères' });
    return;
  }

  const stored = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!stored || stored.used || stored.expires_at < new Date()) {
    res.status(400).json({ message: 'Ce lien est invalide ou a expiré. Veuillez faire une nouvelle demande.' });
    return;
  }

  const hashed = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: stored.user_id }, data: { password: hashed } }),
    prisma.passwordResetToken.update({ where: { token }, data: { used: true } }),
    // Révoque toutes les sessions actives pour forcer une reconnexion
    prisma.refreshToken.deleteMany({ where: { user_id: stored.user_id } }),
  ]);

  res.json({ message: 'Mot de passe modifié avec succès.' });
}

// GET /api/auth/me
export async function getMe(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where:  { id: req.user!.id },
    select: { id: true, prenom: true, nom: true, email: true, role: true, campus: true, actif: true, onboarding_complete: true },
  });
  if (!user) {
    res.status(404).json({ message: 'Utilisateur introuvable' });
    return;
  }
  res.json(user);
}

// POST /api/auth/users — super_admin uniquement
export async function createUser(req: Request, res: Response): Promise<void> {
  const { prenom, nom, email, password, role, campus } = req.body;

  if (!prenom || !nom || !email || !password || !role) {
    res.status(400).json({ message: 'Champs obligatoires manquants' });
    return;
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    res.status(409).json({ message: 'Un compte existe déjà avec cet email' });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const user   = await prisma.user.create({
    data:   { prenom, nom, email, password: hashed, role, campus: campus ?? [] },
    select: { id: true, prenom: true, nom: true, email: true, role: true, campus: true },
  });

  res.status(201).json(user);
}

// GET /api/auth/users
export async function listUsers(req: Request, res: Response): Promise<void> {
  const { campus } = req.query;
  const callerRole   = req.user!.role;
  const callerCampus = req.user!.campus;

  const where: Record<string, unknown> = {};
  if (callerRole === 'admin_campus') {
    where.campus = { hasSome: callerCampus };
  } else if (campus) {
    where.campus = { hasSome: [campus as string] };
  }

  const users = await prisma.user.findMany({
    where,
    select:  { id: true, prenom: true, nom: true, email: true, role: true, campus: true, actif: true },
    orderBy: { nom: 'asc' },
  });

  res.json(users);
}

// PATCH /api/auth/users/:id
export async function updateUser(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string;
  const { prenom, nom, email, role, campus, password } = req.body;

  const data: Record<string, unknown> = {};
  if (prenom)   data.prenom   = prenom;
  if (nom)      data.nom      = nom;
  if (email)    data.email    = email;
  if (role)     data.role     = role;
  if (campus)   data.campus   = campus;
  if (password) data.password = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({
    where:  { id },
    data,
    select: { id: true, prenom: true, nom: true, email: true, role: true, campus: true, actif: true },
  });

  res.json(user);
}

// DELETE /api/auth/users/:id — désactivation soft
export async function deactivateUser(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string;

  if (id === req.user!.id) {
    res.status(400).json({ message: 'Impossible de désactiver son propre compte' });
    return;
  }

  await prisma.user.update({ where: { id }, data: { actif: false } });
  res.json({ message: 'Compte désactivé' });
}
