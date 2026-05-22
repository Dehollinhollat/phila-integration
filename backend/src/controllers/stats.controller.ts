// src/controllers/stats.controller.ts
// Statistiques agrégées pour les graphiques du Dashboard.
// Les agrégations sont faites en JS côté serveur pour éviter $queryRaw
// et rester compatibles avec tous les adaptateurs Prisma.
//
// Toutes les routes nécessitent authenticate() + requireMinRole('admin_campus').

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { sendRapportHebdomadaire } from '../lib/email';

// Noms courts des 12 mois en français pour les axes X
const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

// Calcule le numéro de semaine ISO depuis une date
function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Clé "YYYY-WW" — évite les collisions de numéros de semaine en fin d'année
function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  return `${d.getUTCFullYear()}-${String(isoWeek(date)).padStart(2, '0')}`;
}

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

// ─── GET /api/stats/taux-conversion ─────────────────────────────────────────
// Taux d'intégration par campus : (intégrés + ouvriers) / total × 100.
export async function tauxConversion(req: Request, res: Response): Promise<void> {
  try {
    const campuses = req.user!.role === 'super_admin'
      ? ['paris', 'paris_nord']
      : (req.user!.campus as string[]);

    const INTENTIONS_EXCLUES = ['visite_occasionnelle', 'ne_souhaite_pas_integrer', 'transfere'];

    const results = await Promise.all(campuses.map(async (campus) => {
      const [total, integres] = await Promise.all([
        prisma.contact.count({
          where: { campus, intention: { notIn: INTENTIONS_EXCLUES as any } } as any,
        }),
        prisma.contact.count({
          where: { campus, statut: { in: ['integre', 'ouvrier'] as const } } as any,
        }),
      ]);
      return { campus, total, integres, taux: total > 0 ? Math.round((integres / total) * 100) : 0 };
    }));

    res.json(results);
  } catch (err) {
    console.error('[stats.tauxConversion]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── GET /api/stats/temps-integration ───────────────────────────────────────
// Durée médiane / moyenne entre la date d'inscription et l'intégration (jours).
export async function tempsIntegration(req: Request, res: Response): Promise<void> {
  try {
    const campusFilter = req.user!.role !== 'super_admin'
      ? { contact: { campus: { in: req.user!.campus as string[] } } }
      : {};

    const transitions: Array<{ created_at: Date; contact: { date_inscription: Date } }> =
      await prisma.historiqueStatut.findMany({
        where:  { ...campusFilter, statut_apres: { in: ['integre', 'ouvrier'] as const } } as any,
        select: { created_at: true, contact: { select: { date_inscription: true } } },
      });

    if (transitions.length === 0) {
      res.json({ moyenne_jours: 0, median_jours: 0, min_jours: 0, max_jours: 0 });
      return;
    }

    const durations = transitions
      .map(t => Math.round(
        (new Date(t.created_at).getTime() - new Date(t.contact.date_inscription).getTime()) / 86400000
      ))
      .filter(d => d >= 0)
      .sort((a, b) => a - b);

    if (durations.length === 0) {
      res.json({ moyenne_jours: 0, median_jours: 0, min_jours: 0, max_jours: 0 });
      return;
    }

    res.json({
      moyenne_jours: Math.round(durations.reduce((s, d) => s + d, 0) / durations.length),
      median_jours:  durations[Math.floor(durations.length / 2)],
      min_jours:     durations[0],
      max_jours:     durations[durations.length - 1],
    });
  } catch (err) {
    console.error('[stats.tempsIntegration]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── GET /api/stats/performance-referents ───────────────────────────────────
// Métriques par référent intégration : contacts total, intégrés, actifs,
// taux de conversion, temps moyen d'intégration.
// Stratégie 3 requêtes pour éviter N+1 : contacts + historique + agrégation JS.
export async function performanceReferents(req: Request, res: Response): Promise<void> {
  try {
    const campusFilter: Record<string, unknown> = {};
    if (req.user!.role !== 'super_admin') campusFilter.campus = { in: req.user!.campus };

    const contacts = await prisma.contact.findMany({
      where:  { referent_integration_id: { not: null }, ...campusFilter },
      select: {
        id:                      true,
        statut:                  true,
        date_inscription:        true,
        referent_integration_id: true,
        referent_integration:    { select: { id: true, prenom: true, nom: true } },
      },
    });

    if (contacts.length === 0) { res.json([]); return; }

    const transitions = await prisma.historiqueStatut.findMany({
      where:  { contact_id: { in: contacts.map(c => c.id) }, statut_apres: { in: ['integre', 'ouvrier'] as const } },
      select: { contact_id: true, created_at: true },
    });

    const firstTransition = new Map<string, Date>();
    for (const t of transitions) {
      if (!firstTransition.has(t.contact_id)) firstTransition.set(t.contact_id, new Date(t.created_at));
    }

    const byRef = new Map<string, { prenom: string; nom: string; items: typeof contacts }>();
    for (const c of contacts) {
      const rid = c.referent_integration_id!;
      if (!byRef.has(rid)) byRef.set(rid, { prenom: c.referent_integration!.prenom, nom: c.referent_integration!.nom, items: [] });
      byRef.get(rid)!.items.push(c);
    }

    const result = Array.from(byRef.entries()).map(([id, { prenom, nom, items }]) => {
      const total    = items.length;
      const integres = items.filter(c => c.statut === 'integre' || c.statut === 'ouvrier').length;
      const actifs   = items.filter(c => c.statut !== 'inactif').length;
      const durations = items
        .filter(c => firstTransition.has(c.id))
        .map(c => Math.round((firstTransition.get(c.id)!.getTime() - new Date(c.date_inscription).getTime()) / 86400000))
        .filter(d => d >= 0);
      return {
        id, prenom, nom,
        contacts_total:    total,
        contacts_integres: integres,
        contacts_actifs:   actifs,
        taux_conversion:   total > 0 ? Math.round((integres / total) * 100) : 0,
        temps_moyen_jours: durations.length > 0 ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : 0,
      };
    });

    result.sort((a, b) => b.contacts_total - a.contacts_total);
    res.json(result);
  } catch (err) {
    console.error('[stats.performanceReferents]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── GET /api/stats/evolution-hebdomadaire?semaines=12 ──────────────────────
// Évolution sur N semaines : nouveaux contacts, intégrés, messages envoyés.
export async function evolutionHebdomadaire(req: Request, res: Response): Promise<void> {
  try {
    const n = Math.min(Math.max(Number(req.query.semaines) || 12, 1), 52);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - n * 7);
    startDate.setHours(0, 0, 0, 0);

    const campusFilter: Record<string, unknown> = {};
    const relFilter:    Record<string, unknown> = {};
    if (req.user!.role !== 'super_admin') {
      campusFilter.campus = { in: req.user!.campus };
      relFilter.contact   = { campus: { in: req.user!.campus as string[] } };
    }

    const [contacts, transitions, messages] = await Promise.all([
      prisma.contact.findMany({
        where:  { date_inscription: { gte: startDate }, ...campusFilter } as any,
        select: { date_inscription: true },
      }),
      prisma.historiqueStatut.findMany({
        where:  { created_at: { gte: startDate }, statut_apres: { in: ['integre', 'ouvrier'] as const }, ...relFilter } as any,
        select: { created_at: true },
      }),
      prisma.message.findMany({
        where:  { statut: 'envoye', envoye_le: { gte: startDate }, ...relFilter } as any,
        select: { envoye_le: true },
      }),
    ]);

    const grN: Record<string, number> = {};
    const grI: Record<string, number> = {};
    const grM: Record<string, number> = {};
    for (const c of contacts) { const k = weekKey(new Date(c.date_inscription)); grN[k] = (grN[k] ?? 0) + 1; }
    for (const t of transitions) { const k = weekKey(new Date(t.created_at)); grI[k] = (grI[k] ?? 0) + 1; }
    for (const m of messages) { if (!m.envoye_le) continue; const k = weekKey(new Date(m.envoye_le)); grM[k] = (grM[k] ?? 0) + 1; }

    const now = new Date();
    const result = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const k = weekKey(d);
      result.push({ semaine: `S${isoWeek(d)}`, nouveaux: grN[k] ?? 0, integres: grI[k] ?? 0, messages: grM[k] ?? 0 });
    }
    res.json(result);
  } catch (err) {
    console.error('[stats.evolutionHebdomadaire]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── POST /api/stats/rapport-hebdomadaire ───────────────────────────────────
// Envoie manuellement le rapport hebdomadaire à tous les admins du campus.
export async function envoyerRapportHebdomadaire(req: Request, res: Response): Promise<void> {
  try {
    const campusFilter: Record<string, unknown> = {};
    const relFilter:    Record<string, unknown> = {};
    if (req.user!.role !== 'super_admin') {
      campusFilter.campus  = { in: req.user!.campus };
      relFilter.contact    = { campus: { in: req.user!.campus as string[] } };
    }

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [nouveaux, totalIntegres, messagesCount, ouvriersActifs] = await Promise.all([
      prisma.contact.count({ where: { date_inscription: { gte: oneWeekAgo }, ...campusFilter } }),
      prisma.contact.count({ where: { statut: { in: ['integre', 'ouvrier'] as const }, ...campusFilter } }),
      prisma.message.count({ where: { statut: 'envoye', envoye_le: { gte: oneWeekAgo }, ...relFilter } }),
      prisma.ouvrier.count({ where: { statut: true, ...campusFilter } }),
    ]);

    const admins = await prisma.user.findMany({
      where: {
        actif: true,
        role:  { in: ['super_admin', 'admin_campus'] },
        ...(req.user!.role !== 'super_admin' ? { campus: { hasSome: req.user!.campus } } as any : {}),
      },
      select: { id: true, prenom: true, email: true },
    });

    const stats = {
      nouveaux_contacts: nouveaux,
      total_integres:    totalIntegres,
      messages_envoyes:  messagesCount,
      ouvriers_actifs:   ouvriersActifs,
    };

    await Promise.all(
      admins.map(admin =>
        sendRapportHebdomadaire(admin.email, admin.prenom, stats)
          .catch(err => console.error('[stats.rapport] Email failed:', err))
      )
    );

    res.json({ message: `Rapport envoyé à ${admins.length} administrateur(s)`, destinataires: admins.length });
  } catch (err) {
    console.error('[stats.envoyerRapportHebdomadaire]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}
