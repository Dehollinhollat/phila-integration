// src/controllers/settings.controller.ts
// Paramètres système.
// - global*  : seuils d'alerte, stockés dans Settings — super_admin uniquement (route).
// - campus*  : templates messages + infos église + verset certificat, stockés dans
//   CampusSettings, un campus à la fois — accès vérifié par requireCampusAccess (route).

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { Campus } from '../../generated/prisma/client';
import { CAMPUS_SETTINGS_KEYS, type CampusSettingKey } from '../lib/campusSettings';

// GET /api/settings/global
export async function getGlobalSettings(_req: Request, res: Response): Promise<void> {
  const rows = await prisma.settings.findMany();
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  res.json(result);
}

// PUT /api/settings/global — body: [{key, value}, ...]
export async function updateGlobalSettings(req: Request, res: Response): Promise<void> {
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

// GET /api/settings/campus/:campus
export async function getCampusSettingsHandler(req: Request, res: Response): Promise<void> {
  const campus = String(req.params.campus);
  if (!Object.values(Campus).includes(campus as Campus)) {
    res.status(400).json({ message: `Campus inconnu : ${campus}` });
    return;
  }
  const rows = await prisma.campusSettings.findMany({ where: { campus: campus as never } });
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  res.json(result);
}

// PUT /api/settings/campus/:campus — body: [{key, value}, ...]
// N'écrit que sur le campus de l'URL — impossible d'impacter un autre campus depuis cette route.
export async function updateCampusSettingsHandler(req: Request, res: Response): Promise<void> {
  const campus = String(req.params.campus);
  if (!Object.values(Campus).includes(campus as Campus)) {
    res.status(400).json({ message: `Campus inconnu : ${campus}` });
    return;
  }
  const entries = req.body as { key: string; value: string }[];

  if (!Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ message: 'Corps attendu : tableau non vide [{key, value}]' });
    return;
  }

  const invalidEntry = entries.find(e => !CAMPUS_SETTINGS_KEYS.includes(e.key as CampusSettingKey));
  if (invalidEntry) {
    res.status(400).json({ message: `Clé de paramètre inconnue : ${invalidEntry.key}` });
    return;
  }

  await prisma.$transaction(
    entries.map(({ key, value }) =>
      prisma.campusSettings.upsert({
        where:  { campus_key: { campus: campus as never, key } },
        update: { value },
        create: { campus: campus as never, key, value },
      })
    )
  );

  const rows = await prisma.campusSettings.findMany({ where: { campus: campus as never } });
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  res.json(result);
}
