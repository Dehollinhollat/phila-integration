// src/controllers/checklist.controller.ts
// Gestion des étapes de checklist d'intégration par contact.
//
// Chaque contact possède 6 ChecklistItems générés automatiquement à sa création.
// Règle métier critique : cocher 'integration_confirmee' déclenche automatiquement
// le passage du contact au statut 'integre' et crée une notification pour le super_admin.

import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// GET /api/checklist/contact/:contactId
export async function listChecklist(req: Request, res: Response): Promise<void> {
  const { contactId } = req.params;

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) {
    res.status(404).json({ message: 'Contact introuvable' });
    return;
  }

  const items = await prisma.checklistItem.findMany({
    where: { contact_id: contactId },
    include: {
      complete_par: { select: { id: true, prenom: true, nom: true } },
    },
    orderBy: { etape: 'asc' },
  });

  res.json(items);
}

// PATCH /api/checklist/:id
export async function updateChecklistItem(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { complete, commentaire } = req.body as { complete: boolean; commentaire?: string };

  const item = await prisma.checklistItem.findUnique({
    where: { id },
    include: { contact: { select: { id: true, prenom: true, nom: true, campus: true } } },
  });

  if (!item) {
    res.status(404).json({ message: 'Étape introuvable' });
    return;
  }

  const data: Record<string, unknown> = {
    complete,
    commentaire: commentaire ?? item.commentaire,
  };

  if (complete) {
    data.complete_par_id = req.user!.id;
    data.complete_le = new Date();
  } else {
    data.complete_par_id = null;
    data.complete_le = null;
  }

  const updated = await prisma.checklistItem.update({ where: { id }, data });

  // Logique métier : intégration confirmée → statut contact + notification super_admin
  if (complete && item.etape === 'integration_confirmee') {
    const superAdmins = await prisma.user.findMany({
      where: { role: 'super_admin', actif: true },
      select: { id: true },
    });

    await prisma.$transaction([
      prisma.contact.update({
        where: { id: item.contact_id },
        data: { statut: 'integre' },
      }),
      prisma.historiqueStatut.create({
        data: {
          contact_id: item.contact_id,
          statut_avant: item.contact.campus ? 'en_suivi' : 'nouveau',
          statut_apres: 'integre',
          change_par_id: req.user!.id,
          commentaire: 'Checklist d\'intégration complétée',
        },
      }),
      ...superAdmins.map((admin) =>
        prisma.notification.create({
          data: {
            user_id: admin.id,
            type: 'checklist_completee',
            titre: 'Intégration confirmée',
            message: `${item.contact.prenom} ${item.contact.nom} a complété toutes les étapes d'intégration.`,
            lien: `/contacts/${item.contact_id}`,
          },
        })
      ),
    ]);
  }

  res.json(updated);
}
