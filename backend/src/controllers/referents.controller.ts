// src/controllers/referents.controller.ts
// Assignation des référents intégration et église sur les contacts.
// Lorsqu'un référent intégration est assigné, la date_attribution_referent est enregistrée
// afin que le cron job puisse calculer le délai J+3 pour l'envoi du message de bienvenue.

import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// GET /api/referents
export async function listReferents(req: Request, res: Response): Promise<void> {
  const { campus, role } = req.query;
  const callerCampus = req.user!.campus;
  const callerRole = req.user!.role;

  const where: Record<string, unknown> = { actif: true };

  // Filtre par campus : admin_campus voit uniquement ses campus
  if (callerRole !== 'super_admin') {
    where.campus = { hasSome: callerCampus };
  } else if (campus) {
    where.campus = { hasSome: [campus as string] };
  }

  // Filtre optionnel par rôle
  const allowedRoles = ['referent_integration', 'referent_eglise', 'admin_campus'];
  if (role && allowedRoles.includes(role as string)) {
    where.role = role;
  } else {
    where.role = { in: allowedRoles };
  }

  const referents = await prisma.user.findMany({
    where,
    select: { id: true, prenom: true, nom: true, email: true, role: true, campus: true },
    orderBy: { nom: 'asc' },
  });

  res.json(referents);
}

// PATCH /api/referents/contacts/:contactId/integration
export async function assignReferentIntegration(req: Request, res: Response): Promise<void> {
  const { contactId } = req.params;
  const { referentId } = req.body as { referentId: string };

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) {
    res.status(404).json({ message: 'Contact introuvable' });
    return;
  }

  const referent = await prisma.user.findUnique({ where: { id: referentId } });
  if (!referent || !referent.actif) {
    res.status(404).json({ message: 'Référent introuvable' });
    return;
  }

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: {
      referent_integration_id: referentId,
      // N'écrase la date que si pas encore définie
      date_attribution_referent: contact.date_attribution_referent ?? new Date(),
    },
    include: {
      referent_integration: { select: { id: true, prenom: true, nom: true } },
    },
  });

  res.json(updated);
}

// DELETE /api/referents/contacts/:contactId/integration
export async function removeReferentIntegration(req: Request, res: Response): Promise<void> {
  const { contactId } = req.params;

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: { referent_integration_id: null },
  });

  res.json(updated);
}

// PATCH /api/referents/contacts/:contactId/eglise
export async function assignReferentEglise(req: Request, res: Response): Promise<void> {
  const { contactId } = req.params;
  const { referentId } = req.body as { referentId: string };

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) {
    res.status(404).json({ message: 'Contact introuvable' });
    return;
  }

  const referent = await prisma.user.findUnique({ where: { id: referentId } });
  if (!referent || !referent.actif) {
    res.status(404).json({ message: 'Référent introuvable' });
    return;
  }

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: { referent_eglise_id: referentId },
    include: {
      referent_eglise: { select: { id: true, prenom: true, nom: true } },
    },
  });

  res.json(updated);
}

// DELETE /api/referents/contacts/:contactId/eglise
export async function removeReferentEglise(req: Request, res: Response): Promise<void> {
  const { contactId } = req.params;

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: { referent_eglise_id: null },
  });

  res.json(updated);
}
