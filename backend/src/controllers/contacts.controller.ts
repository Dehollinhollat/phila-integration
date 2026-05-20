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
import { cache, withCache } from '../lib/cache';
import { logAudit } from '../lib/audit';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Calcule le profil pastoral depuis statut_phila et autre_eglise.
 * Appelé à la création et à chaque mise à jour de ces deux champs.
 */
export function determinerProfil(
  statut_phila: string | undefined,
  autre_eglise: boolean | null | undefined,
): 'membre_phila' | 'visiteur_sans_eglise' | 'visiteur_avec_eglise' {
  if (statut_phila === 'oui') return 'membre_phila';
  return autre_eglise === true ? 'visiteur_avec_eglise' : 'visiteur_sans_eglise';
}

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

// ─── Routes publiques (sans authentification) ────────────────────────────────

// GET /api/contacts/check-phone?phone=XXX[&excludeId=YYY] — vérifie si un numéro existe déjà
export async function checkPhone(req: Request, res: Response): Promise<void> {
  const phone     = String(req.query.phone     ?? '').trim();
  const excludeId = String(req.query.excludeId ?? '').trim();
  if (!phone) {
    res.status(400).json({ message: 'Numéro de téléphone requis' });
    return;
  }
  const contact = await prisma.contact.findFirst({
    where: {
      telephone: phone,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  res.json({ exists: !!contact, id: contact?.id ?? null });
}

// ─── Contacts CRUD ──────────────────────────────────────────────────────────

// GET /api/contacts
export async function listContacts(req: Request, res: Response): Promise<void> {
  const { campus, profil, statut, canal, search, page = '1', limit = '50' } = req.query;

  const extra: Record<string, unknown> = {};
  if (campus) extra.campus = campus;
  if (profil) extra.profil = profil;
  if (statut) extra.statut = statut;
  if (canal) extra.canal = canal;
  if (search) {
    extra.OR = [
      { prenom: { contains: search as string, mode: 'insensitive' } },
      { nom: { contains: search as string, mode: 'insensitive' } },
      { telephone: { contains: search as string } },
    ];
  }

  const { role, id: userId, campus: userCampus } = req.user!;
  const cacheKey = `contacts:list:${role}:${userId}:${JSON.stringify({ campus, profil, statut, canal, search, page, limit })}`;

  const result = await withCache(cacheKey, 300, async () => {
    const where = buildContactWhere(req, extra);
    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
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

    return { contacts: items, total, page: Number(page), limit: Number(limit) };
  });

  res.json(result);
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

const ETAPES_INTEGRATION = [
  'message_bienvenue_envoye',
  'premier_appel_effectue',
  'inscription_cellule',
  'journee_integration',
  'cours_antioche_valides',
  'service_departement',
  'integration_confirmee',
] as const;

// POST /api/contacts — route publique (formulaire présentiel et admin)
export async function createContact(req: Request, res: Response): Promise<void> {
  console.log('[createContact] body recu:', JSON.stringify(req.body, null, 2));
  const b = req.body;

  // Honeypot : si le champ "website" est rempli, c'est un bot — on feint le succès
  if (b.website) {
    res.status(200).json({ id: 'honeypot' });
    return;
  }

  try {
    // Vérification unicité téléphone
    const existing = await prisma.contact.findUnique({ where: { telephone: b.telephone } });
    if (existing) {
      res.status(409).json({ message: 'Un contact avec ce numéro existe déjà', id: existing.id });
      return;
    }

    // Champs obligatoires — vérification manuelle pour un message d'erreur clair
    const required = ['genre', 'prenom', 'nom', 'telephone', 'ville', 'etat_civil', 'statut_phila', 'canal'];
    const missing = required.filter(f => !b[f]);
    if (missing.length) {
      res.status(400).json({ message: `Champs obligatoires manquants : ${missing.join(', ')}` });
      return;
    }

    // Validation format E.164 — doit commencer par + suivi de 7 à 15 chiffres
    if (!/^\+[1-9]\d{6,14}$/.test(b.telephone)) {
      res.status(400).json({ message: 'Numéro de téléphone invalide (format attendu : +33612345678)', field: 'telephone' });
      return;
    }

    // Profil calculé depuis statut_phila + autre_eglise
    const profil = determinerProfil(b.statut_phila, b.autre_eglise);

    // Construction explicite du data — évite de passer des champs inconnus à Prisma
    // et garantit que date_consentement est un Date (Prisma 7 n'accepte pas les strings ISO)
    const data: Record<string, unknown> = {
      genre:            b.genre,
      prenom:           b.prenom,
      nom:              b.nom,
      telephone:        b.telephone,
      ville:            b.ville,
      etat_civil:       b.etat_civil,
      statut_phila:     b.statut_phila,
      profil,
      campus:           b.campus          ?? 'paris',
      canal:            b.canal,
      saisi_par_membre: b.saisi_par_membre ?? false,
      rdv_pasteur:      b.rdv_pasteur      ?? false,
      consentement_rgpd: b.consentement_rgpd ?? true,
      date_consentement: b.date_consentement
        ? new Date(b.date_consentement as string)
        : new Date(),
      // Champs optionnels — inclus seulement si présents
      ...(b.email             !== undefined && { email:             b.email }),
      ...(b.date_naissance    !== undefined && { date_naissance:    b.date_naissance ? new Date(b.date_naissance as string) : null }),
      ...(b.code_postal       !== undefined && { code_postal:       b.code_postal }),
      ...(b.extension_phila   !== undefined && { extension_phila:   b.extension_phila }),
      ...(b.interet_cellule   !== undefined && { interet_cellule:   b.interet_cellule }),
      ...(b.comment_connu     !== undefined && { comment_connu:     b.comment_connu }),
      ...(b.souhait           !== undefined && { souhait:           b.souhait }),
      ...(b.besoins           !== undefined && { besoins:           b.besoins }),
      ...(b.autre_eglise      !== undefined && { autre_eglise:      b.autre_eglise }),
      ...(b.nom_autre_eglise  !== undefined && { nom_autre_eglise:  b.nom_autre_eglise }),
      ...(b.sert_autre_eglise !== undefined && { sert_autre_eglise: b.sert_autre_eglise }),
      ...(b.service_autre_eglise !== undefined && { service_autre_eglise: b.service_autre_eglise }),
      ...(b.disponibilite_suivi !== undefined && { disponibilite_suivi: b.disponibilite_suivi }),
      ...(b.don               !== undefined && { don:               b.don }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contact = await prisma.contact.create({ data: data as any });

    // Génère les 7 étapes de checklist d'intégration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.checklistItem.createMany({
      data: ETAPES_INTEGRATION.map((etape) => ({ contact_id: contact.id, etape: etape as any, complete: false })),
    });

    if (req.user) {
      await logAudit({
        entite: 'contact', entite_id: contact.id,
        action: 'creation',
        description: `Contact ${contact.prenom} ${contact.nom} créé via formulaire ${contact.canal}`,
        auteur_id: req.user.id,
      });
    }

    cache.flushAll(); // invalide les caches de liste après création
    res.status(201).json(contact);
  } catch (error) {
    console.error('[createContact] erreur:', error);
    res.status(500).json({
      message: 'Erreur lors de la création du contact',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

// PATCH /api/contacts/:id
export async function updateContact(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const where = buildContactWhere(req, { id });

  const exists = await prisma.contact.findFirst({ where });
  if (!exists) {
    res.status(404).json({ message: 'Contact introuvable ou accès refusé' });
    return;
  }

  // Recalcule le profil si statut_phila ou autre_eglise change (sauf si admin force profil)
  const data = { ...req.body };
  if ((data.statut_phila || data.autre_eglise !== undefined) && !data.profil) {
    const statut     = data.statut_phila     ?? exists.statut_phila;
    const autreEgl   = data.autre_eglise     !== undefined ? data.autre_eglise : exists.autre_eglise;
    data.profil = determinerProfil(statut, autreEgl);
  }

  const contact = await prisma.contact.update({ where: { id }, data });
  cache.flushAll();
  res.json(contact);
}

// PUT /api/contacts/:id — mise à jour complète (admin_campus+), telephone modifiable avec vérification doublon
export async function updateContactFull(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const where = buildContactWhere(req, { id });

  const exists = await prisma.contact.findFirst({ where });
  if (!exists) {
    res.status(404).json({ message: 'Contact introuvable ou accès refusé' });
    return;
  }

  const { telephone, id: _i, created_at: _c, updated_at: _u, ...rest } = req.body;

  // Si le téléphone change, vérifier l'unicité
  if (telephone && telephone !== exists.telephone) {
    const doublon = await prisma.contact.findFirst({
      where: { telephone, NOT: { id } },
      select: { id: true },
    });
    if (doublon) {
      res.status(409).json({ message: 'Ce numéro est déjà utilisé par un autre contact' });
      return;
    }
  }

  const data = {
    ...rest,
    ...(telephone ? { telephone } : {}),
  };
  if (data.date_naissance !== undefined) {
    data.date_naissance = data.date_naissance ? new Date(data.date_naissance as string) : null;
  }
  if ((data.statut_phila || data.autre_eglise !== undefined) && !data.profil) {
    const statut   = data.statut_phila ?? exists.statut_phila;
    const autreEgl = data.autre_eglise !== undefined ? data.autre_eglise : exists.autre_eglise;
    data.profil = determinerProfil(statut, autreEgl);
  }

  const contact = await prisma.contact.update({ where: { id }, data });
  cache.flushAll();
  res.json(contact);
}

// DELETE /api/contacts/:id — suppression avec cascade (admin+ uniquement)
export async function deleteContact(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const exists = await prisma.contact.findUnique({ where: { id } });
  if (!exists) {
    res.status(404).json({ message: 'Contact introuvable' });
    return;
  }

  // Supprime les enregistrements liés avant le contact (évite les violations FK)
  await prisma.$transaction(async (tx) => {
    await tx.message.deleteMany({ where: { contact_id: id } });
    await tx.commentaire.deleteMany({ where: { contact_id: id } });
    await tx.checklistItem.deleteMany({ where: { contact_id: id } });
    await tx.historiqueStatut.deleteMany({ where: { contact_id: id } });
    await tx.contact.delete({ where: { id } });
  });

  cache.flushAll();
  res.json({ message: 'Contact supprimé' });
}

// ─── Checklist (via contact) ─────────────────────────────────────────────────

// PATCH /api/contacts/:id/checklist — coche/décoche une étape par nom (etape + complete)
export async function patchChecklist(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const { etape, complete, commentaire } = req.body as {
    etape: string; complete: boolean; commentaire?: string;
  };

  const contact = await prisma.contact.findFirst({ where: buildContactWhere(req, { id }) });
  if (!contact) {
    res.status(404).json({ message: 'Contact introuvable ou accès refusé' });
    return;
  }

  const item = await prisma.checklistItem.findUnique({
    where: { contact_id_etape: { contact_id: id, etape: etape as any } },
  });
  if (!item) {
    res.status(404).json({ message: 'Étape introuvable' });
    return;
  }

  const data: Record<string, unknown> = { complete, commentaire: commentaire ?? item.commentaire };
  if (complete) {
    data.complete_par_id = req.user!.id;
    data.complete_le = new Date();
  } else {
    data.complete_par_id = null;
    data.complete_le = null;
  }

  const updated = await prisma.checklistItem.update({
    where: { id: item.id },
    data,
    include: { complete_par: { select: { id: true, prenom: true, nom: true } } },
  });

  if (complete) {
    await logAudit({
      entite: 'contact', entite_id: id,
      action: 'checklist_cochee',
      champ: 'etape',
      nouvelle_valeur: etape,
      description: `Étape cochée : ${etape.replace(/_/g, ' ')}`,
      auteur_id: req.user!.id,
    });
  }

  if (complete && etape === 'integration_confirmee') {
    const superAdmins = await prisma.user.findMany({
      where: { role: 'super_admin', actif: true },
      select: { id: true },
    });
    await prisma.$transaction([
      prisma.contact.update({ where: { id }, data: { statut: 'integre' } }),
      prisma.historiqueStatut.create({
        data: {
          contact_id: id,
          statut_avant: contact.statut,
          statut_apres: 'integre',
          change_par_id: req.user!.id,
          commentaire: "Checklist d'intégration complétée",
        },
      }),
      ...superAdmins.map((admin) =>
        prisma.notification.create({
          data: {
            user_id: admin.id,
            type: 'checklist_completee',
            titre: 'Intégration confirmée',
            message: `${contact.prenom} ${contact.nom} a complété toutes les étapes d'intégration.`,
            lien: `/contacts/${id}`,
          },
        })
      ),
    ]);
  }

  res.json(updated);
}

// ─── Référents (via contact) ──────────────────────────────────────────────────

// PATCH /api/contacts/:id/referents — assigne/retire référent intégration et/ou église
export async function patchReferents(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const { referent_integration_id, referent_eglise_id } = req.body as {
    referent_integration_id?: string | null;
    referent_eglise_id?: string | null;
  };

  const contact = await prisma.contact.findFirst({ where: buildContactWhere(req, { id }) });
  if (!contact) {
    res.status(404).json({ message: 'Contact introuvable ou accès refusé' });
    return;
  }

  const data: Record<string, unknown> = {};
  if (referent_integration_id !== undefined) {
    data.referent_integration_id = referent_integration_id;
    if (referent_integration_id && !contact.date_attribution_referent) {
      data.date_attribution_referent = new Date();
    }
  }
  if (referent_eglise_id !== undefined) {
    data.referent_eglise_id = referent_eglise_id;
  }

  const updated = await prisma.contact.update({
    where: { id },
    data,
    include: {
      referent_integration: { select: { id: true, prenom: true, nom: true, email: true } },
      referent_eglise:      { select: { id: true, prenom: true, nom: true, email: true } },
    },
  });

  // Notification au nouveau référent intégration s'il change
  if (
    referent_integration_id &&
    referent_integration_id !== contact.referent_integration_id
  ) {
    await prisma.notification.create({
      data: {
        user_id: referent_integration_id,
        type: 'nouveau_contact_assigne',
        titre: 'Nouveau contact assigné',
        message: `${contact.prenom} ${contact.nom} vous a été assigné pour le suivi d'intégration.`,
        lien: `/contacts/${id}`,
      },
    });
  }

  if (referent_integration_id !== undefined) {
    const refNom = updated.referent_integration
      ? `${updated.referent_integration.prenom} ${updated.referent_integration.nom}`
      : 'aucun';
    await logAudit({
      entite: 'contact', entite_id: id,
      action: 'assignation_referent',
      champ: 'referent_integration_id',
      ancienne_valeur: contact.referent_integration_id ?? undefined,
      nouvelle_valeur: referent_integration_id ?? undefined,
      description: `Référent intégration assigné : ${refNom}`,
      auteur_id: req.user!.id,
    });
  }

  res.json(updated);
}

// ─── Checklist init ──────────────────────────────────────────────────────────

// POST /api/contacts/:id/checklist/init
// Génère les étapes manquantes pour les contacts créés avant la génération automatique.
// Idempotent : ne recrée pas les étapes déjà existantes.
export async function initChecklist(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);

  const contact = await prisma.contact.findFirst({ where: buildContactWhere(req, { id }) });
  if (!contact) {
    res.status(404).json({ message: 'Contact introuvable ou accès refusé' });
    return;
  }

  const existing = await prisma.checklistItem.findMany({
    where: { contact_id: id },
    select: { etape: true },
  });

  const existingEtapes = existing.map((e) => e.etape as string);
  const missing = ETAPES_INTEGRATION.filter((e) => !existingEtapes.includes(e));

  if (missing.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.checklistItem.createMany({
      data: missing.map((etape) => ({ contact_id: id, etape: etape as any, complete: false })),
    });
  }

  const items = await prisma.checklistItem.findMany({
    where: { contact_id: id },
    include: { complete_par: { select: { id: true, prenom: true, nom: true } } },
    orderBy: { created_at: 'asc' },
  });

  res.status(missing.length > 0 ? 201 : 200).json({ created: missing.length, items });
}

// ─── Statut ─────────────────────────────────────────────────────────────────

// PATCH /api/contacts/:id/statut
export async function updateStatut(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { statut, commentaire } = req.body as { statut: string; commentaire?: string };

  const contact = await prisma.contact.findFirst({ where: buildContactWhere(req, { id }) });
  if (!contact) {
    res.status(404).json({ message: 'Contact introuvable ou accès refusé' });
    return;
  }

  const [updated] = await prisma.$transaction([
    prisma.contact.update({ where: { id }, data: { statut: statut as any } }),
    prisma.historiqueStatut.create({
      data: {
        contact_id: id,
        statut_avant: contact.statut,
        statut_apres: statut as any,
        change_par_id: req.user!.id,
        commentaire,
      },
    }),
  ]);

  await logAudit({
    entite: 'contact', entite_id: id,
    action: 'changement_statut',
    champ: 'statut',
    ancienne_valeur: contact.statut,
    nouvelle_valeur: statut,
    description: `Statut changé : ${contact.statut} → ${statut}`,
    auteur_id: req.user!.id,
  });

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
  const id = req.params.id as string;
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
  const id = req.params.id as string;

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

// ─── Compteur filtré ─────────────────────────────────────────────────────────

// GET /api/contacts/count — nombre de contacts correspondant aux filtres de ciblage messagerie.
// Utilisé par MessageCompose pour afficher le compteur temps réel (debounce 500ms).
// Le rôle de l'appelant restreint toujours le périmètre (campus, contacts assignés, etc.).
export async function countContacts(req: Request, res: Response): Promise<void> {
  try {
    const {
      campus, profil, statut, besoin_spirituel,
      interet_cellule, canal, date_debut, date_fin, rdv_pasteur,
    } = req.query;

    const extra: Record<string, unknown> = {};

    if (campus           && typeof campus           === 'string') extra.campus          = campus;
    if (profil           && typeof profil           === 'string') extra.profil          = profil;
    if (statut           && typeof statut           === 'string') extra.statut          = statut;
    if (interet_cellule  && typeof interet_cellule  === 'string') extra.interet_cellule = interet_cellule;
    if (canal            && typeof canal            === 'string') extra.canal           = canal;
    if (rdv_pasteur === 'true')                                    extra.rdv_pasteur     = true;

    // Filtre sur un besoin spirituel (champ BesoinSpirituel[] — tableau Postgres)
    if (besoin_spirituel && typeof besoin_spirituel === 'string') {
      extra.besoins = { has: besoin_spirituel };
    }

    // Plage de dates d'inscription
    if (date_debut || date_fin) {
      const dateFilter: Record<string, Date> = {};
      if (date_debut && typeof date_debut === 'string') dateFilter.gte = new Date(date_debut);
      if (date_fin   && typeof date_fin   === 'string') {
        const end = new Date(date_fin);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      extra.date_inscription = dateFilter;
    }

    const where = buildContactWhere(req, extra);
    const count = await prisma.contact.count({ where });
    res.json({ count });
  } catch (err) {
    console.error('[countContacts]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
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

// ─── Export CSV ──────────────────────────────────────────────────────────────

// GET /api/contacts/export?campus=paris&periode=month
export async function exportContacts(req: Request, res: Response): Promise<void> {
  const { campus, periode } = req.query;

  const extra: Record<string, unknown> = {};
  if (campus && campus !== 'all') extra.campus = campus;
  if (periode === 'month') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    extra.date_inscription = { gte: cutoff };
  } else if (periode === '3months') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    extra.date_inscription = { gte: cutoff };
  }

  const where = buildContactWhere(req, extra);

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { date_inscription: 'desc' },
    select: {
      prenom:            true,
      nom:               true,
      telephone:         true,
      email:             true,
      profil:            true,
      statut:            true,
      canal:             true,
      campus:            true,
      referent_integration: { select: { prenom: true, nom: true } },
      date_inscription:  true,
    },
  });

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const header = [
    'Prénom', 'Nom', 'Téléphone', 'Email', 'Profil', 'Statut',
    'Canal', 'Campus', 'Référent Intégration', 'Date Inscription',
  ].map(escape).join(',');

  const rows = contacts.map(c => [
    c.prenom,
    c.nom,
    c.telephone,
    c.email ?? '',
    c.profil,
    c.statut,
    c.canal,
    c.campus,
    c.referent_integration
      ? `${c.referent_integration.prenom} ${c.referent_integration.nom}`
      : '',
    new Date(c.date_inscription).toLocaleDateString('fr-FR'),
  ].map(escape).join(',')).join('\n');

  const filename = `contacts_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // BOM UTF-8 pour compatibilité Excel
  res.send('﻿' + header + '\n' + rows);
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

// GET /api/contacts/:id/audit — 50 derniers logs du plus récent au plus ancien
export async function getAuditLog(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const contactExists = await prisma.contact.findFirst({ where: buildContactWhere(req, { id }) });
  if (!contactExists) {
    res.status(404).json({ message: 'Contact introuvable ou accès refusé' });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = await (prisma.auditLog as any).findMany({
    where:   { entite: 'contact', entite_id: id },
    include: { auteur: { select: { id: true, prenom: true, nom: true, role: true } } },
    orderBy: { created_at: 'desc' },
    take:    50,
  });

  res.json(logs);
}
