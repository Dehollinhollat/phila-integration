// src/controllers/feedback.controller.ts
// Questionnaire de satisfaction — envoyé par WhatsApp 14 jours après inscription.
// POST /api/feedback/:token — public : vérifie le token, sauvegarde les réponses JSON.
// GET  /api/feedback         — admin_campus+ : retourne les feedbacks avec statistiques.

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { Prisma } from '../../generated/prisma/client';

// POST /api/feedback/:token
export async function submitFeedback(req: Request, res: Response): Promise<void> {
  const token   = req.params.token as string;
  const reponses = req.body as Prisma.InputJsonValue;

  const feedbackToken = await prisma.feedbackToken.findUnique({ where: { token } });

  if (!feedbackToken) {
    res.status(404).json({ message: 'Lien invalide ou expiré.' });
    return;
  }
  if (feedbackToken.used) {
    res.status(409).json({ message: 'Ce questionnaire a déjà été rempli.' });
    return;
  }
  if (feedbackToken.expires_at < new Date()) {
    res.status(410).json({ message: 'Ce lien a expiré. Merci de nous contacter directement.' });
    return;
  }

  await prisma.$transaction([
    prisma.feedback.create({
      data: {
        contact_id: feedbackToken.contact_id,
        token,
        reponses,
      },
    }),
    prisma.feedbackToken.update({
      where: { token },
      data:  { used: true },
    }),
  ]);

  res.status(200).json({ message: 'Merci pour vos réponses !' });
}

// GET /api/feedback
export async function getFeedbacks(_req: Request, res: Response): Promise<void> {
  const feedbacks = await prisma.feedback.findMany({
    orderBy: { created_at: 'desc' },
  });

  const total = feedbacks.length;

  function moyenneQuestion(key: string): number | null {
    const values = feedbacks
      .map(f => {
        const r = f.reponses as Record<string, unknown>;
        return typeof r[key] === 'number' ? (r[key] as number) : null;
      })
      .filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  }

  function repartition(key: string): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const f of feedbacks) {
      const r = f.reponses as Record<string, unknown>;
      const val = r[key];
      if (Array.isArray(val)) {
        for (const v of val) {
          if (typeof v === 'string') counts[v] = (counts[v] ?? 0) + 1;
        }
      } else if (typeof val === 'string' && val) {
        counts[val] = (counts[val] ?? 0) + 1;
      }
    }
    return counts;
  }

  const commentaires = feedbacks
    .map(f => {
      const r = f.reponses as Record<string, unknown>;
      return typeof r['q12'] === 'string' && r['q12'] ? r['q12'] as string : null;
    })
    .filter((c): c is string => c !== null);

  res.json({
    total,
    statistiques: {
      moyenne_q4: moyenneQuestion('q4'),
      moyenne_q5: moyenneQuestion('q5'),
      q1: repartition('q1'),
      q2: repartition('q2'),
      q3: repartition('q3'),
      q4: repartition('q4'),
      q5: repartition('q5'),
      q6: repartition('q6'),
      q7: repartition('q7'),
      q8: repartition('q8'),
      q9: repartition('q9'),
      q10: repartition('q10'),
      q11: repartition('q11'),
    },
    commentaires,
    feedbacks,
  });
}
