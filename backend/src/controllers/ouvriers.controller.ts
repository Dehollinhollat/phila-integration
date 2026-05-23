// src/controllers/ouvriers.controller.ts
// Gestion des ouvriers — équipes de service de l'église.
//
// Deux modes de création :
//   inscription_directe: true  → ouvrier existant avant le lancement de l'app, pas de lien contact
//   inscription_directe: false → promotion d'un contact intégré ; met à jour son statut + crée HistoriqueStatut
//
// Accès :
//   - Lecture : tous rôles (filtrés par campus selon le rôle)
//   - Création / modification / toggle : admin_campus et super_admin uniquement

import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// ─── Liste ───────────────────────────────────────────────────────────────────

// GET /api/ouvriers?campus=&statut=&service=&search=
export async function listOuvriers(req: Request, res: Response): Promise<void> {
  try {
    const { campus, statut, service, search } = req.query;
    const callerCampus = req.user!.campus;
    const callerRole   = req.user!.role;

    const where: Record<string, unknown> = {};

    // Restriction campus selon le rôle
    if (callerRole !== 'super_admin') {
      where.campus = { in: callerCampus };
    } else if (campus && typeof campus === 'string') {
      where.campus = campus;
    }

    if (statut !== undefined && statut !== '') where.statut = statut === 'true';
    if (service && typeof service === 'string')  where.services = { hasSome: [service] };

    // Recherche textuelle sur nom, prénom ou téléphone
    if (search && typeof search === 'string') {
      where.OR = [
        { prenom:    { contains: search, mode: 'insensitive' } },
        { nom:       { contains: search, mode: 'insensitive' } },
        { telephone: { contains: search } },
      ];
    }

    const ouvriers = await prisma.ouvrier.findMany({
      where,
      orderBy: { nom: 'asc' },
      include: { contact: { select: { id: true, profil: true, statut: true } } },
    });

    res.json(ouvriers);
  } catch (err) {
    console.error('[listOuvriers]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── Compteur ────────────────────────────────────────────────────────────────

// GET /api/ouvriers/count?campus=&service=
export async function countOuvriers(req: Request, res: Response): Promise<void> {
  try {
    const { campus, service } = req.query;
    const callerCampus = req.user!.campus;
    const callerRole   = req.user!.role;

    const where: Record<string, unknown> = { statut: true }; // actifs uniquement

    if (callerRole !== 'super_admin') {
      where.campus = { in: callerCampus };
    } else if (campus && typeof campus === 'string') {
      where.campus = campus;
    }

    if (service && typeof service === 'string') {
      where.services = { hasSome: [service] };
    }

    const count = await prisma.ouvrier.count({ where });
    res.json({ count });
  } catch (err) {
    console.error('[countOuvriers]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── Détail ──────────────────────────────────────────────────────────────────

// GET /api/ouvriers/:id
export async function getOuvrier(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const ouvrier = await prisma.ouvrier.findUnique({
      where: { id },
      include: { contact: true },
    });
    if (!ouvrier) {
      res.status(404).json({ message: 'Ouvrier introuvable' });
      return;
    }
    res.json(ouvrier);
  } catch (err) {
    console.error('[getOuvrier]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── Création unifiée ────────────────────────────────────────────────────────

// POST /api/ouvriers
// Corps attendu :
//   { prenom, nom, telephone, email?, campus, services?, date_debut_service?, inscription_directe }
//   Si contact_id fourni → mode promotion : met à jour le statut du contact + crée un HistoriqueStatut
//   Si inscription_directe: true → création sans lien contact
export async function createOuvrier(req: Request, res: Response): Promise<void> {
  try {
    const {
      contact_id,
      prenom, nom, telephone, email,
      campus, services, date_debut_service, date_naissance,
    } = req.body as {
      contact_id?:          string;
      prenom:               string;
      nom:                  string;
      telephone:            string;
      email?:               string;
      campus:               string;
      services?:            string[];
      date_debut_service?:  string;
      date_naissance?:      string;
    };

    if (!prenom || !nom || !telephone || !campus) {
      res.status(400).json({ message: 'Champs obligatoires manquants : prenom, nom, telephone, campus' });
      return;
    }

    const dateDebut      = date_debut_service ? new Date(date_debut_service) : null;
    const dateNaissance  = date_naissance     ? new Date(date_naissance)     : null;

    // ── Mode promotion : contact_id fourni ──────────────────────────────────
    if (contact_id) {
      const contact = await prisma.contact.findUnique({ where: { id: contact_id } });
      if (!contact) {
        res.status(404).json({ message: 'Contact introuvable' });
        return;
      }

      const alreadyOuvrier = await prisma.ouvrier.findUnique({ where: { contact_id } });
      if (alreadyOuvrier) {
        res.status(409).json({ message: 'Ce contact est déjà ouvrier' });
        return;
      }

      const [ouvrier] = await prisma.$transaction([
        prisma.ouvrier.create({
          data: {
            contact_id,
            prenom:              contact.prenom,
            nom:                 contact.nom,
            telephone:           contact.telephone,
            email:               contact.email ?? undefined,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            campus:              contact.campus as any,
            services:            services ?? [],
            date_debut_service:  dateDebut,
            date_naissance:      dateNaissance,
            inscription_directe: false,
          },
        }),
        prisma.contact.update({
          where: { id: contact_id },
          data:  { statut: 'ouvrier' },
        }),
        prisma.historiqueStatut.create({
          data: {
            contact_id,
            statut_avant:  contact.statut,
            statut_apres:  'ouvrier',
            change_par_id: req.user!.id,
            commentaire:   'Promotion en ouvrier',
          },
        }),
      ]);

      res.status(201).json(ouvrier);
      return;
    }

    // ── Mode inscription directe ─────────────────────────────────────────────
    const ouvrier = await prisma.ouvrier.create({
      data: {
        prenom, nom, telephone,
        email: email ?? undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        campus:              campus as any,
        services:            services ?? [],
        date_debut_service:  dateDebut,
        date_naissance:      dateNaissance,
        inscription_directe: true,
      },
    });

    res.status(201).json(ouvrier);
  } catch (err) {
    console.error('[createOuvrier]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── Modification complète ───────────────────────────────────────────────────

// PUT /api/ouvriers/:id
export async function updateOuvrier(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const {
      prenom, nom, telephone, email,
      campus, services, date_debut_service, date_naissance,
    } = req.body as {
      prenom?:              string;
      nom?:                 string;
      telephone?:           string;
      email?:               string | null;
      campus?:              string;
      services?:            string[];
      date_debut_service?:  string | null;
      date_naissance?:      string | null;
    };

    const exists = await prisma.ouvrier.findUnique({ where: { id } });
    if (!exists) {
      res.status(404).json({ message: 'Ouvrier introuvable' });
      return;
    }

    const data: Record<string, unknown> = {};
    if (prenom             !== undefined) data.prenom            = prenom;
    if (nom                !== undefined) data.nom               = nom;
    if (telephone          !== undefined) data.telephone         = telephone;
    if (email              !== undefined) data.email             = email;
    if (campus             !== undefined) data.campus            = campus;
    if (services           !== undefined) data.services          = services;
    if (date_debut_service !== undefined) {
      data.date_debut_service = date_debut_service ? new Date(date_debut_service) : null;
    }
    if (date_naissance !== undefined) {
      data.date_naissance = date_naissance ? new Date(date_naissance) : null;
    }

    const ouvrier = await prisma.ouvrier.update({ where: { id }, data });
    res.json(ouvrier);
  } catch (err) {
    console.error('[updateOuvrier]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── Toggle actif / inactif ──────────────────────────────────────────────────

// PATCH /api/ouvriers/:id/statut
export async function toggleStatut(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const { statut } = req.body as { statut?: boolean };

    const ouvrier = await prisma.ouvrier.findUnique({ where: { id } });
    if (!ouvrier) {
      res.status(404).json({ message: 'Ouvrier introuvable' });
      return;
    }

    // Si statut fourni → forcer ; sinon toggle
    const nextStatut = statut !== undefined ? statut : !ouvrier.statut;
    const updated    = await prisma.ouvrier.update({ where: { id }, data: { statut: nextStatut } });
    res.json(updated);
  } catch (err) {
    console.error('[toggleStatut]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── Vérification doublon téléphone (publique) ───────────────────────────────

// GET /api/ouvriers/check-phone?phone=+33612345678
export async function checkOuvrierPhone(req: Request, res: Response): Promise<void> {
  try {
    const { phone } = req.query;
    if (!phone || typeof phone !== 'string') {
      res.status(400).json({ message: 'Paramètre phone manquant' });
      return;
    }
    const ouvrier = await prisma.ouvrier.findFirst({ where: { telephone: phone } });
    res.json({ exists: !!ouvrier });
  } catch (err) {
    console.error('[checkOuvrierPhone]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── Candidature publique ─────────────────────────────────────────────────────

// POST /api/ouvriers/candidature (route publique, sans auth)
// Corps attendu :
//   { genre, prenom, nom, telephone, email?, ville, code_postal?, campus,
//     disponibilites: string[], services: string[],
//     a_deja_servi: boolean, eglise_precedente?, service_precedent?, motivation?,
//     consentement_rgpd: true }
//
// Stockage :
//   - disponibilites → services[] avec préfixe "dispo:" (ex: "dispo:dimanche_matin")
//   - services souhaités → services[] sans préfixe
//   - motivation + expérience → champ notes (JSON)
export async function candidatureOuvrier(req: Request, res: Response): Promise<void> {
  // Honeypot : si le champ "website" est rempli, c'est un bot — on feint le succès
  if (req.body?.website) {
    res.status(200).json({ id: 'honeypot' });
    return;
  }

  console.log('Candidature reçue:', req.body);

  try {
    const {
      genre, prenom, nom, telephone, email,
      ville, code_postal, campus,
      disponibilites,
      services,
      a_deja_servi,
      eglise_precedente,
      service_precedent,
      motivation,
      consentement_rgpd,
    } = req.body as {
      genre?:              string;
      prenom:              string;
      nom:                 string;
      telephone:           string;
      email?:              string;
      ville?:              string;
      code_postal?:        string;
      campus:              string;
      disponibilites?:     string[];
      services?:           string[];
      a_deja_servi?:       boolean;
      eglise_precedente?:  string;
      service_precedent?:  string;
      motivation?:         string;
      consentement_rgpd:   boolean;
    };

    if (!prenom || !nom || !telephone || !campus) {
      res.status(400).json({ message: 'Champs obligatoires manquants : prenom, nom, telephone, campus' });
      return;
    }
    if (!consentement_rgpd) {
      res.status(400).json({ message: 'Le consentement RGPD est obligatoire.' });
      return;
    }

    // Validation format E.164
    if (!/^\+[1-9]\d{6,14}$/.test(telephone)) {
      res.status(400).json({ message: 'Numéro de téléphone invalide (format attendu : +33612345678)', field: 'telephone' });
      return;
    }

    // Vérification doublon téléphone
    const existing = await prisma.ouvrier.findFirst({ where: { telephone } });
    if (existing) {
      res.status(409).json({ message: 'Ce numéro de téléphone est déjà enregistré.' });
      return;
    }

    // Services : souhaités + disponibilités préfixées
    const allServices = [
      ...(Array.isArray(services) ? services : []),
      ...(Array.isArray(disponibilites) ? disponibilites.map(d => `dispo:${d}`) : []),
    ];

    // Métadonnées candidature en JSON
    const { date_naissance } = req.body;
    const notes = JSON.stringify({
      genre:              genre ?? null,
      ville:              ville ?? null,
      code_postal:        code_postal ?? null,
      date_naissance:     date_naissance ?? null,
      a_deja_servi:       !!a_deja_servi,
      eglise_precedente:  eglise_precedente ?? null,
      service_precedent:  service_precedent ?? null,
      motivation:         motivation ?? null,
    });

    const ouvrier = await prisma.ouvrier.create({
      data: {
        prenom,
        nom,
        telephone,
        email:               email || undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        campus:              campus as any,
        services:            allServices,
        statut:              false,   // en attente de validation
        inscription_directe: true,
        notes,
      },
    });

    // Notifications pour tous les super_admin et admin_campus actifs
    const admins = await prisma.user.findMany({
      where: { role: { in: ['super_admin', 'admin_campus'] }, actif: true },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a: { id: string }) => ({
          user_id: a.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type:    'nouvelle_candidature_ouvrier' as any,
          titre:   'Nouvelle candidature ouvrier',
          message: `${prenom} ${nom} a soumis une candidature pour le service (campus ${campus}).`,
          lue:     false,
        })),
      });
    }

    res.status(201).json(ouvrier);
  } catch (err) {
    console.error('[candidatureOuvrier]', err);
    res.status(500).json({ message: 'Erreur serveur', detail: (err as Error).message });
  }
}

// Conservé pour rétrocompat (anciens appels DELETE)
// PATCH /api/ouvriers/:id/statut avec statut: false est désormais préféré
export async function deactivateOuvrier(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params['id'] as string;
    await prisma.ouvrier.update({ where: { id }, data: { statut: false } });
    res.json({ message: 'Ouvrier désactivé' });
  } catch (err) {
    console.error('[deactivateOuvrier]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}
