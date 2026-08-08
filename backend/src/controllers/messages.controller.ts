// src/controllers/messages.controller.ts
// Gestion des messages WhatsApp via Twilio.
// Le message de bienvenue est normalement déclenché par le cron (src/lib/cron.ts) à J+3.
// Ce contrôleur permet aussi un envoi manuel, la création d'événements groupés,
// et reçoit les mises à jour de statut Twilio (webhook).

import { Request, Response } from 'express';
import twilio from 'twilio';
import prisma from '../lib/prisma';
import { sendWhatsApp } from '../lib/twilio';
import { DEFAULT_BIENVENUE_TEMPLATE, getCampusSettingsWithDefaults, getCampusSettingsForMany } from '../lib/campusSettings';
import { peutAccederContact, resoudreCampusCible } from '../lib/authorization';

// ─── Types ────────────────────────────────────────────────────────────────────

// Filtres de ciblage avancé — partagés avec cron.ts et le frontend.
// Chaque champ est optionnel ; les champs absents ne filtrent pas.
export interface FiltresDestinataires {
  campus?:           string;  // 'paris' | 'paris_nord' | 'orleans' | 'montpellier'
  profil?:           string;  // 'membre_phila' | 'visiteur_sans_eglise' | 'visiteur_avec_eglise'
  statut?:           string;  // StatutContact enum value
  besoin_spirituel?: string;  // BesoinSpirituel enum value (tableau has)
  interet_cellule?:  string;  // InteretCellule enum value
  canal?:            string;  // 'presentiel' | 'en_ligne'
  date_debut?:       string;  // ISO date string YYYY-MM-DD
  date_fin?:         string;  // ISO date string YYYY-MM-DD (inclus jusqu'à 23:59:59)
  rdv_pasteur?:      boolean; // true = uniquement ceux qui souhaitent un RDV pasteur
}

// ─── Helpers partagés (utilisés aussi par cron.ts) ───────────────────────────

// Construit un filtre Prisma depuis un objet FiltresDestinataires.
// Remplace buildDestinataireWhere pour les événements créés avec le nouveau système de filtres.
export function buildFiltresWhere(filtres: FiltresDestinataires): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (filtres.campus)           where.campus          = filtres.campus;
  if (filtres.profil)           where.profil          = filtres.profil;
  if (filtres.statut)           where.statut          = filtres.statut;
  if (filtres.canal)            where.canal           = filtres.canal;
  if (filtres.interet_cellule)  where.interet_cellule = filtres.interet_cellule;
  if (filtres.rdv_pasteur)      where.rdv_pasteur     = true;

  if (filtres.besoin_spirituel) {
    where.besoins = { has: filtres.besoin_spirituel };
  }

  if (filtres.date_debut || filtres.date_fin) {
    const dateFilter: Record<string, Date> = {};
    if (filtres.date_debut) dateFilter.gte = new Date(filtres.date_debut);
    if (filtres.date_fin) {
      const end = new Date(filtres.date_fin);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    where.date_inscription = dateFilter;
  }

  return where;
}

// Conservé pour la compatibilité avec les événements planifiés avant le nouveau système.
export function buildDestinataireWhere(
  destinataires: string,
  campus: string | null
): Record<string, unknown> {
  switch (destinataires) {
    case 'profil_membre_phila':   return { profil: 'membre_phila' };
    case 'profil_visiteur':       return { profil: { in: ['visiteur_sans_eglise', 'visiteur_avec_eglise'] } };
    case 'campus_paris':          return { campus: 'paris' };
    case 'campus_paris_nord':     return { campus: 'paris_nord' };
    case 'campus_orleans':        return { campus: 'orleans' };
    case 'campus_montpellier':    return { campus: 'montpellier' };
    case 'tous':
    default:
      return campus ? { campus } : {};
  }
}

// Construit le filtre where Prisma pour l'audience ouvriers d'un événement —
// partagé avec createEvenement, envoyerEvenement (evenements.controller.ts) et
// cron.ts (Tâche 2), qui doivent tous les trois pouvoir cibler les ouvriers.
export function buildOuvrierWhere(filtres: { campus?: string; service?: string }): Record<string, unknown> {
  const where: Record<string, unknown> = { statut: true };
  if (filtres.campus)  where.campus   = filtres.campus;
  if (filtres.service) where.services = { hasSome: [filtres.service] };
  return where;
}

// GET /api/messages
export async function listMessages(req: Request, res: Response): Promise<void> {
  try {
    const callerCampus = req.user!.campus;
    const callerRole   = req.user!.role;

    // req.query values are string | string[] | ParsedQs | ParsedQs[] — take first string only
    const type    = typeof req.query.type    === 'string' ? req.query.type    : undefined;
    const statut  = typeof req.query.statut  === 'string' ? req.query.statut  : undefined;
    const campus  = typeof req.query.campus  === 'string' ? req.query.campus  : undefined;
    const periode = typeof req.query.periode === 'string' ? req.query.periode : undefined;
    const page    = typeof req.query.page    === 'string' ? req.query.page    : '1';
    const limit   = typeof req.query.limit   === 'string' ? req.query.limit   : '50';

    const where: Record<string, unknown> = {};
    if (type)   where.type   = type;
    if (statut) where.statut = statut;

    // Filtre période
    if (periode === 'ce_mois') {
      const debut = new Date();
      debut.setDate(1);
      debut.setHours(0, 0, 0, 0);
      where.created_at = { gte: debut };
    } else if (periode === 'ce_trimestre') {
      const now = new Date();
      const moisTrimestre = Math.floor(now.getMonth() / 3) * 3;
      const debut = new Date(now.getFullYear(), moisTrimestre, 1, 0, 0, 0, 0);
      where.created_at = { gte: debut };
    }

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
        take:    Number(limit),
        orderBy: { created_at: 'desc' },
        include: {
          contact: { select: { id: true, prenom: true, nom: true, telephone: true } },
        },
      }),
      prisma.message.count({ where }),
    ]);

    res.json({ messages, total });
  } catch (err) {
    console.error('[listMessages]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// GET /api/messages/:id
export async function getMessage(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);

    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        contact: { select: { id: true, prenom: true, nom: true, telephone: true } },
      },
    });

    if (!message) {
      res.status(404).json({ message: 'Message introuvable' });
      return;
    }

    // Le message expose le contact lié (nom, téléphone) : même périmètre que le contact.
    // Les messages sans contact (envois ouvriers) restent réservés au super_admin.
    if (req.user!.role !== 'super_admin') {
      const autorise = message.contact_id
        ? await peutAccederContact(req.user!, message.contact_id)
        : false;
      if (!autorise) {
        res.status(403).json({ message: 'Message hors de votre périmètre' });
        return;
      }
    }

    res.json(message);
  } catch (err) {
    console.error('[getMessage]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// GET /api/messages/contact/:contactId
export async function getMessagesByContact(req: Request, res: Response): Promise<void> {
  try {
    const contactId = String(req.params.contactId);

    // Historique complet des échanges d'un contact : même périmètre que le contact.
    const autorise = await peutAccederContact(req.user!, contactId);
    if (!autorise) {
      res.status(403).json({ message: 'Contact hors de votre périmètre' });
      return;
    }

    const messages = await prisma.message.findMany({
      where:   { contact_id: contactId },
      orderBy: { created_at: 'desc' },
    });

    res.json(messages);
  } catch (err) {
    console.error('[getMessagesByContact]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// POST /api/messages/bienvenue/:contactId — envoi manuel
export async function sendBienvenue(req: Request, res: Response): Promise<void> {
  try {
    const contactId = String(req.params.contactId);

    // Même contrôle de périmètre que les 7 autres endpoints de la ressource Contact
    // (voir contacts.controller.ts) — sans quoi n'importe quel contact serait joignable.
    const autorise = await peutAccederContact(req.user!, contactId);
    if (!autorise) {
      res.status(403).json({ message: 'Contact hors de votre périmètre' });
      return;
    }

    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) {
      res.status(404).json({ message: 'Contact introuvable' });
      return;
    }

    if (!contact.referent_integration_id) {
      res.status(400).json({ message: 'Aucun référent intégration assigné, message impossible' });
      return;
    }

    // Charge le référent séparément pour éviter la complexité des types Prisma avec include
    const referent = await prisma.user.findUnique({
      where:  { id: contact.referent_integration_id },
      select: { prenom: true, nom: true, telephone: true },
    });

    // Vérifie qu'un message de bienvenue n'a pas déjà été envoyé
    const existing = await prisma.message.findFirst({
      where: { contact_id: contactId, type: 'bienvenue', statut: { in: ['envoye', 'en_attente'] } },
    });
    if (existing) {
      res.status(409).json({ message: 'Un message de bienvenue existe déjà pour ce contact' });
      return;
    }

    // Charge les réglages du campus de CE contact (pas une valeur globale)
    const s = await getCampusSettingsWithDefaults(contact.campus, ['message_bienvenue', 'telephone_eglise', 'adresse_eglise']);

    const contenu = buildBienvenueMessage(
      contact.prenom,
      referent,
      s.telephone_eglise,
      s.message_bienvenue,
      s.adresse_eglise,
      contact.campus,
    );

    const { sid, error } = await sendWhatsApp(contact.telephone, contenu);

    const message = await prisma.message.create({
      data: {
        contact_id: contactId,
        type:       'bienvenue',
        contenu,
        statut:     error ? 'echoue' : 'envoye',
        twilio_sid: sid ?? null,
        envoye_le:  error ? null : new Date(),
        created_by: req.user!.id,
      },
    });

    if (!error) {
      await prisma.contact.update({
        where: { id: contactId },
        data:  { derniere_interaction: new Date() },
      });
    }

    res.status(201).json({ message, error: error ?? null });
  } catch (err) {
    console.error('[sendBienvenue]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// POST /api/messages/evenement
// Corps attendu :
//   { titre, message_template, date_evenement, planifie_le?, envoyer_maintenant?,
//     dest_type?: 'contacts'|'ouvriers'|'tous', filtres?: FiltresDestinataires,
//     filtres_ouvriers?: { campus?: string; service?: string } }
export async function createEvenement(req: Request, res: Response): Promise<void> {
  try {
    const {
      titre,
      message_template,
      date_evenement,
      planifie_le,
      envoyer_maintenant,
      dest_type = 'contacts',
      filtres = {},
      filtres_ouvriers = {},
    } = req.body as {
      titre:               string;
      message_template:    string;
      date_evenement:      string;
      planifie_le?:        string;
      envoyer_maintenant?: boolean;
      dest_type?:          'contacts' | 'ouvriers' | 'tous';
      filtres?:            FiltresDestinataires;
      filtres_ouvriers?:   { campus?: string; service?: string };
    };

    if (!titre || !message_template || !date_evenement) {
      res.status(400).json({
        message: 'Champs requis manquants : titre, message_template, date_evenement',
      });
      return;
    }

    // Le ciblage est contraint au périmètre de l'appelant, séparément pour chaque
    // audience — sans quoi un admin_campus pourrait diffuser à tous les campus en
    // laissant simplement le filtre campus vide.
    const cibleContacts = resoudreCampusCible(req.user!, filtres.campus);
    if (!cibleContacts.ok) {
      res.status(403).json({ message: cibleContacts.message });
      return;
    }
    const cibleOuvriers = resoudreCampusCible(req.user!, filtres_ouvriers.campus);
    if (!cibleOuvriers.ok) {
      res.status(403).json({ message: cibleOuvriers.message });
      return;
    }

    let statut: 'brouillon' | 'planifie' | 'envoye' = 'brouillon';
    if (envoyer_maintenant) statut = 'envoye';
    else if (planifie_le)   statut = 'planifie';

    const now = new Date();

    const evenement = await prisma.evenement.create({
      data: {
        titre,
        message_template,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        destinataires: 'tous' as any,                                    // sentinel — les vrais filtres sont dans filtres_json
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        campus:        cibleContacts.campus as any,  // dénormalisé pour rétrocompat, contraint au périmètre
        date_evenement: new Date(date_evenement),
        planifie_le:   planifie_le ? new Date(planifie_le) : null,
        statut,
        // On persiste les filtres DÉJÀ bornés au périmètre : filtres_json est relu tel quel
        // à l'envoi différé (cron), il ne doit donc jamais contenir un ciblage plus large
        // que ce que l'appelant avait le droit de viser.
        filtres_json:  Object.keys(filtres).length > 0
          ? JSON.stringify({ ...filtres, ...(cibleContacts.campus ? { campus: cibleContacts.campus } : {}) })
          : null,
        // dest_type et filtres_ouvriers doivent être persistés pour que l'envoi différé
        // (cron.ts Tâche 2) et le renvoi manuel (envoyerEvenement) sachent viser les
        // ouvriers — avant ce champ, ces valeurs n'existaient qu'en mémoire le temps de
        // cette requête HTTP et un événement dest_type='ouvriers'/'tous' planifié ne
        // touchait jamais les ouvriers. Même principe de bornage que filtres_json.
        dest_type:         dest_type,
        filtres_ouvriers:  (dest_type === 'ouvriers' || dest_type === 'tous')
          ? JSON.stringify({ ...filtres_ouvriers, ...(cibleOuvriers.campus ? { campus: cibleOuvriers.campus } : {}) })
          : null,
        created_by:    req.user!.id,
        envoye_le:     envoyer_maintenant ? now : null,
      },
    });

    if (envoyer_maintenant) {
      const dateStr = new Date(date_evenement).toLocaleDateString('fr-FR');

      // ── Envoi aux contacts ────────────────────────────────────────────────
      if (dest_type === 'contacts' || dest_type === 'tous') {
        const contacts = await prisma.contact.findMany({
          // Le campus résolu est appliqué en dernier : il prime sur celui du corps de requête.
          where:  {
            ...buildFiltresWhere(filtres),
            ...(cibleContacts.campus ? { campus: cibleContacts.campus as never } : {}),
          },
          select: { id: true, prenom: true, telephone: true, campus: true },
        });

        if (contacts.length > 0) {
          // Charge l'adresse de CHAQUE campus présent dans le lot en un seul aller-retour DB —
          // un seul groupe (contacts) peut lui-même couvrir plusieurs campus dès que
          // filtres.campus n'est pas précisé (filtre optionnel), donc chaque contact doit
          // recevoir l'adresse de SON propre campus, jamais une valeur unique pour tout le groupe.
          const settingsByCampus = await getCampusSettingsForMany(
            contacts.map((c) => c.campus),
            ['adresse_eglise'],
          );

          const results = await Promise.all(
            contacts.map(async (c) => {
              const s = settingsByCampus.get(c.campus)!;
              const contenu = message_template
                .replace(/\[Date\]/g,    dateStr)
                .replace(/\[Campus\]/g,  cibleContacts.campus ?? c.campus ?? 'Phila')
                .replace(/\[Prénom\]/g,  c.prenom)
                .replace(/\[prenom\]/gi, c.prenom)
                .replace(/\[Adresse\]/g, s.adresse_eglise);

              const { sid, error } = await sendWhatsApp(c.telephone, contenu);
              return { id: c.id, sid, error };
            }),
          );

          await prisma.message.createMany({
            data: results.map((r) => ({
              contact_id:   r.id,
              evenement_id: evenement.id,
              type:         'evenement' as const,
              contenu:      message_template,
              statut:       r.error ? ('echoue' as const) : ('envoye' as const),
              twilio_sid:   r.sid ?? null,
              envoye_le:    r.error ? null : now,
              created_by:   req.user!.id,
            })),
          });
          const failed = results.filter((r) => r.error).length;
          console.log(`[createEvenement] contacts — ${results.length - failed}/${results.length} envois réussis`);
        }
      }

      // ── Envoi aux ouvriers ────────────────────────────────────────────────
      if (dest_type === 'ouvriers' || dest_type === 'tous') {
        const ouvrierWhere = buildOuvrierWhere({ ...filtres_ouvriers, campus: cibleOuvriers.campus ?? undefined });

        const ouvriers = await prisma.ouvrier.findMany({
          where:  ouvrierWhere,
          select: { id: true, prenom: true, telephone: true, campus: true },
        });

        if (ouvriers.length > 0) {
          // Même logique que pour les contacts (voir commentaire ci-dessus) : un seul
          // groupe (ouvriers) peut lui-même couvrir plusieurs campus dès que
          // filtres_ouvriers.campus n'est pas précisé.
          const settingsByCampus = await getCampusSettingsForMany(
            ouvriers.map((o) => o.campus),
            ['adresse_eglise'],
          );

          const results = await Promise.all(
            ouvriers.map(async (o) => {
              const s = settingsByCampus.get(o.campus)!;
              const contenu = message_template
                .replace(/\[Date\]/g,    dateStr)
                .replace(/\[Campus\]/g,  cibleOuvriers.campus ?? o.campus ?? 'Phila')
                .replace(/\[Prénom\]/g,  o.prenom)
                .replace(/\[prenom\]/gi, o.prenom)
                .replace(/\[Adresse\]/g, s.adresse_eglise);

              const { sid, error } = await sendWhatsApp(o.telephone, contenu);
              return { id: o.id, sid, error };
            }),
          );

          await prisma.message.createMany({
            data: results.map((r) => ({
              contact_id:   null,
              evenement_id: evenement.id,
              type:         'evenement' as const,
              contenu:      message_template,
              statut:       r.error ? ('echoue' as const) : ('envoye' as const),
              twilio_sid:   r.sid ?? null,
              envoye_le:    r.error ? null : now,
              created_by:   req.user!.id,
            })),
          });
          const failed = results.filter((r) => r.error).length;
          console.log(`[createEvenement] ouvriers — ${results.length - failed}/${results.length} envois réussis`);
        }
      }
    }

    res.status(201).json(evenement);
  } catch (err) {
    console.error('[createEvenement]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// POST /api/messages/webhook/twilio — mise à jour statut par Twilio
//
// Sécurité : route publique (pas de JWT — Twilio ne peut pas en fournir), donc
// vérification de la signature Twilio en production. Sans elle, n'importe qui
// connaissant un twilio_sid pouvait falsifier le statut de livraison d'un
// message (masquer un échec réel, ou l'inverse) — voir handleIncomingWhatsApp
// dans twilio.controller.ts, qui suit le même motif.
export async function twilioWebhook(req: Request, res: Response): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    const twilioSignature = req.headers['x-twilio-signature'] as string ?? '';
    const webhookUrl      = `${process.env.BACKEND_URL}/api/messages/webhook/twilio`;
    const isValid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN ?? '',
      twilioSignature,
      webhookUrl,
      req.body as Record<string, string>,
    );
    if (!isValid) {
      console.warn('[TWILIO_WEBHOOK] Signature invalide — requête rejetée');
      res.sendStatus(403);
      return;
    }
  }

  const { MessageSid, MessageStatus } = req.body as {
    MessageSid:    string;
    MessageStatus: string;
  };

  if (!MessageSid) {
    res.sendStatus(400);
    return;
  }

  const statut =
    MessageStatus === 'delivered' || MessageStatus === 'sent' ? 'envoye' : 'echoue';

  await prisma.message.updateMany({
    where: { twilio_sid: MessageSid },
    data: {
      statut,
      envoye_le: statut === 'envoye' ? new Date() : undefined,
    },
  });

  res.sendStatus(204);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Substitue toutes les variables [Variable] dans un template de message.
// Appelé par le cron (bienvenue J+3, anniversaire) et par les envois manuels.
export function applyVariables(
  template: string,
  vars: {
    prenom?:             string;
    referentNom?:        string;
    referentTelephone?:  string;
    telephoneEglise?:    string;
    adresseEglise?:      string;
    campus?:             string;
    date?:               string;
    theme?:              string;
  }
): string {
  return template
    .replace(/\[Prenom\]/gi,             vars.prenom            ?? '')
    .replace(/\[Referent\]/gi,           vars.referentNom       ?? '')
    .replace(/\[Telephone_Referent\]/gi, vars.referentTelephone ?? '')
    .replace(/\[Telephone_Eglise\]/gi,   vars.telephoneEglise   ?? '')
    .replace(/\[Adresse\]/gi,            vars.adresseEglise     ?? '')
    .replace(/\[Campus\]/gi,             vars.campus            ?? '')
    .replace(/\[Date\]/gi,               vars.date              ?? new Date().toLocaleDateString('fr-FR'))
    .replace(/\[Theme\]/gi,              vars.theme             ?? '')
    .replace(/\[Thème\]/gi,              vars.theme             ?? '');
}

// Conservé pour rétrocompatibilité — construit le message de bienvenue depuis un template.
export function buildBienvenueMessage(
  prenom: string,
  referent?: { prenom: string; nom: string; telephone?: string | null } | null,
  telephoneEglise?: string,
  templateOverride?: string,
  adresseEglise?: string,
  campus?: string,
): string {
  return applyVariables(templateOverride ?? DEFAULT_BIENVENUE_TEMPLATE, {
    prenom,
    referentNom:       referent ? `${referent.prenom} ${referent.nom}` : '',
    referentTelephone: referent?.telephone ?? '',
    telephoneEglise:   telephoneEglise ?? '',
    adresseEglise:     adresseEglise   ?? '',
    campus:            campus          ?? '',
  });
}
