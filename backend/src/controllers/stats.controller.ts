// src/controllers/stats.controller.ts
// Statistiques agrégées pour les graphiques du Dashboard.
// Les agrégations sont faites en JS côté serveur pour éviter $queryRaw
// et rester compatibles avec tous les adaptateurs Prisma.
//
// Toutes les routes nécessitent authenticate() + requireMinRole('admin_campus').

import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// Noms courts des 12 mois en français pour les axes X
const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

// ─── GET /api/stats/inscriptions-par-mois?campus=&mois=12 ────────────────────
// Retourne le nombre de nouveaux contacts par mois, ventilé par canal.
export async function inscriptionsParMois(req: Request, res: Response): Promise<void> {
  try {
    const campus = typeof req.query.campus === 'string' ? req.query.campus : undefined;
    const n      = Math.min(Math.max(Number(req.query.mois) || 12, 1), 24);

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - n + 1);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const where: Record<string, unknown> = { date_inscription: { gte: startDate } };
    if (campus) where.campus = campus;
    // Filtre campus du rôle appelant
    if (req.user!.role !== 'super_admin' && !campus) {
      where.campus = { in: req.user!.campus };
    }

    const contacts = await prisma.contact.findMany({
      where,
      select: { date_inscription: true, canal: true },
    });

    // Groupement par YYYY-MM puis par canal
    const grouped: Record<string, { presentiel: number; en_ligne: number }> = {};
    for (const c of contacts) {
      const d   = new Date(c.date_inscription);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = { presentiel: 0, en_ligne: 0 };
      grouped[key][c.canal as 'presentiel' | 'en_ligne']++;
    }

    // Construction du tableau pour les n derniers mois (même si count = 0)
    const now    = new Date();
    const result = [];
    for (let i = n - 1; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const g   = grouped[key] ?? { presentiel: 0, en_ligne: 0 };
      result.push({
        mois:       MOIS_COURTS[d.getMonth()],
        presentiel: g.presentiel,
        en_ligne:   g.en_ligne,
      });
    }

    res.json(result);
  } catch (err) {
    console.error('[stats.inscriptionsParMois]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── GET /api/stats/profils?campus= ─────────────────────────────────────────
// Répartition des profils pastoraux.
export async function profilsStats(req: Request, res: Response): Promise<void> {
  try {
    const campus = typeof req.query.campus === 'string' ? req.query.campus : undefined;

    const where: Record<string, unknown> = {};
    if (campus) {
      where.campus = campus;
    } else if (req.user!.role !== 'super_admin') {
      where.campus = { in: req.user!.campus };
    }

    const [membrePhila, visiteurSans, visiteurAvec] = await Promise.all([
      prisma.contact.count({ where: { ...where, profil: 'membre_phila' } }),
      prisma.contact.count({ where: { ...where, profil: 'visiteur_sans_eglise' } }),
      prisma.contact.count({ where: { ...where, profil: 'visiteur_avec_eglise' } }),
    ]);

    res.json([
      { name: 'Membre Phila',        value: membrePhila,   color: '#1A56B0' },
      { name: 'Visiteur',            value: visiteurSans,  color: '#D4A24E' },
      { name: 'Visiteur avec église', value: visiteurAvec, color: '#8B5CF6' },
    ]);
  } catch (err) {
    console.error('[stats.profils]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── GET /api/stats/statuts?campus= ─────────────────────────────────────────
// Distribution des contacts par statut de suivi.
export async function statutsStats(req: Request, res: Response): Promise<void> {
  try {
    const campus = typeof req.query.campus === 'string' ? req.query.campus : undefined;

    const where: Record<string, unknown> = {};
    if (campus) {
      where.campus = campus;
    } else if (req.user!.role !== 'super_admin') {
      where.campus = { in: req.user!.campus };
    }

    const statuts = ['nouveau', 'contacte', 'en_suivi', 'integre', 'ouvrier', 'inactif'] as const;

    const counts = await Promise.all(
      statuts.map(statut => prisma.contact.count({ where: { ...where, statut } }))
    );

    res.json(statuts.map((statut, i) => ({ statut, count: counts[i] })));
  } catch (err) {
    console.error('[stats.statuts]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── GET /api/stats/messages-par-semaine?semaines=8 ─────────────────────────
// Nombre de messages envoyés par semaine (N dernières semaines).
export async function messagesParSemaine(req: Request, res: Response): Promise<void> {
  try {
    const n = Math.min(Math.max(Number(req.query.semaines) || 8, 1), 52);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - n * 7);
    startDate.setHours(0, 0, 0, 0);

    // Filtre campus pour les non super_admin via les contacts liés
    const where: Record<string, unknown> = {
      statut:   'envoye',
      envoye_le: { gte: startDate },
    };
    if (req.user!.role !== 'super_admin') {
      where.contact = { campus: { in: req.user!.campus } };
    }

    const messages = await prisma.message.findMany({
      where,
      select: { envoye_le: true },
    });

    // Calcule le numéro de semaine ISO à partir d'une date
    function isoWeek(date: Date): number {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const day = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }

    // Clé unique "YYYY-WW" pour éviter les collisions en fin d'année
    function weekKey(date: Date): string {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const day = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - day);
      return `${d.getUTCFullYear()}-${String(isoWeek(date)).padStart(2, '0')}`;
    }

    // Groupement par semaine
    const grouped: Record<string, number> = {};
    for (const m of messages) {
      if (!m.envoye_le) continue;
      const key = weekKey(new Date(m.envoye_le));
      grouped[key] = (grouped[key] ?? 0) + 1;
    }

    // Construction du tableau pour les n dernières semaines
    const now    = new Date();
    const result = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const key   = weekKey(d);
      const semNum = isoWeek(d);
      result.push({ semaine: `S${semNum}`, count: grouped[key] ?? 0 });
    }

    res.json(result);
  } catch (err) {
    console.error('[stats.messagesParSemaine]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}
