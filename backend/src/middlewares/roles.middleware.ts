// src/middlewares/roles.middleware.ts
// Contrôle d'accès basé sur les rôles (RBAC).
// Utilisé après authenticate() sur les routes qui nécessitent un rôle minimum.
//
// Hiérarchie des rôles (du plus élevé au plus bas) :
// super_admin > admin_campus > referent_eglise > referent_integration > lecteur

import { Request, Response, NextFunction } from 'express';
import { UserRole } from './auth.middleware';

const ROLE_RANK: Record<UserRole, number> = {
  super_admin: 5,
  admin_campus: 4,
  referent_eglise: 3,
  referent_integration: 2,
  lecteur: 1,
};

/**
 * Autorise l'accès si l'utilisateur a au moins l'un des rôles spécifiés.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Non authentifié' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: 'Accès refusé — rôle insuffisant' });
      return;
    }
    next();
  };
}

/**
 * Autorise si le rôle de l'utilisateur est >= au rang minimum requis.
 */
export function requireMinRole(minRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Non authentifié' });
      return;
    }
    if (ROLE_RANK[req.user.role] < ROLE_RANK[minRole]) {
      res.status(403).json({ message: 'Accès refusé — rôle insuffisant' });
      return;
    }
    next();
  };
}

/**
 * Vérifie que l'utilisateur a accès au campus du contact demandé.
 * Le super_admin a accès à tous les campus.
 */
export function requireCampusAccess(campusParam: 'paris' | 'paris_nord') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Non authentifié' });
      return;
    }
    if (req.user.role === 'super_admin') {
      next();
      return;
    }
    if (!req.user.campus.includes(campusParam)) {
      res.status(403).json({ message: 'Accès refusé — campus non autorisé' });
      return;
    }
    next();
  };
}

/**
 * Retourne true si l'utilisateur peut écrire (pas lecteur).
 */
export function canWrite(role: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK['referent_integration'];
}
