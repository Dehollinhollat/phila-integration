// src/controllers/evenements.controller.ts
// Gestion des événements et de la planification des envois groupés WhatsApp.
// Les variables [Prénom], [Date], [Campus], [Adresse] sont substituées par destinataire
// à l'envoi immédiat (envoyerEvenement) comme à l'envoi planifié (cron.ts, Tâche 2).
//
// Périmètre : le campus d'un événement est un attribut stocké, et `null` signifie
// « tous les campus ». Un admin_campus ne peut donc agir que sur un événement dont le
// campus est explicitement dans son périmètre — un événement multi-campus lui est refusé.

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { sendWhatsApp } from '../lib/twilio';
import { buildDestinataireWhere, buildFiltresWhere } from './messages.controller';
import { getCampusSettingsForMany } from '../lib/campusSettings';
import { horsPerimetreCampus, resoudreCampusCible } from '../lib/authorization';

// GET /api/evenements
export async function listEvenements(req: Request, res: Response): Promise<void> {
  const { statut, campus } = req.query;
  const callerCampus = req.user!.campus;
  const callerRole = req.user!.role;

  const where: Record<string, unknown> = {};
  if (statut) where.statut = statut;

  if (callerRole !== 'super_admin') {
    where.OR = [{ campus: { in: callerCampus } }, { campus: null }];
  } else if (campus) {
    where.campus = campus;
  }

  const evenements = await prisma.evenement.findMany({
    where,
    orderBy: { date_evenement: 'desc' },
    include: {
      createur: { select: { id: true, prenom: true, nom: true } },
      _count: { select: { messages: true } },
    },
  });

  res.json(evenements);
}

// GET /api/evenements/:id
export async function getEvenement(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;

  // Les messages inclus exposent le nom des contacts. Sur un événement multi-campus,
  // un non-super_admin ne doit voir que ceux de son propre périmètre — sinon la fiche
  // détaillée fuiterait des noms que la liste des événements, elle, ne montre pas.
  const estSuperAdmin = req.user!.role === 'super_admin';

  const evenement = await prisma.evenement.findUnique({
    where: { id },
    include: {
      createur: { select: { id: true, prenom: true, nom: true } },
      messages: {
        take: 20,
        orderBy: { created_at: 'desc' },
        where: estSuperAdmin ? undefined : { contact: { campus: { in: req.user!.campus as never[] } } },
        include: { contact: { select: { id: true, prenom: true, nom: true } } },
      },
    },
  });

  if (!evenement) {
    res.status(404).json({ message: 'Événement introuvable' });
    return;
  }

  // En lecture, on autorise les événements multi-campus (campus null) comme le fait
  // déjà listEvenements — seul un événement rattaché à un AUTRE campus est masqué.
  if (evenement.campus !== null && horsPerimetreCampus(req.user!, evenement.campus)) {
    res.status(403).json({ message: 'Événement hors de votre périmètre' });
    return;
  }

  res.json(evenement);
}

// POST /api/evenements
export async function createEvenement(req: Request, res: Response): Promise<void> {
  const { titre, description, campus, date_evenement, message_template, destinataires } = req.body;

  if (!titre || !date_evenement || !message_template || !destinataires) {
    res.status(400).json({ message: 'Champs obligatoires manquants' });
    return;
  }

  const cible = resoudreCampusCible(req.user!, campus);
  if (!cible.ok) {
    res.status(403).json({ message: cible.message });
    return;
  }

  const evenement = await prisma.evenement.create({
    data: {
      titre, description, campus: cible.campus as never,
      date_evenement: new Date(date_evenement),
      message_template, destinataires,
      created_by: req.user!.id,
    },
  });

  res.status(201).json(evenement);
}

// POST /api/evenements/:id/envoyer — déclenche l'envoi immédiat
export async function envoyerEvenement(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string;

  const ev = await prisma.evenement.findUnique({ where: { id } });
  if (!ev) {
    res.status(404).json({ message: 'Événement introuvable' });
    return;
  }
  if (horsPerimetreCampus(req.user!, ev.campus)) {
    res.status(403).json({ message: 'Événement hors de votre périmètre' });
    return;
  }
  if (ev.statut === 'envoye') {
    res.status(400).json({ message: 'Événement déjà envoyé' });
    return;
  }

  const now = new Date();

  const filtresJson = (ev as Record<string, unknown>).filtres_json as string | null | undefined;
  let contactWhere: Record<string, unknown>;
  if (filtresJson) {
    try { contactWhere = buildFiltresWhere(JSON.parse(filtresJson)); }
    catch { contactWhere = buildDestinataireWhere(ev.destinataires as string, ev.campus as string | null); }
  } else {
    contactWhere = buildDestinataireWhere(ev.destinataires as string, ev.campus as string | null);
  }

  // Le campus de l'événement borne TOUJOURS les destinataires, quelle que soit l'origine
  // du filtre. Le contrôle de périmètre plus haut n'autorise que « qui peut déclencher
  // l'envoi » ; sans cette ligne, un filtres_json fourni par le client (ou un champ
  // destinataires ciblant un autre campus) diffuserait malgré tout hors périmètre.
  // Appliqué ici plutôt qu'à la création : cela protège aussi les événements déjà en base.
  if (ev.campus) contactWhere.campus = ev.campus;

  const contacts = await prisma.contact.findMany({
    where: contactWhere,
    select: { id: true, prenom: true, nom: true, telephone: true, campus: true },
  });

  if (contacts.length === 0) {
    const updated = await prisma.evenement.update({
      where: { id },
      data: { statut: 'envoye', envoye_le: now },
      include: { createur: { select: { id: true, prenom: true, nom: true } }, _count: { select: { messages: true } } },
    });
    res.json({ evenement: updated, sent: 0, failed: 0, total: 0 });
    return;
  }

  const dateStr = ev.date_evenement.toLocaleDateString('fr-FR');

  // Charge l'adresse de CHAQUE campus présent dans le lot en un seul aller-retour DB —
  // un événement peut cibler plusieurs campus à la fois (ev.campus null / filtres multi-campus),
  // donc chaque contact doit recevoir l'adresse de SON propre campus, jamais une valeur unique.
  const settingsByCampus = await getCampusSettingsForMany(
    contacts.map(c => c.campus),
    ['adresse_eglise'],
  );

  const results = await Promise.all(
    contacts.map(async (contact) => {
      const s = settingsByCampus.get(contact.campus)!;
      const contenu = ev.message_template
        .replace(/\[Date\]/g, dateStr)
        .replace(/\[Campus\]/g, ev.campus ?? contact.campus ?? 'Phila')
        .replace(/\[Prénom\]/g, contact.prenom)
        .replace(/\[prenom\]/gi, contact.prenom)
        .replace(/\[Adresse\]/g, s.adresse_eglise);

      const { sid, error } = await sendWhatsApp(contact.telephone, contenu);
      return { id: contact.id, sid, error };
    }),
  );

  await prisma.message.createMany({
    data: results.map(r => ({
      contact_id:   r.id,
      evenement_id: id,
      type:         'evenement',
      contenu:      ev.message_template,
      statut:       r.error ? 'echoue' : 'envoye',
      twilio_sid:   r.sid ?? null,
      envoye_le:    r.error ? null : now,
      created_by:   req.user!.id,
    })),
  });

  const updated = await prisma.evenement.update({
    where: { id },
    data: { statut: 'envoye', envoye_le: now },
    include: { createur: { select: { id: true, prenom: true, nom: true } }, _count: { select: { messages: true } } },
  });

  const failed = results.filter(r => r.error).length;
  res.json({ evenement: updated, sent: results.length - failed, failed, total: results.length });
}

// PATCH /api/evenements/:id
export async function updateEvenement(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;

  const evenement = await prisma.evenement.findUnique({ where: { id } });
  if (!evenement) {
    res.status(404).json({ message: 'Événement introuvable' });
    return;
  }
  if (horsPerimetreCampus(req.user!, evenement.campus)) {
    res.status(403).json({ message: 'Événement hors de votre périmètre' });
    return;
  }
  if (evenement.statut === 'envoye') {
    res.status(400).json({ message: 'Impossible de modifier un événement déjà envoyé' });
    return;
  }

  const body = req.body as Record<string, unknown>;

  // Un déplacement vers un autre campus doit rester dans le périmètre de l'appelant,
  // sans quoi il suffirait de créer l'événement sur son campus puis de le réaffecter.
  if ('campus' in body && horsPerimetreCampus(req.user!, body.campus as string | null)) {
    res.status(403).json({ message: 'Campus de destination hors de votre périmètre' });
    return;
  }

  // Liste blanche explicite. Un `{ ...req.body }` laisserait réécrire filtres_json,
  // destinataires, statut ou envoye_le — c'est-à-dire redéfinir QUI reçoit le message,
  // ou masquer un envoi déjà effectué, en contournant tous les contrôles ci-dessus.
  const data: Record<string, unknown> = {};
  if (typeof body.titre === 'string')            data.titre            = body.titre;
  if (typeof body.description === 'string')      data.description      = body.description;
  if (typeof body.message_template === 'string') data.message_template = body.message_template;
  if ('campus' in body)                          data.campus           = body.campus;
  if (body.date_evenement)                       data.date_evenement   = new Date(body.date_evenement as string);
  if (body.planifie_le)                          data.planifie_le      = new Date(body.planifie_le as string);

  const updated = await prisma.evenement.update({ where: { id }, data });
  res.json(updated);
}

// DELETE /api/evenements/:id
export async function deleteEvenement(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;

  const evenement = await prisma.evenement.findUnique({ where: { id } });
  if (!evenement) {
    res.status(404).json({ message: 'Événement introuvable' });
    return;
  }
  if (horsPerimetreCampus(req.user!, evenement.campus)) {
    res.status(403).json({ message: 'Événement hors de votre périmètre' });
    return;
  }
  if (evenement.statut === 'envoye') {
    res.status(400).json({ message: 'Impossible de supprimer un événement déjà envoyé' });
    return;
  }

  await prisma.evenement.delete({ where: { id } });
  res.json({ message: 'Événement supprimé' });
}

// POST /api/evenements/:id/planifier
export async function planifierEvenement(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { planifie_le } = req.body as { planifie_le: string };

  if (!planifie_le) {
    res.status(400).json({ message: 'La date d\'envoi planifiée est requise' });
    return;
  }

  const sendAt = new Date(planifie_le);
  if (sendAt <= new Date()) {
    res.status(400).json({ message: 'La date d\'envoi doit être dans le futur' });
    return;
  }

  const evenement = await prisma.evenement.findUnique({ where: { id } });
  if (!evenement) {
    res.status(404).json({ message: 'Événement introuvable' });
    return;
  }
  if (horsPerimetreCampus(req.user!, evenement.campus)) {
    res.status(403).json({ message: 'Événement hors de votre périmètre' });
    return;
  }
  if (evenement.statut === 'envoye') {
    res.status(400).json({ message: 'Événement déjà envoyé' });
    return;
  }

  const updated = await prisma.evenement.update({
    where: { id },
    data: { statut: 'planifie', planifie_le: sendAt },
  });

  res.json(updated);
}
