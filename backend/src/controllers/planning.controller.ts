// src/controllers/planning.controller.ts
// Planning dominical des équipes de service.
// Contrainte : un seul planning par dimanche par campus (@@unique dans le schema).

import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// Vérifie que la date est un dimanche (0 = dimanche en JS)
function isDimanche(date: Date): boolean {
  return date.getDay() === 0;
}

// GET /api/planning
export async function listPlannings(req: Request, res: Response): Promise<void> {
  const { campus, from, to } = req.query;
  const callerCampus = req.user!.campus;
  const callerRole = req.user!.role;

  const where: Record<string, unknown> = {};

  if (callerRole !== 'super_admin') where.campus = { in: callerCampus };
  else if (campus) where.campus = campus;

  if (from || to) {
    where.date_dimanche = {};
    if (from) (where.date_dimanche as Record<string, unknown>).gte = new Date(from as string);
    if (to) (where.date_dimanche as Record<string, unknown>).lte = new Date(to as string);
  }

  const plannings = await prisma.planningService.findMany({
    where,
    orderBy: { date_dimanche: 'asc' },
    include: {
      createur: { select: { id: true, prenom: true, nom: true } },
      _count: { select: { affectations: true } },
      affectations: {
        select: {
          role_service: true,
          ouvrier: { select: { prenom: true, nom: true } },
        },
      },
    },
  });

  res.json(plannings);
}

// GET /api/planning/:id
export async function getPlanning(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string;

  const planning = await prisma.planningService.findUnique({
    where: { id },
    include: {
      createur: { select: { id: true, prenom: true, nom: true } },
      affectations: {
        include: {
          ouvrier: { select: { id: true, prenom: true, nom: true, telephone: true, campus: true } },
        },
        orderBy: { role_service: 'asc' },
      },
    },
  });

  if (!planning) {
    res.status(404).json({ message: 'Planning introuvable' });
    return;
  }

  const referents = planning.referents_integration.length > 0
    ? await prisma.user.findMany({
        where:  { id: { in: planning.referents_integration } },
        select: { id: true, prenom: true, nom: true, email: true, role: true },
      })
    : [];

  res.json({ ...planning, referents });
}

// POST /api/planning
export async function createPlanning(req: Request, res: Response): Promise<void> {
  const { date_dimanche, campus, nouveaux_membres, service_salle, preparation_salle, priere_lundi } = req.body;

  if (!date_dimanche || !campus) {
    res.status(400).json({ message: 'La date et le campus sont requis' });
    return;
  }

  const date = new Date(date_dimanche);
  if (!isDimanche(date)) {
    res.status(400).json({ message: 'La date doit être un dimanche' });
    return;
  }

  try {
    const planning = await prisma.planningService.create({
      data: {
        date_dimanche: date,
        campus,
        nouveaux_membres,
        service_salle,
        preparation_salle,
        priere_lundi,
        created_by: req.user!.id,
      },
    });
    res.status(201).json(planning);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      // Planning already exists for this Sunday/campus — return the existing one
      const existing = await prisma.planningService.findFirst({
        where: { date_dimanche: date, campus },
        include: {
          createur: { select: { id: true, prenom: true, nom: true } },
          affectations: {
            include: {
              ouvrier: { select: { id: true, prenom: true, nom: true, telephone: true, campus: true } },
            },
          },
        },
      });
      res.status(200).json(existing);
    } else {
      throw err;
    }
  }
}

// PATCH /api/planning/:id
export async function updatePlanning(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string;

  const data = { ...req.body };
  if (data.date_dimanche) {
    const date = new Date(data.date_dimanche);
    if (!isDimanche(date)) {
      res.status(400).json({ message: 'La date doit être un dimanche' });
      return;
    }
    data.date_dimanche = date;
  }

  const planning = await prisma.planningService.update({ where: { id }, data });
  res.json(planning);
}

// DELETE /api/planning/:id
export async function deletePlanning(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string;

  const exists = await prisma.planningService.findUnique({ where: { id } });
  if (!exists) {
    res.status(404).json({ message: 'Planning introuvable' });
    return;
  }

  await prisma.planningService.delete({ where: { id } });
  res.json({ message: 'Planning supprimé' });
}
