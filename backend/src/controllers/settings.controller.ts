// src/controllers/settings.controller.ts
// Paramètres système stockés en clé-valeur.
// GET retourne Record<string,string>; PUT fait un upsert transactionnel par lot.

import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// GET /api/settings
export async function getSettings(_req: Request, res: Response): Promise<void> {
  const rows = await prisma.settings.findMany();
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  res.json(result);
}

// PUT /api/settings — body: [{key, value}, ...]
export async function updateSettings(req: Request, res: Response): Promise<void> {
  const entries = req.body as { key: string; value: string }[];

  if (!Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ message: 'Corps attendu : tableau non vide [{key, value}]' });
    return;
  }

  await prisma.$transaction(
    entries.map(({ key, value }) =>
      prisma.settings.upsert({
        where:  { key },
        update: { value },
        create: { key, value },
      })
    )
  );

  const rows = await prisma.settings.findMany();
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  res.json(result);
}
