// src/controllers/auth.controller.ts
// Gestion de l'authentification JWT et de la gestion des comptes utilisateurs.
// La création de comptes est réservée au super_admin.

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { JwtPayload } from '../middlewares/auth.middleware';

const JWT_EXPIRES_IN = '8h';

// POST /api/auth/login
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    res.status(400).json({ message: 'Email et mot de passe requis' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.actif) {
    res.status(401).json({ message: 'Identifiants invalides' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ message: 'Identifiants invalides' });
    return;
  }

  const secret = process.env.JWT_SECRET!;
  const payload: JwtPayload = {
    id: user.id,
    email: user.email,
    role: user.role as JwtPayload['role'],
    campus: user.campus as JwtPayload['campus'],
  };
  const token = jwt.sign(payload, secret, { expiresIn: JWT_EXPIRES_IN });

  res.json({
    token,
    user: {
      id: user.id,
      prenom: user.prenom,
      nom: user.nom,
      email: user.email,
      role: user.role,
      campus: user.campus,
    },
  });
}

// GET /api/auth/me
export async function getMe(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, prenom: true, nom: true, email: true, role: true, campus: true, actif: true },
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
  const user = await prisma.user.create({
    data: { prenom, nom, email, password: hashed, role, campus: campus ?? [] },
    select: { id: true, prenom: true, nom: true, email: true, role: true, campus: true },
  });

  res.status(201).json(user);
}

// GET /api/auth/users
export async function listUsers(req: Request, res: Response): Promise<void> {
  const { campus } = req.query;

  // admin_campus filtre sur ses campus
  const callerRole = req.user!.role;
  const callerCampus = req.user!.campus;

  const where: Record<string, unknown> = {};
  if (callerRole === 'admin_campus') {
    where.campus = { hasSome: callerCampus };
  } else if (campus) {
    where.campus = { hasSome: [campus as string] };
  }

  const users = await prisma.user.findMany({
    where,
    select: { id: true, prenom: true, nom: true, email: true, role: true, campus: true, actif: true },
    orderBy: { nom: 'asc' },
  });

  res.json(users);
}

// PATCH /api/auth/users/:id
export async function updateUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { prenom, nom, email, role, campus, password } = req.body;

  const data: Record<string, unknown> = {};
  if (prenom) data.prenom = prenom;
  if (nom) data.nom = nom;
  if (email) data.email = email;
  if (role) data.role = role;
  if (campus) data.campus = campus;
  if (password) data.password = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, prenom: true, nom: true, email: true, role: true, campus: true, actif: true },
  });

  res.json(user);
}

// DELETE /api/auth/users/:id — désactivation soft
export async function deactivateUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  // Empêche de se désactiver soi-même
  if (id === req.user!.id) {
    res.status(400).json({ message: 'Impossible de désactiver son propre compte' });
    return;
  }

  await prisma.user.update({ where: { id }, data: { actif: false } });
  res.json({ message: 'Compte désactivé' });
}
