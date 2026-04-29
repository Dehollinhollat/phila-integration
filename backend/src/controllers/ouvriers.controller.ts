// src/controllers/ouvriers.controller.ts
// Gestion des ouvriers — deux modes : promotion depuis un contact ou inscription directe.

import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// GET /api/ouvriers
export async function listOuvriers(req: Request, res: Response): Promise<void> {
  const { campus, statut, service } = req.query;
  const callerCampus = req.user!.campus;
  const callerRole = req.user!.role;

  const where: Record<string, unknown> = {};
  if (callerRole !== 'super_admin') where.campus = { in: callerCampus };
  else if (campus) where.campus = campus;

  if (statut !== undefined) where.statut = statut === 'true';
  if (service) where.services = { hasSome: [service as string] };

  const ouvriers = await prisma.ouvrier.findMany({
    where,
    orderBy: { nom: 'asc' },
    include: { contact: { select: { id: true, profil: true, statut: true } } },
  });

  res.json(ouvriers);
}

// GET /api/ouvriers/:id
export async function getOuvrier(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const ouvrier = await prisma.ouvrier.findUnique({
    where: { id },
    include: { contact: true },
  });
  if (!ouvrier) {
    res.status(404).json({ message: 'Ouvrier introuvable' });
    return;
  }
  res.json(ouvrier);
}

// POST /api/ouvriers — inscription directe
export async function createOuvrier(req: Request, res: Response): Promise<void> {
  const { prenom, nom, telephone, email, campus, services, date_debut_service } = req.body;

  if (!prenom || !nom || !telephone || !campus) {
    res.status(400).json({ message: 'Champs obligatoires manquants' });
    return;
  }

  const ouvrier = await prisma.ouvrier.create({
    data: {
      prenom, nom, telephone, email, campus,
      services: services ?? [],
      date_debut_service: date_debut_service ? new Date(date_debut_service) : null,
      inscription_directe: true,
    },
  });

  res.status(201).json(ouvrier);
}

// POST /api/ouvriers/contacts/:contactId/promouvoir
export async function promoteContact(req: Request, res: Response): Promise<void> {
  const { contactId } = req.params;
  const { services, date_debut_service } = req.body;

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) {
    res.status(404).json({ message: 'Contact introuvable' });
    return;
  }

  const alreadyOuvrier = await prisma.ouvrier.findUnique({ where: { contact_id: contactId } });
  if (alreadyOuvrier) {
    res.status(409).json({ message: 'Ce contact est déjà ouvrier' });
    return;
  }

  const [ouvrier] = await prisma.$transaction([
    prisma.ouvrier.create({
      data: {
        contact_id: contactId,
        prenom: contact.prenom,
        nom: contact.nom,
        telephone: contact.telephone,
        email: contact.email ?? undefined,
        campus: contact.campus,
        services: services ?? [],
        date_debut_service: date_debut_service ? new Date(date_debut_service) : null,
        inscription_directe: false,
      },
    }),
    prisma.contact.update({
      where: { id: contactId },
      data: { statut: 'ouvrier' },
    }),
    prisma.historiqueStatut.create({
      data: {
        contact_id: contactId,
        statut_avant: contact.statut,
        statut_apres: 'ouvrier',
        change_par_id: req.user!.id,
        commentaire: 'Promotion en ouvrier',
      },
    }),
  ]);

  res.status(201).json(ouvrier);
}

// PATCH /api/ouvriers/:id
export async function updateOuvrier(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const ouvrier = await prisma.ouvrier.update({
    where: { id },
    data: req.body,
  });

  res.json(ouvrier);
}

// DELETE /api/ouvriers/:id — désactivation soft
export async function deactivateOuvrier(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  await prisma.ouvrier.update({ where: { id }, data: { statut: false } });
  res.json({ message: 'Ouvrier désactivé' });
}
