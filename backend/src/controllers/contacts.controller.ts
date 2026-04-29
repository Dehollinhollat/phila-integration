// src/controllers/contacts.controller.ts
// Gestion complète des contacts — table centrale de l'application.
//
// Règles d'accès :
// - lecteur : lecture seule, pas de commentaires
// - referent_integration : voit uniquement ses contacts assignés + ses propres commentaires
// - referent_eglise : voit ses contacts + tous les commentaires (intégration + église)
// - admin_campus / super_admin : accès complet sur leur(s) campus

import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Construit le filtre where selon le rôle de l'appelant */
function buildContactWhere(req: Request, extra: Record<string, unknown> = {}) {
  const { role, id: userId, campus } = req.user!;
  const where: Record<string, unknown> = { ...extra };

  if (role === 'super_admin') return where;

  if (role === 'admin_campus') {
    where.campus = { in: campus };
    return where;
  }

  if (role === 'referent_eglise') {
    where.OR = [
      { referent_integration_id: userId },
      { referent_eglise_id: userId },
    ];
    return where;
  }

  if (role === 'referent_integration') {
    where.referent_integration_id = userId;
    return where;
  }

  // lecteur : voit tout en lecture (filtré par campus si campus renseigné)
  if (campus.length > 0) where.campus = { in: campus };
  return where;
}

// ─── Contacts CRUD ──────────────────────────────────────────────────────────

// GET /api/contacts
export async function listContacts(req: Request, res: Response): Promise<void> {
  const { campus, profil, statut, search, page = '1', limit = '50' } = req.query;

  const extra: Record<string, unknown> = {};
  if (campus) extra.campus = campus;
  if (profil) extra.profil = profil;
  if (statut) extra.statut = statut;
  if (search) {
    extra.OR = [
      { prenom: { contains: search as string, mode: 'insensitive' } },
      { nom: { contains: search as string, mode: 'insensitive' } },
      { telephone: { contains: search as string } },
    ];
  }

  const where = buildContactWhere(req, extra);
  const skip = (Number(page) - 1) * Number(limit);

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { date_inscription: 'desc' },
      select: {
        id: true, genre: true, prenom: true, nom: true,
        telephone: true, ville: true, profil: true, statut: true,
        campus: true, canal: true, date_inscription: true,
        referent_integration: { select: { id: true, prenom: true, nom: true } },
        referent_eglise: { select: { id: true, prenom: true, nom: true } },
        derniere_interaction: true,
      },
    }),
    prisma.contact.count({ where }),
  ]);

  res.json({ contacts, total, page: Number(page), limit: Number(limit) });
}

// GET /api/contacts/:id
export async function getContact(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const where = buildContactWhere(req, { id });

  const contact = await prisma.contact.findFirst({
    where,
    include: {
      referent_integration: { select: { id: true, prenom: true, nom: true, email: true } },
      referent_eglise: { select: { id: true, prenom: true, nom: true, email: true } },
      ouvrier: true,
    },
  });

  if (!contact) {
    res.status(404).json({ message: 'Contact introuvable ou accès refusé' });
    return;
  }

  res.json(contact);
}

// POST /api/contacts
export async function createContact(req: Request, res: Response): Promise<void> {
  const body = req.body;

  // Vérification unicité téléphone
  const existing = await prisma.contact.findUnique({ where: { telephone: body.telephone } });
  if (existing) {
    res.status(409).json({ message: 'Un contact avec ce numéro existe déjà', id: existing.id });
    return;
  }

  // Calcul automatique du profil selon statut_phila
  const profil = body.statut_phila === 'oui' ? 'A' : 'B';

  const contact = await prisma.contact.create({
    data: {
      ...body,
      profil,
      saisi_par_membre: body.saisi_par_membre ?? false,
      consentement_rgpd: body.consentement_rgpd ?? true,
    },
  });

  res.status(201).json(contact);
}

// PATCH /api/contacts/:id
export async function updateContact(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const where = buildContactWhere(req, { id });

  const exists = await prisma.contact.findFirst({ where });
  if (!exists) {
    res.status(404).json({ message: 'Contact introuvable ou accès refusé' });
    return;
  }

  // Si statut_phila change, recalcule le profil sauf si l'admin l'a déjà forcé
  const data = { ...req.body };
  if (data.statut_phila && !data.profil) {
    data.profil = data.statut_phila === 'oui' ? 'A' : 'B';
  }

  const contact = await prisma.contact.update({ where: { id }, data });
  res.json(contact);
}

// DELETE /api/contacts/:id — admin+ uniquement
export async function deleteContact(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const exists = await prisma.contact.findUnique({ where: { id } });
  if (!exists) {
    res.status(404).json({ message: 'Contact introuvable' });
    return;
  }
  await prisma.contact.delete({ where: { id } });
  res.json({ message: 'Contact supprimé' });
}

// ─── Statut ─────────────────────────────────────────────────────────────────

// PATCH /api/contacts/:id/statut
export async function updateStatut(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { statut, commentaire } = req.body as { statut: string; commentaire?: string };

  const contact = await prisma.contact.findFirst({ where: buildContactWhere(req, { id }) });
  if (!contact) {
    res.status(404).json({ message: 'Contact introuvable ou accès refusé' });
    return;
  }

  const [updated] = await prisma.$transaction([
    prisma.contact.update({ where: { id }, data: { statut } }),
    prisma.historiqueStatut.create({
      data: {
        contact_id: id,
        statut_avant: contact.statut,
        statut_apres: statut,
        change_par_id: req.user!.id,
        commentaire,
      },
    }),
  ]);

  res.json(updated);
}

// ─── Commentaires ────────────────────────────────────────────────────────────

// GET /api/contacts/:id/commentaires
export async function listCommentaires(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { role } = req.user!;

  const contactExists = await prisma.contact.findFirst({ where: buildContactWhere(req, { id }) });
  if (!contactExists) {
    res.status(404).json({ message: 'Contact introuvable ou accès refusé' });
    return;
  }

  // referent_integration ne voit que ses propres commentaires
  const whereCommentaire: Record<string, unknown> = { contact_id: id };
  if (role === 'referent_integration') {
    whereCommentaire.role_auteur = 'referent_integration';
  }
  // referent_eglise et au-dessus voient tout

  const commentaires = await prisma.commentaire.findMany({
    where: whereCommentaire,
    include: { auteur: { select: { id: true, prenom: true, nom: true, role: true } } },
    orderBy: { created_at: 'desc' },
  });

  res.json(commentaires);
}

// POST /api/contacts/:id/commentaires
export async function createCommentaire(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { contenu } = req.body as { contenu: string };

  if (!contenu?.trim()) {
    res.status(400).json({ message: 'Le contenu du commentaire est requis' });
    return;
  }

  const contactExists = await prisma.contact.findFirst({ where: buildContactWhere(req, { id }) });
  if (!contactExists) {
    res.status(404).json({ message: 'Contact introuvable ou accès refusé' });
    return;
  }

  const [commentaire] = await prisma.$transaction([
    prisma.commentaire.create({
      data: {
        contact_id: id,
        auteur_id: req.user!.id,
        role_auteur: req.user!.role,
        contenu,
      },
      include: { auteur: { select: { id: true, prenom: true, nom: true } } },
    }),
    // Met à jour derniere_interaction
    prisma.contact.update({
      where: { id },
      data: { derniere_interaction: new Date() },
    }),
  ]);

  res.status(201).json(commentaire);
}

// ─── Historique ──────────────────────────────────────────────────────────────

// GET /api/contacts/:id/historique
export async function getHistorique(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const contactExists = await prisma.contact.findFirst({ where: buildContactWhere(req, { id }) });
  if (!contactExists) {
    res.status(404).json({ message: 'Contact introuvable ou accès refusé' });
    return;
  }

  const historique = await prisma.historiqueStatut.findMany({
    where: { contact_id: id },
    include: { change_par: { select: { id: true, prenom: true, nom: true, role: true } } },
    orderBy: { created_at: 'desc' },
  });

  res.json(historique);
}

// ─── Dashboard Alerts ────────────────────────────────────────────────────────

// GET /api/contacts/alerts — contacts sans référent à J+2
export async function getDashboardAlerts(req: Request, res: Response): Promise<void> {
  const { campus } = req.user!;

  const j2 = new Date();
  j2.setDate(j2.getDate() - 2);

  const whereBase: Record<string, unknown> = {
    referent_integration_id: null,
    date_inscription: { lte: j2 },
    statut: 'nouveau',
  };

  if (req.user!.role !== 'super_admin') {
    whereBase.campus = { in: campus };
  }

  const contacts = await prisma.contact.findMany({
    where: whereBase,
    select: {
      id: true, prenom: true, nom: true, telephone: true,
      campus: true, date_inscription: true,
    },
    orderBy: { date_inscription: 'asc' },
  });

  res.json({
    message: `${contacts.length} contact(s) sans référent depuis 2 jours ou plus`,
    contacts,
  });
}
