// src/controllers/audit.controller.ts
// Journal d'audit — liste paginée des AuditLog avec filtres.
// GET /api/audit : 50 entrées par page, filtres action / entite / auteur_id / dates.
// Accessible super_admin uniquement (appliqué dans audit.routes.ts).

import { Request, Response } from 'express';
import prisma from '../lib/prisma';

const PER_PAGE = 50;

// GET /api/audit
export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const page      = Math.max(1, Number(req.query.page) || 1);
    const action    = typeof req.query.action    === 'string' ? req.query.action    : undefined;
    const entite    = typeof req.query.entite    === 'string' ? req.query.entite    : undefined;
    const auteurId  = typeof req.query.auteur_id === 'string' ? req.query.auteur_id : undefined;
    const dateDebut = typeof req.query.date_debut === 'string' && req.query.date_debut ? new Date(req.query.date_debut) : undefined;
    const dateFin   = typeof req.query.date_fin   === 'string' && req.query.date_fin   ? new Date(req.query.date_fin)   : undefined;

    const where: Record<string, unknown> = {};
    if (action)   where.action    = action;
    if (entite)   where.entite    = entite;
    if (auteurId) where.auteur_id = auteurId;
    if (dateDebut || dateFin) {
      where.created_at = {
        ...(dateDebut ? { gte: dateDebut } : {}),
        ...(dateFin   ? { lte: dateFin   } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip:    (page - 1) * PER_PAGE,
        take:    PER_PAGE,
        include: {
          auteur: { select: { id: true, prenom: true, nom: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      logs,
      total,
      page,
      pages: Math.ceil(total / PER_PAGE) || 1,
    });
  } catch (err) {
    console.error('[audit.listAuditLogs]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}
