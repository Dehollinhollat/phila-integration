// src/controllers/affectations.controller.ts
// Gestion des affectations d'ouvriers aux plannings de service.
// Un ouvrier peut être affecté à un planning avec un rôle spécifique (RoleService).
// Il peut accepter ou décliner l'affectation via PATCH /:id/statut.

import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// GET /api/affectations?planning_id=...
export async function listAffectations(req: Request, res: Response): Promise<void> {
  const { planning_id } = req.query;

  if (!planning_id) {
    res.status(400).json({ message: 'Le paramètre planning_id est requis' });
    return;
  }

  const planning = await prisma.planningService.findUnique({ where: { id: planning_id as string } });
  if (!planning) {
    res.status(404).json({ message: 'Planning introuvable' });
    return;
  }

  const affectations = await prisma.affectationPlanning.findMany({
    where: { planning_id: planning_id as string },
    include: {
      ouvrier: { select: { id: true, prenom: true, nom: true, telephone: true, campus: true } },
    },
    orderBy: { role_service: 'asc' },
  });

  res.json(affectations);
}

// POST /api/affectations
export async function createAffectation(req: Request, res: Response): Promise<void> {
  console.log('[AFFECTATION] Body reçu:', req.body);

  const { planning_id, ouvrier_id, role_service } = req.body as {
    planning_id: string;
    ouvrier_id:  string;
    role_service: string;
  };

  if (!planning_id || !ouvrier_id || !role_service) {
    res.status(400).json({ message: 'planning_id, ouvrier_id et role_service sont requis' });
    return;
  }

  const VALID_ROLES = ['identification_nm', 'service_salle', 'preparation_salle', 'service_en_ligne'];
  if (!VALID_ROLES.includes(role_service)) {
    res.status(400).json({ message: `Rôle invalide : ${role_service}. Valeurs acceptées : ${VALID_ROLES.join(', ')}` });
    return;
  }

  try {
    const [planning, ouvrier] = await Promise.all([
      prisma.planningService.findUnique({ where: { id: planning_id } }),
      prisma.ouvrier.findUnique({ where: { id: ouvrier_id } }),
    ]);

    if (!planning) {
      res.status(404).json({ message: 'Planning introuvable' });
      return;
    }
    if (!ouvrier || !ouvrier.statut) {
      res.status(404).json({ message: 'Ouvrier introuvable ou inactif' });
      return;
    }

    const existing = await prisma.affectationPlanning.findFirst({
      where: { planning_id, ouvrier_id, role_service },
    });
    if (existing) {
      res.status(409).json({ message: 'Cette affectation existe déjà' });
      return;
    }

    const affectation = await prisma.affectationPlanning.create({
      data: { planning_id, ouvrier_id, role_service: role_service as any },
      include: {
        ouvrier: { select: { id: true, prenom: true, nom: true, telephone: true, campus: true } },
      },
    });

    res.status(201).json(affectation);
  } catch (err: unknown) {
    console.error('[AFFECTATION] Erreur createAffectation:', err);
    const detail = (err as any)?.message ?? String(err);
    res.status(500).json({ message: 'Erreur lors de la création de l\'affectation', detail });
  }
}

// PATCH /api/affectations/:id/statut — ouvrier répond à son affectation
export async function respondToAffectation(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { statut } = req.body as { statut: 'accepte' | 'decline' };

  if (!['accepte', 'decline'].includes(statut)) {
    res.status(400).json({ message: "Le statut doit être 'accepte' ou 'decline'" });
    return;
  }

  const affectation = await prisma.affectationPlanning.findUnique({ where: { id } });
  if (!affectation) {
    res.status(404).json({ message: 'Affectation introuvable' });
    return;
  }

  const updated = await prisma.affectationPlanning.update({
    where: { id },
    data: { statut, repondu_le: new Date() },
    include: {
      ouvrier: { select: { id: true, prenom: true, nom: true } },
    },
  });

  res.json(updated);
}

// GET /api/affectations/mes — affectations of the logged-in user (matched via ouvrier email)
export async function mesAffectations(req: Request, res: Response): Promise<void> {
  const userEmail = req.user!.email;

  const ouvrier = await prisma.ouvrier.findFirst({
    where: { email: userEmail, statut: true },
  });

  if (!ouvrier) {
    res.json([]);
    return;
  }

  const affectations = await prisma.affectationPlanning.findMany({
    where: { ouvrier_id: ouvrier.id },
    include: {
      planning: {
        select: { id: true, date_dimanche: true, campus: true, nouveaux_membres: true },
      },
    },
    orderBy: { planning: { date_dimanche: 'desc' } },
  });

  res.json(affectations);
}

// DELETE /api/affectations/:id
export async function deleteAffectation(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const affectation = await prisma.affectationPlanning.findUnique({ where: { id } });
  if (!affectation) {
    res.status(404).json({ message: 'Affectation introuvable' });
    return;
  }

  await prisma.affectationPlanning.delete({ where: { id } });
  res.json({ message: 'Affectation supprimée' });
}
