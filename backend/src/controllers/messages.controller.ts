// src/controllers/messages.controller.ts
// Gestion des messages WhatsApp via Twilio.
// Le message de bienvenue est normalement déclenché par le cron (src/lib/cron.ts) à J+3.
// Ce contrôleur permet aussi un envoi manuel, la création d'événements groupés,
// et reçoit les mises à jour de statut Twilio (webhook).

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { sendWhatsApp, sendWhatsAppBulk } from '../lib/twilio';

// ─── Types ────────────────────────────────────────────────────────────────────

// Filtres de ciblage avancé — partagés avec cron.ts et le frontend.
// Chaque champ est optionnel ; les champs absents ne filtrent pas.
export interface FiltresDestinataires {
  campus?:           string;  // 'paris' | 'paris_nord'
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
    case 'tous':
    default:
      return campus ? { campus } : {};
  }
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

    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) {
      res.status(404).json({ message: 'Contact introuvable' });
      return;
    }

    if (!contact.referent_integration_id) {
      res.status(400).json({ message: 'Aucun référent intégration assigné — message impossible' });
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

    // Charge le template et les settings de l'église
    const [settingTemplate, settingTelEglise, settingAdresse] = await Promise.all([
      prisma.settings.findUnique({ where: { key: 'message_bienvenue' } }),
      prisma.settings.findUnique({ where: { key: 'telephone_eglise' } }),
      prisma.settings.findUnique({ where: { key: 'adresse_eglise' } }),
    ]);

    const contenu = buildBienvenueMessage(
      contact.prenom,
      referent,
      settingTelEglise?.value ?? '',
      settingTemplate?.value  ?? undefined,
      settingAdresse?.value   ?? '',
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
        campus:        filtres.campus ? (filtres.campus as any) : null,  // dénormalisé pour rétrocompat
        date_evenement: new Date(date_evenement),
        planifie_le:   planifie_le ? new Date(planifie_le) : null,
        statut,
        filtres_json:  Object.keys(filtres).length > 0 ? JSON.stringify(filtres) : null,
        created_by:    req.user!.id,
        envoye_le:     envoyer_maintenant ? now : null,
      },
    });

    if (envoyer_maintenant) {
      const dateStr       = new Date(date_evenement).toLocaleDateString('fr-FR');
      const adresseEglise = (await prisma.settings.findUnique({ where: { key: 'adresse_eglise' } }))?.value ?? '';
      const msgText = message_template
        .replace(/\[Date\]/g,    dateStr)
        .replace(/\[Campus\]/g,  filtres.campus ?? filtres_ouvriers.campus ?? 'Phila')
        .replace(/\[Adresse\]/g, adresseEglise);

      // ── Envoi aux contacts ────────────────────────────────────────────────
      if (dest_type === 'contacts' || dest_type === 'tous') {
        const contacts = await prisma.contact.findMany({
          where:  buildFiltresWhere(filtres),
          select: { id: true, prenom: true, telephone: true },
        });

        if (contacts.length > 0) {
          const results = await sendWhatsAppBulk(contacts, msgText);
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
        const ouvrierWhere: Record<string, unknown> = { statut: true };
        if (filtres_ouvriers.campus) ouvrierWhere.campus = filtres_ouvriers.campus;
        if (filtres_ouvriers.service) ouvrierWhere.services = { hasSome: [filtres_ouvriers.service] };

        const ouvriers = await prisma.ouvrier.findMany({
          where:  ouvrierWhere,
          select: { id: true, prenom: true, telephone: true },
        });

        if (ouvriers.length > 0) {
          const results = await sendWhatsAppBulk(ouvriers, msgText);
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
export async function twilioWebhook(req: Request, res: Response): Promise<void> {
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

// Template par défaut utilisé si la clé 'message_bienvenue' n'est pas encore configurée en BDD.
export const DEFAULT_BIENVENUE_TEMPLATE =
  `Bonjour [Prenom], en espérant que votre semaine se passe très bien par la grâce de Dieu. ` +
  `L'église Phila Cité des Adorateurs est ravie de vous compter parmi ses fidèles ! ` +
  `Je suis [Referent], votre référent d'intégration. ` +
  `N'hésitez pas à me contacter au [Telephone_Referent]. ` +
  `Vous pouvez aussi joindre l'église au [Telephone_Eglise]. ` +
  `Nous allons prier pour vous. Avez-vous des sujets particuliers de prière ?`;

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
): string {
  return applyVariables(templateOverride ?? DEFAULT_BIENVENUE_TEMPLATE, {
    prenom,
    referentNom:       referent ? `${referent.prenom} ${referent.nom}` : '',
    referentTelephone: referent?.telephone ?? '',
    telephoneEglise:   telephoneEglise ?? '',
    adresseEglise:     adresseEglise   ?? '',
  });
}
