// src/controllers/messages.controller.ts
// Gestion des messages WhatsApp via Twilio.
// Le message de bienvenue est normalement déclenché par le cron (src/lib/cron.ts) à J+3.
// Ce contrôleur permet aussi un envoi manuel et reçoit les mises à jour de statut Twilio.

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { sendWhatsApp } from '../lib/twilio';

// GET /api/messages
export async function listMessages(req: Request, res: Response): Promise<void> {
  const { type, statut, campus, page = '1', limit = '50' } = req.query;
  const callerCampus = req.user!.campus;
  const callerRole = req.user!.role;

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (statut) where.statut = statut;

  // Filtre campus via le contact lié
  if (callerRole !== 'super_admin') {
    where.contact = { campus: { in: callerCampus } };
  } else if (campus) {
    where.contact = { campus };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { created_at: 'desc' },
      include: {
        contact: { select: { id: true, prenom: true, nom: true, telephone: true } },
      },
    }),
    prisma.message.count({ where }),
  ]);

  res.json({ messages, total });
}

// GET /api/messages/contact/:contactId
export async function getMessagesByContact(req: Request, res: Response): Promise<void> {
  const { contactId } = req.params;

  const messages = await prisma.message.findMany({
    where: { contact_id: contactId },
    orderBy: { created_at: 'desc' },
  });

  res.json(messages);
}

// POST /api/messages/bienvenue/:contactId — envoi manuel
export async function sendBienvenue(req: Request, res: Response): Promise<void> {
  const { contactId } = req.params;

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) {
    res.status(404).json({ message: 'Contact introuvable' });
    return;
  }

  if (!contact.referent_integration_id) {
    res.status(400).json({ message: 'Aucun référent intégration assigné — message impossible' });
    return;
  }

  // Vérifie qu'un message de bienvenue n'a pas déjà été envoyé
  const existing = await prisma.message.findFirst({
    where: { contact_id: contactId, type: 'bienvenue', statut: { in: ['envoye', 'en_attente'] } },
  });
  if (existing) {
    res.status(409).json({ message: 'Un message de bienvenue existe déjà pour ce contact' });
    return;
  }

  const contenu = buildBienvenueMessage(contact.prenom);

  const { sid, error } = await sendWhatsApp(contact.telephone, contenu);

  const message = await prisma.message.create({
    data: {
      contact_id: contactId,
      type: 'bienvenue',
      contenu,
      statut: error ? 'echoue' : 'envoye',
      twilio_sid: sid ?? null,
      envoye_le: error ? null : new Date(),
      created_by: req.user!.id,
    },
  });

  if (!error) {
    await prisma.contact.update({
      where: { id: contactId },
      data: { derniere_interaction: new Date() },
    });
  }

  res.status(201).json({ message, error: error ?? null });
}

// POST /api/messages/webhook/twilio — mise à jour statut par Twilio
export async function twilioWebhook(req: Request, res: Response): Promise<void> {
  const { MessageSid, MessageStatus } = req.body as {
    MessageSid: string;
    MessageStatus: string;
  };

  if (!MessageSid) {
    res.sendStatus(400);
    return;
  }

  const statut = MessageStatus === 'delivered' || MessageStatus === 'sent' ? 'envoye' : 'echoue';

  await prisma.message.updateMany({
    where: { twilio_sid: MessageSid },
    data: {
      statut,
      envoye_le: statut === 'envoye' ? new Date() : undefined,
    },
  });

  res.sendStatus(204);
}

// ─── Helper ──────────────────────────────────────────────────────────────────

export function buildBienvenueMessage(prenom: string): string {
  return (
    `Bonjour ${prenom} ! 🙏\n\n` +
    `Nous sommes ravis de vous avoir parmi nous à l'église Phila Cité des Adorateurs.\n` +
    `Un membre de notre équipe d'intégration va prendre contact avec vous très prochainement.\n\n` +
    `Que Dieu vous bénisse !`
  );
}
