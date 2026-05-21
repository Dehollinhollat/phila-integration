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
  const contactId = req.params.contactId as string;
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

  const [updated] = await prisma.$transaction([
    prisma.contact.update({
      where: { id: contactId },
      data: {
        referent_integration_id: referentId,
        // N'écrase la date que si pas encore définie
        date_attribution_referent: contact.date_attribution_referent ?? new Date(),
      },
      include: {
        referent_integration: { select: { id: true, prenom: true, nom: true } },
      },
    }),
    // Notifie le référent qu'un nouveau contact lui est assigné
    prisma.notification.create({
      data: {
        user_id: referentId,
        type: 'nouveau_contact_assigne',
        titre: 'Nouveau contact assigné',
        message: `${contact.prenom} ${contact.nom} vous a été assigné pour le suivi d'intégration.`,
        lien: `/contacts/${contactId}`,
      },
    }),
  ]);

  res.json(updated);
}

// DELETE /api/referents/contacts/:contactId/integration
export async function removeReferentIntegration(req: Request, res: Response): Promise<void> {
  const contactId = req.params.contactId as string;

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: { referent_integration_id: null },
  });

  res.json(updated);
}

// PATCH /api/referents/contacts/:contactId/eglise
export async function assignReferentEglise(req: Request, res: Response): Promise<void> {
  const contactId = req.params.contactId as string;
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

// GET /api/referents/charge
// Retourne la charge de chaque référent (intégration + église) avec ses contacts.
export async function getChargeReferents(req: Request, res: Response): Promise<void> {
  const callerRole   = req.user!.role;
  const callerCampus = req.user!.campus;

  const baseWhere: Record<string, unknown> = { actif: true };
  if (callerRole !== 'super_admin') {
    baseWhere.campus = { hasSome: callerCampus };
  }

  const [integrationUsers, egliseUsers] = await Promise.all([
    prisma.user.findMany({
      where: { ...baseWhere, role: { in: ['referent_integration', 'admin_campus'] } },
      select: { id: true, prenom: true, nom: true, email: true, role: true, campus: true },
      orderBy: { nom: 'asc' },
    }),
    prisma.user.findMany({
      where: { ...baseWhere, role: { in: ['referent_eglise', 'admin_campus'] } },
      select: { id: true, prenom: true, nom: true, email: true, role: true, campus: true },
      orderBy: { nom: 'asc' },
    }),
  ]);

  const contactSelect = { id: true, prenom: true, nom: true, statut: true, campus: true } as const;

  type ReferentRow = { id: string; prenom: string; nom: string; email: string; role: string; campus: string[] };

  const [integrationCharge, egliseCharge] = await Promise.all([
    Promise.all(integrationUsers.map(async (r: ReferentRow) => {
      const [count, contacts] = await Promise.all([
        prisma.contact.count({ where: { referent_integration_id: r.id } }),
        prisma.contact.findMany({ where: { referent_integration_id: r.id }, select: contactSelect, take: 5, orderBy: { date_inscription: 'desc' } }),
      ]);
      return { ...r, count, contacts };
    })),
    Promise.all(egliseUsers.map(async (r: ReferentRow) => {
      const [count, contacts] = await Promise.all([
        prisma.contact.count({ where: { referent_eglise_id: r.id } }),
        prisma.contact.findMany({ where: { referent_eglise_id: r.id }, select: contactSelect, take: 5, orderBy: { date_inscription: 'desc' } }),
      ]);
      return { ...r, count, contacts };
    })),
  ]);

  const campusFilter = callerRole !== 'super_admin' ? { campus: { in: callerCampus } } : {};
  const sansReferent = await prisma.contact.count({
    where: { referent_integration_id: null, statut: { not: 'inactif' }, ...campusFilter },
  });

  res.json({ integration: integrationCharge, eglise: egliseCharge, sans_referent: sansReferent });
}

// POST /api/referents/reassigner
export async function reassignerContacts(req: Request, res: Response): Promise<void> {
  const { contact_ids, nouveau_referent_id, type } = req.body as {
    contact_ids: string[];
    nouveau_referent_id: string;
    type: 'integration' | 'eglise';
  };

  if (!Array.isArray(contact_ids) || contact_ids.length === 0 || !nouveau_referent_id || !type) {
    res.status(400).json({ message: 'Paramètres manquants' });
    return;
  }

  const referent = await prisma.user.findUnique({ where: { id: nouveau_referent_id } });
  if (!referent || !referent.actif) {
    res.status(404).json({ message: 'Référent introuvable' });
    return;
  }

  const field = type === 'integration' ? 'referent_integration_id' : 'referent_eglise_id';
  const result = await prisma.contact.updateMany({
    where: { id: { in: contact_ids } },
    data:  { [field]: nouveau_referent_id },
  });

  res.json({ reassigned: result.count });
}

// DELETE /api/referents/contacts/:contactId/eglise
export async function removeReferentEglise(req: Request, res: Response): Promise<void> {
  const contactId = req.params.contactId as string;

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: { referent_eglise_id: null },
  });

  res.json(updated);
}
