// src/controllers/notifications.controller.ts
// Lecture et gestion des notifications in-app de l'utilisateur connecté.
// Chaque utilisateur ne voit que ses propres notifications.

import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// GET /api/notifications
export async function listNotifications(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { lue } = req.query;

  const where: Record<string, unknown> = { user_id: userId };
  if (lue === 'true') where.lue = true;
  if (lue === 'false') where.lue = false;

  const [notifications, total, nonLues] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    }),
    prisma.notification.count({ where: { user_id: userId } }),
    prisma.notification.count({ where: { user_id: userId, lue: false } }),
  ]);

  res.json({ notifications, total, nonLues });
}

// PATCH /api/notifications/:id/lue
export async function markAsRead(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const userId = req.user!.id;

  const notif = await prisma.notification.findUnique({ where: { id } });
  if (!notif || notif.user_id !== userId) {
    res.status(404).json({ message: 'Notification introuvable' });
    return;
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { lue: true },
  });

  res.json(updated);
}

// PATCH /api/notifications/lues — marque toutes les notifications comme lues
export async function markAllAsRead(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  await prisma.notification.updateMany({
    where: { user_id: userId, lue: false },
    data: { lue: true },
  });

  res.json({ message: 'Toutes les notifications marquées comme lues' });
}

// DELETE /api/notifications/:id
export async function deleteNotification(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const userId = req.user!.id;

  const notif = await prisma.notification.findUnique({ where: { id } });
  if (!notif || notif.user_id !== userId) {
    res.status(404).json({ message: 'Notification introuvable' });
    return;
  }

  await prisma.notification.delete({ where: { id } });
  res.json({ message: 'Notification supprimée' });
}
