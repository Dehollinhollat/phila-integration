// src/controllers/evenements.controller.ts
// Gestion des événements et de la planification des envois groupés WhatsApp.
// La substitution des variables [Prénom], [Date], [Campus] est effectuée à l'envoi (cron.ts).

import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// GET /api/evenements
export async function listEvenements(req: Request, res: Response): Promise<void> {
  const { statut, campus } = req.query;
  const callerCampus = req.user!.campus;
  const callerRole = req.user!.role;

  const where: Record<string, unknown> = {};
  if (statut) where.statut = statut;

  if (callerRole !== 'super_admin') {
    where.OR = [{ campus: { in: callerCampus } }, { campus: null }];
  } else if (campus) {
    where.campus = campus;
  }

  const evenements = await prisma.evenement.findMany({
    where,
    orderBy: { date_evenement: 'desc' },
    include: {
      createur: { select: { id: true, prenom: true, nom: true } },
      _count: { select: { messages: true } },
    },
  });

  res.json(evenements);
}

// GET /api/evenements/:id
export async function getEvenement(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const evenement = await prisma.evenement.findUnique({
    where: { id },
    include: {
      createur: { select: { id: true, prenom: true, nom: true } },
      messages: {
        take: 20,
        orderBy: { created_at: 'desc' },
        include: { contact: { select: { id: true, prenom: true, nom: true } } },
      },
    },
  });

  if (!evenement) {
    res.status(404).json({ message: 'Événement introuvable' });
    return;
  }

  res.json(evenement);
}

// POST /api/evenements
export async function createEvenement(req: Request, res: Response): Promise<void> {
  const { titre, description, campus, date_evenement, message_template, destinataires } = req.body;

  if (!titre || !date_evenement || !message_template || !destinataires) {
    res.status(400).json({ message: 'Champs obligatoires manquants' });
    return;
  }

  const evenement = await prisma.evenement.create({
    data: {
      titre, description, campus,
      date_evenement: new Date(date_evenement),
      message_template, destinataires,
      created_by: req.user!.id,
    },
  });

  res.status(201).json(evenement);
}

// PATCH /api/evenements/:id
export async function updateEvenement(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const evenement = await prisma.evenement.findUnique({ where: { id } });
  if (!evenement) {
    res.status(404).json({ message: 'Événement introuvable' });
    return;
  }
  if (evenement.statut === 'envoye') {
    res.status(400).json({ message: 'Impossible de modifier un événement déjà envoyé' });
    return;
  }

  const data = { ...req.body };
  if (data.date_evenement) data.date_evenement = new Date(data.date_evenement);
  if (data.planifie_le) data.planifie_le = new Date(data.planifie_le);

  const updated = await prisma.evenement.update({ where: { id }, data });
  res.json(updated);
}

// DELETE /api/evenements/:id
export async function deleteEvenement(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const evenement = await prisma.evenement.findUnique({ where: { id } });
  if (!evenement) {
    res.status(404).json({ message: 'Événement introuvable' });
    return;
  }
  if (evenement.statut === 'envoye') {
    res.status(400).json({ message: 'Impossible de supprimer un événement déjà envoyé' });
    return;
  }

  await prisma.evenement.delete({ where: { id } });
  res.json({ message: 'Événement supprimé' });
}

// POST /api/evenements/:id/planifier
export async function planifierEvenement(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { planifie_le } = req.body as { planifie_le: string };

  if (!planifie_le) {
    res.status(400).json({ message: 'La date d\'envoi planifiée est requise' });
    return;
  }

  const sendAt = new Date(planifie_le);
  if (sendAt <= new Date()) {
    res.status(400).json({ message: 'La date d\'envoi doit être dans le futur' });
    return;
  }

  const evenement = await prisma.evenement.findUnique({ where: { id } });
  if (!evenement) {
    res.status(404).json({ message: 'Événement introuvable' });
    return;
  }
  if (evenement.statut === 'envoye') {
    res.status(400).json({ message: 'Événement déjà envoyé' });
    return;
  }

  const updated = await prisma.evenement.update({
    where: { id },
    data: { statut: 'planifie', planifie_le: sendAt },
  });

  res.json(updated);
}
