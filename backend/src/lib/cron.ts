// src/lib/cron.ts
// Tâches planifiées avec node-cron.
//
// Tâche 1 — Message de bienvenue J+3
//   Tous les jours à 09h00, cherche les contacts inscrits il y a exactement 3 jours
//   avec un référent intégration assigné et aucun message de bienvenue existant.
//
// Tâche 2 — Envoi des événements planifiés
//   Toutes les minutes, cherche les événements au statut 'planifie' dont
//   planifie_le est <= maintenant et les envoie en masse via Twilio.

import cron from 'node-cron';
import prisma from './prisma';
import { sendWhatsApp, sendWhatsAppBulk } from './twilio';
import { buildBienvenueMessage } from '../controllers/messages.controller';

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
      select: { id: true, prenom: true, telephone: true },
    });

    console.log(`[Cron] ${contacts.length} message(s) bienvenue à envoyer`);

    for (const contact of contacts) {
      const contenu = buildBienvenueMessage(contact.prenom);
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

      // Construit le filtre destinataires
      const contactWhere = buildDestinataireWhere(ev.destinataires as string, ev.campus as string | null);

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

  console.log('[Cron] Tâches planifiées démarrées');
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function buildDestinataireWhere(destinataires: string, campus: string | null): Record<string, unknown> {
  switch (destinataires) {
    case 'profil_a': return { profil: 'A' };
    case 'profil_b': return { profil: 'B' };
    case 'campus_paris': return { campus: 'paris' };
    case 'campus_paris_nord': return { campus: 'paris_nord' };
    case 'tous':
    default:
      return campus ? { campus } : {};
  }
}
