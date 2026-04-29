// src/middlewares/auth.middleware.ts
// Vérifie le JWT dans le header Authorization et attache le payload à req.user.

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export type UserRole =
  | 'super_admin'
  | 'admin_campus'
  | 'referent_eglise'
  | 'referent_integration'
  | 'lecteur';

export type CampusValue = 'paris' | 'paris_nord';

export interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
  campus: CampusValue[];
}

// Extension du type Request d'Express pour exposer req.user partout
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Token manquant' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET non défini dans .env');

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Token invalide ou expiré' });
  }
}
