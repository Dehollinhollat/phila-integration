// src/lib/cron.ts
// Tâches planifiées avec node-cron.
//
// Tâche 1 — Message de bienvenue J+3
//   Tous les jours à 09h00, cherche les contacts inscrits il y a exactement 3 jours
//   avec un référent intégration assigné et aucun message de bienvenue existant.
//   Le message est signé avec le prénom + nom du référent intégration.
//
// Tâche 2 — Envoi des événements planifiés
//   Toutes les minutes, cherche les événements au statut 'planifie' dont
//   planifie_le est <= maintenant et les envoie en masse via Twilio.
//
// Tâche 3 — Alertes contacts sans référent J+2
//   Tous les jours à 08h00, cherche les contacts inscrits il y a 2+ jours
//   sans référent intégration et crée des notifications pour les admin_campus et super_admin.

import cron from 'node-cron';
import prisma from './prisma';
import { sendWhatsApp, sendWhatsAppBulk } from './twilio';
import { applyVariables, DEFAULT_BIENVENUE_TEMPLATE, buildDestinataireWhere, buildFiltresWhere } from '../controllers/messages.controller';

export function startCronJobs(): void {
  // ── Tâche 1 : Messages de bienvenue J+3 (tous les jours à 09h00) ────────────
  cron.schedule('0 9 * * *', async () => {
    console.log('[Cron] Vérification messages bienvenue J+3...');

    const j3Start = new Date();
    j3Start.setDate(j3Start.getDate() - 3);
    j3Start.setHours(0, 0, 0, 0);

    const j3End = new Date(j3Start);
    j3End.setHours(23, 59, 59, 999);

    // Contacts inscrits à J-3, avec référent, sans message bienvenue existant
    const contacts = await prisma.contact.findMany({
      where: {
        date_inscription: { gte: j3Start, lte: j3End },
        referent_integration_id: { not: null },
        messages: {
          none: {
            type: 'bienvenue',
            statut: { in: ['envoye', 'en_attente'] },
          },
        },
      },
      include: {
        referent_integration: { select: { prenom: true, nom: true, telephone: true } },
      },
    });

    console.log(`[Cron] ${contacts.length} message(s) bienvenue à envoyer`);

    // Charge le template et le téléphone d'église une seule fois pour tous les contacts du batch
    const [settingTemplate, settingTelEglise] = await Promise.all([
      prisma.settings.findUnique({ where: { key: 'message_bienvenue' } }),
      prisma.settings.findUnique({ where: { key: 'telephone_eglise' } }),
    ]);
    const bienvenueTemplate = settingTemplate?.value ?? DEFAULT_BIENVENUE_TEMPLATE;
    const telephoneEglise   = settingTelEglise?.value ?? '';

    for (const contact of contacts) {
      const ref = contact.referent_integration;
      const contenu = applyVariables(bienvenueTemplate, {
        prenom:            contact.prenom,
        referentNom:       ref ? `${ref.prenom} ${ref.nom}` : '',
        referentTelephone: ref?.telephone ?? '',
        telephoneEglise,
      });
      const { sid, error } = await sendWhatsApp(contact.telephone, contenu);

      await prisma.message.create({
        data: {
          contact_id: contact.id,
          type: 'bienvenue',
          contenu,
          statut: error ? 'echoue' : 'envoye',
          twilio_sid: sid ?? null,
          envoye_le: error ? null : new Date(),
        },
      });

      if (!error) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { derniere_interaction: new Date() },
        });
      }

      if (error) {
        console.error(`[Cron] Échec bienvenue pour ${contact.id}: ${error}`);
      }
    }
  });

  // ── Tâche 2 : Envois groupés planifiés (toutes les minutes) ─────────────────
  cron.schedule('* * * * *', async () => {
    const now = new Date();

    const evenements = await prisma.evenement.findMany({
      where: {
        statut: 'planifie',
        planifie_le: { lte: now },
      },
    });

    if (evenements.length === 0) return;

    for (const ev of evenements) {
      console.log(`[Cron] Envoi événement: ${ev.titre}`);

      // Construit le filtre destinataires.
      // Les événements créés avec le nouveau système stockent leurs filtres dans filtres_json.
      // Les anciens événements (avant migration) utilisent le champ destinataires enum.
      const filtresJson = (ev as Record<string, unknown>).filtres_json as string | null | undefined;
      let contactWhere: Record<string, unknown>;
      if (filtresJson) {
        try {
          contactWhere = buildFiltresWhere(JSON.parse(filtresJson));
        } catch {
          contactWhere = buildDestinataireWhere(ev.destinataires as string, ev.campus as string | null);
        }
      } else {
        contactWhere = buildDestinataireWhere(ev.destinataires as string, ev.campus as string | null);
      }

      const contacts = await prisma.contact.findMany({
        where: contactWhere,
        select: { id: true, prenom: true, nom: true, telephone: true, campus: true },
      });

      if (contacts.length === 0) {
        await prisma.evenement.update({
          where: { id: ev.id },
          data: { statut: 'envoye', envoye_le: now },
        });
        continue;
      }

      const dateStr = ev.date_evenement.toLocaleDateString('fr-FR');
      const results = await sendWhatsAppBulk(
        contacts,
        ev.message_template
          .replace(/\[Date\]/g, dateStr)
          .replace(/\[Campus\]/g, ev.campus ?? 'Phila')
      );

      // Crée un Message par destinataire
      await prisma.message.createMany({
        data: results.map((r) => ({
          contact_id: r.id,
          evenement_id: ev.id,
          type: 'evenement',
          contenu: ev.message_template,
          statut: r.error ? 'echoue' : 'envoye',
          twilio_sid: r.sid ?? null,
          envoye_le: r.error ? null : now,
          created_by: ev.created_by,
        })),
      });

      await prisma.evenement.update({
        where: { id: ev.id },
        data: { statut: 'envoye', envoye_le: now },
      });

      const failed = results.filter((r) => r.error).length;
      console.log(
        `[Cron] Événement "${ev.titre}" — ${results.length - failed}/${results.length} envois réussis`
      );
    }
  });

  // ── Tâche 3 : Alertes contacts sans référent J+2 (tous les jours à 08h00) ───
  cron.schedule('0 8 * * *', async () => {
    console.log('[Cron] Vérification contacts sans référent J+2...');

    const j2 = new Date();
    j2.setDate(j2.getDate() - 2);

    const contactsSansReferent = await prisma.contact.findMany({
      where: {
        referent_integration_id: null,
        date_inscription: { lte: j2 },
        statut: 'nouveau',
      },
      select: { id: true, prenom: true, nom: true, campus: true },
    });

    if (contactsSansReferent.length === 0) return;

    console.log(`[Cron] ${contactsSansReferent.length} contact(s) sans référent depuis J+2`);

    // Récupère tous les admin_campus et super_admin à notifier
    const admins = await prisma.user.findMany({
      where: {
        actif: true,
        role: { in: ['super_admin', 'admin_campus'] },
      },
      select: { id: true, role: true, campus: true },
    });

    const now = new Date();

    for (const admin of admins) {
      // Filtre les contacts relevant du campus de cet admin (super_admin voit tout)
      const contactsConcernes = admin.role === 'super_admin'
        ? contactsSansReferent
        : contactsSansReferent.filter((c) => admin.campus.includes(c.campus));

      if (contactsConcernes.length === 0) continue;

      // Évite les doublons : vérifie s'il n'existe pas déjà une notification non lue du même type aujourd'hui
      const debutJour = new Date(now);
      debutJour.setHours(0, 0, 0, 0);

      const dejaNotifie = await prisma.notification.findFirst({
        where: {
          user_id: admin.id,
          type: 'contact_sans_referent',
          lue: false,
          created_at: { gte: debutJour },
        },
      });

      if (dejaNotifie) continue;

      await prisma.notification.create({
        data: {
          user_id: admin.id,
          type: 'contact_sans_referent',
          titre: 'Contacts sans référent',
          message: `${contactsConcernes.length} contact(s) n'ont pas de référent intégration depuis 2 jours ou plus.`,
          lien: '/contacts?statut=nouveau',
        },
      });
    }
  });

  // ── Tâche 4 : Rappels planning non confirmés (vendredi à 10h00) ─────────────
  cron.schedule('0 10 * * 5', async () => {
    console.log('[Cron] Rappels planning non confirmés...');

    // Dimanche prochain (depuis vendredi = +2 jours)
    const now = new Date();
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + ((7 - now.getDay()) % 7 || 7));
    nextSunday.setHours(0, 0, 0, 0);
    const sundayEnd = new Date(nextSunday);
    sundayEnd.setHours(23, 59, 59, 999);

    const pending = await prisma.affectationPlanning.findMany({
      where: {
        statut: 'en_attente',
        planning: { date_dimanche: { gte: nextSunday, lte: sundayEnd } },
      },
      include: {
        ouvrier: { select: { id: true, email: true, prenom: true, nom: true } },
        planning: { select: { id: true, date_dimanche: true, campus: true } },
      },
    });

    console.log(`[Cron] ${pending.length} affectation(s) en attente pour dimanche prochain`);

    // Regroupe par email d'ouvrier
    const byEmail = new Map<string, typeof pending>();
    for (const aff of pending) {
      if (!aff.ouvrier.email) continue;
      const e = aff.ouvrier.email;
      if (!byEmail.has(e)) byEmail.set(e, []);
      byEmail.get(e)!.push(aff);
    }

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    for (const [email, affs] of byEmail) {
      const user = await prisma.user.findFirst({ where: { email, actif: true } });
      if (!user) continue;

      const alreadyNotified = await prisma.notification.findFirst({
        where: { user_id: user.id, type: 'planning_non_confirme', created_at: { gte: todayStart } },
      });
      if (alreadyNotified) continue;

      const dateStr = new Date(affs[0].planning.date_dimanche).toLocaleDateString('fr-FR');

      await prisma.notification.create({
        data: {
          user_id: user.id,
          type: 'planning_non_confirme',
          titre: 'Confirmation de service requise',
          message: `Vous avez ${affs.length} affectation(s) en attente pour le dimanche ${dateStr}. Merci de confirmer votre présence.`,
          lien: '/mon-planning',
        },
      });
    }
  });

  // ── Initialisation : créer les settings par défaut s'ils n'existent pas ─────
  Promise.all([
    prisma.settings.upsert({
      where:  { key: 'template_anniversaire' },
      create: {
        key:   'template_anniversaire',
        value: 'Joyeux anniversaire [Prenom] ! 🎂 Toute l\'équipe Phila vous souhaite une excellente journée. Que Dieu vous bénisse abondamment.',
      },
      update: {},
    }),
    prisma.settings.upsert({
      where:  { key: 'message_bienvenue' },
      create: { key: 'message_bienvenue', value: DEFAULT_BIENVENUE_TEMPLATE },
      update: {},
    }),
    prisma.settings.upsert({
      where:  { key: 'telephone_eglise' },
      create: { key: 'telephone_eglise', value: '' },
      update: {},
    }),
  ]).catch(() => {/* ignore si settings non disponibles au démarrage */});

  // ── Tâche 5 : Messages d'anniversaire (tous les jours à 09h00) ──────────────
  cron.schedule('0 9 * * *', async () => {
    console.log('[Cron] Vérification anniversaires...');

    const today     = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay   = today.getDate();

    const contacts = await prisma.contact.findMany({
      where:  { date_naissance: { not: null } },
      select: { id: true, prenom: true, telephone: true, date_naissance: true },
    });

    const anniversaires = contacts.filter(c => {
      const dn = new Date(c.date_naissance!);
      return dn.getMonth() + 1 === todayMonth && dn.getDate() === todayDay;
    });

    console.log(`[Cron] ${anniversaires.length} anniversaire(s) aujourd'hui`);
    if (anniversaires.length === 0) return;

    const setting  = await prisma.settings.findUnique({ where: { key: 'template_anniversaire' } });
    const template = setting?.value ?? 'Joyeux anniversaire [Prenom] ! 🎂 Que Dieu vous bénisse abondamment.';

    for (const contact of anniversaires) {
      const contenu    = template.replace(/\[Prenom\]/gi, contact.prenom);
      const { sid, error } = await sendWhatsApp(contact.telephone, contenu);

      await prisma.message.create({
        data: {
          contact_id: contact.id,
          type:       'actu',
          contenu,
          statut:     error ? 'echoue' : 'envoye',
          twilio_sid: sid ?? null,
          envoye_le:  error ? null : new Date(),
        },
      });

      if (error) {
        console.error(`[Cron] Échec anniversaire pour ${contact.id}: ${error}`);
      }
    }

    console.log(`[Cron] ${anniversaires.length} message(s) anniversaire traité(s)`);
  });

  console.log('[Cron] Tâches planifiées démarrées');
}
