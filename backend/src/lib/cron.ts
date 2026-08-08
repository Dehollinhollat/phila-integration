// src/lib/cron.ts
// Tâches planifiées avec node-cron.
//
// Tâche 1 - Message de bienvenue J+3
//   Tous les jours à 09h00, cherche les contacts inscrits il y a exactement 3 jours
//   avec un référent intégration assigné et aucun message de bienvenue existant.
//   Le message est signé avec le prénom + nom du référent intégration.
//
// Tâche 2 - Envoi des événements planifiés
//   Toutes les minutes, cherche les événements au statut 'planifie' dont
//   planifie_le est <= maintenant et les envoie en masse via Twilio.
//
// Tâche 3 - Alertes contacts sans référent J+2
//   Tous les jours à 08h00, cherche les contacts inscrits il y a 2+ jours
//   sans référent intégration et crée des notifications pour les admin_campus et super_admin.

import cron from 'node-cron';
import prisma from './prisma';
import { sendWhatsApp } from './twilio';
import { sendRapportHebdomadaire } from './email';
import { applyVariables, buildDestinataireWhere, buildFiltresWhere, buildOuvrierWhere } from '../controllers/messages.controller';
import { getCampusSettingsForMany } from './campusSettings';
import crypto from 'crypto';

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

    // Charge les réglages de chaque campus présent dans le lot en un seul aller-retour DB —
    // chaque contact reçoit le template/les infos de SON campus, pas une valeur unique pour tous.
    const settingsByCampus = await getCampusSettingsForMany(
      contacts.map(c => c.campus),
      ['message_bienvenue', 'telephone_eglise', 'adresse_eglise']
    );

    for (const contact of contacts) {
      const ref = contact.referent_integration;
      const s   = settingsByCampus.get(contact.campus)!;
      const contenu = applyVariables(s.message_bienvenue, {
        prenom:            contact.prenom,
        referentNom:       ref ? `${ref.prenom} ${ref.nom}` : '',
        referentTelephone: ref?.telephone ?? '',
        telephoneEglise:   s.telephone_eglise,
        adresseEglise:     s.adresse_eglise,
        campus:            contact.campus,
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
      include: { createur: { select: { id: true, role: true } } },
    });

    if (evenements.length === 0) return;

    for (const ev of evenements) {
      console.log(`[Cron] Envoi événement: ${ev.titre}`);

      // Un événement campus=null cible tous les campus — légitime uniquement si son
      // créateur est ENCORE super_admin au moment de l'envoi (pas seulement au moment
      // de la création : le rôle a pu être révoqué entre-temps). Le cron n'a aucun
      // contexte utilisateur pour re-vérifier un périmètre, c'est le seul filet ici.
      if (!ev.campus && ev.createur?.role !== 'super_admin') {
        console.error(
          `[Cron] Événement "${ev.titre}" (${ev.id}) ignoré : campus multi-campus mais ` +
          `créateur non super_admin (role actuel: ${ev.createur?.role ?? 'inconnu'}).`
        );
        await prisma.evenement.update({
          where: { id: ev.id },
          data: { statut: 'brouillon', planifie_le: null },
        });

        // Cas légitime possible (voir docs/BACKLOG.md) : un super_admin a passé
        // l'événement en multi-campus après sa création par un admin_campus, puis
        // l'a planifié — mais le cron n'a de contexte que sur le créateur d'ORIGINE.
        // Rendre l'échec visible plutôt que silencieux : le créateur et les
        // super_admin actifs sont notifiés, avec un lien pour re-planifier.
        const superAdmins = await prisma.user.findMany({
          where: { role: 'super_admin', actif: true },
          select: { id: true },
        });
        const destinataires = new Set([ev.created_by, ...superAdmins.map(a => a.id)]);
        await prisma.notification.createMany({
          data: Array.from(destinataires).map(userId => ({
            user_id: userId,
            type:    'evenement_envoi_annule' as const,
            titre:   'Envoi événement annulé',
            message: `"${ev.titre}" ciblait tous les campus mais son créateur n'est plus super_admin — repassé en brouillon, non envoyé.`,
            lien:    '/evenements',
          })),
        });

        continue;
      }

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

      // Même garde que dans envoyerEvenement : le campus de l'événement borne toujours
      // les destinataires. Le cron n'a aucun contexte utilisateur pour re-vérifier un
      // périmètre, c'est donc la seule protection sur ce chemin.
      if (ev.campus) contactWhere.campus = ev.campus;

      // dest_type est absent (null) sur les événements créés avant ce champ — traité
      // comme 'contacts' pour rester rétrocompatible avec leur comportement d'origine.
      const destType = ((ev as Record<string, unknown>).dest_type as string | null) ?? 'contacts';

      const contacts = (destType === 'contacts' || destType === 'tous')
        ? await prisma.contact.findMany({
            where: contactWhere,
            select: { id: true, prenom: true, nom: true, telephone: true, campus: true },
          })
        : [];

      // filtres_ouvriers est déjà borné au périmètre du créateur à la création
      // (voir createEvenement) — aucun campus par défaut à réappliquer ici.
      const filtresOuvriersJson = (ev as Record<string, unknown>).filtres_ouvriers as string | null | undefined;
      let filtresOuvriers: { campus?: string; service?: string } = {};
      if (filtresOuvriersJson) {
        try { filtresOuvriers = JSON.parse(filtresOuvriersJson); } catch { /* garde {} */ }
      }
      const ouvriers = (destType === 'ouvriers' || destType === 'tous')
        ? await prisma.ouvrier.findMany({
            where:  buildOuvrierWhere(filtresOuvriers),
            select: { id: true, prenom: true, telephone: true, campus: true },
          })
        : [];

      if (contacts.length === 0 && ouvriers.length === 0) {
        await prisma.evenement.update({
          where: { id: ev.id },
          data: { statut: 'envoye', envoye_le: now },
        });
        continue;
      }

      const dateStr = ev.date_evenement.toLocaleDateString('fr-FR');

      // Charge l'adresse de CHAQUE campus présent dans les deux lots en un seul aller-retour DB —
      // un événement peut cibler plusieurs campus à la fois (ev.campus null / filtres multi-campus),
      // donc chaque destinataire doit recevoir l'adresse de SON propre campus, jamais une valeur unique.
      const settingsByCampus = await getCampusSettingsForMany(
        [...contacts.map(c => c.campus), ...ouvriers.map(o => o.campus)],
        ['adresse_eglise'],
      );

      const contactResults = await Promise.all(
        contacts.map(async (contact) => {
          const s = settingsByCampus.get(contact.campus)!;
          const contenu = ev.message_template
            .replace(/\[Date\]/g, dateStr)
            .replace(/\[Campus\]/g, ev.campus ?? contact.campus ?? 'Phila')
            .replace(/\[Prénom\]/g, contact.prenom)
            .replace(/\[prenom\]/gi, contact.prenom)
            .replace(/\[Adresse\]/g, s.adresse_eglise);

          const { sid, error } = await sendWhatsApp(contact.telephone, contenu);
          return { contact_id: contact.id as string | null, sid, error };
        }),
      );

      const ouvrierResults = await Promise.all(
        ouvriers.map(async (ouvrier) => {
          const s = settingsByCampus.get(ouvrier.campus)!;
          const contenu = ev.message_template
            .replace(/\[Date\]/g, dateStr)
            .replace(/\[Campus\]/g, filtresOuvriers.campus ?? ouvrier.campus ?? 'Phila')
            .replace(/\[Prénom\]/g, ouvrier.prenom)
            .replace(/\[prenom\]/gi, ouvrier.prenom)
            .replace(/\[Adresse\]/g, s.adresse_eglise);

          const { sid, error } = await sendWhatsApp(ouvrier.telephone, contenu);
          return { contact_id: null as string | null, sid, error };
        }),
      );

      const results = [...contactResults, ...ouvrierResults];

      // Crée un Message par destinataire
      await prisma.message.createMany({
        data: results.map((r) => ({
          contact_id: r.contact_id,
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
        `[Cron] Événement "${ev.titre}" - ${results.length - failed}/${results.length} envois réussis`
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
        : contactsSansReferent.filter((c: { id: string; prenom: string; nom: string; campus: string }) => admin.campus.includes(c.campus as any));

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

  // ── Tâche 5 : Messages d'anniversaire (tous les jours à 09h00) ──────────────
  cron.schedule('0 9 * * *', async () => {
    console.log('[Cron] Vérification anniversaires...');

    const today     = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay   = today.getDate();

    const contacts = await prisma.contact.findMany({
      where:  { date_naissance: { not: null } },
      select: { id: true, prenom: true, telephone: true, date_naissance: true, campus: true },
    });

    const anniversaires = contacts.filter((c: { id: string; prenom: string; telephone: string; date_naissance: Date | null }) => {
      const dn = new Date(c.date_naissance!);
      return dn.getMonth() + 1 === todayMonth && dn.getDate() === todayDay;
    });

    console.log(`[Cron] ${anniversaires.length} anniversaire(s) aujourd'hui`);

    const settingsByCampus = await getCampusSettingsForMany(
      anniversaires.map(c => c.campus),
      ['template_anniversaire', 'adresse_eglise']
    );

    for (const contact of anniversaires) {
      const s       = settingsByCampus.get(contact.campus)!;
      const contenu = s.template_anniversaire
        .replace(/\[Prenom\]/gi,  contact.prenom)
        .replace(/\[Adresse\]/gi, s.adresse_eglise);
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

    // ── Ouvriers anniversaire ──────────────────────────────────────────────────
    const ouvriers = await prisma.ouvrier.findMany({
      where: { date_naissance: { not: null } },
    });
    const ouvriersAujourdHui = ouvriers.filter(o => {
      if (!o.date_naissance) return false;
      const d = new Date(o.date_naissance);
      return d.getDate() === todayDay && (d.getMonth() + 1) === todayMonth;
    });
    console.log(`[Cron] ${ouvriersAujourdHui.length} anniversaire(s) ouvrier(s) aujourd'hui`);
    const settingsByCampusOuvriers = await getCampusSettingsForMany(
      ouvriersAujourdHui.map(o => o.campus),
      ['template_anniversaire', 'adresse_eglise']
    );
    for (const ouvrier of ouvriersAujourdHui) {
      const s       = settingsByCampusOuvriers.get(ouvrier.campus)!;
      const message = s.template_anniversaire
        .replace(/\[Prenom\]/g,  ouvrier.prenom)
        .replace(/\[Adresse\]/g, s.adresse_eglise);
      const { error } = await sendWhatsApp(ouvrier.telephone, message);
      if (error) console.error(`[ANNIVERSAIRE] Erreur ouvrier ${ouvrier.prenom}:`, error);
    }
    console.log(`[Cron] ${ouvriersAujourdHui.length} message(s) anniversaire ouvrier(s) traité(s)`);
  });

  // ── Tâche 6 : Nettoyage sessions inactives (tous les jours à 02h00) ─────────
  // Supprime les refresh tokens non utilisés depuis plus de 3 jours.
  // last_used_at est mis à jour à chaque appel à POST /api/auth/refresh.
  cron.schedule('0 2 * * *', async () => {
    const limite = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const deleted = await prisma.refreshToken.deleteMany({
      where: { last_used_at: { lt: limite }, revoked: false },
    }).catch(() => ({ count: 0 }));
    console.log(`[CRON][CLEANUP] ${deleted.count} refresh token(s) inactifs supprimés`);
  });

  // ── Tâche 7 : Purge des tokens révoqués (tous les jours à 03h00) ────────────
  // Conserve les tokens révoqués 30 jours pour l'audit, puis les supprime.
  cron.schedule('0 3 * * *', async () => {
    const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const deleted = await prisma.refreshToken.deleteMany({
      where: { revoked: true, revoked_at: { lt: limite } },
    }).catch(() => ({ count: 0 }));
    console.log(`[CRON][CLEANUP] ${deleted.count} refresh token(s) révoqués purgés`);
  });

  // ── Tâche 8 : Rapport hebdomadaire (tous les lundis à 08h00) ─────────────────
  // Envoie un email récapitulatif de la semaine à tous les admins actifs.
  cron.schedule('0 8 * * 1', async () => {
    console.log('[Cron] Envoi du rapport hebdomadaire...');

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [nouveaux, totalIntegres, messagesCount, ouvriersActifs, admins] = await Promise.all([
      prisma.contact.count({ where: { date_inscription: { gte: oneWeekAgo } } }),
      prisma.contact.count({ where: { statut: { in: ['integre', 'ouvrier'] as const } } }),
      prisma.message.count({ where: { statut: 'envoye', envoye_le: { gte: oneWeekAgo } } }),
      prisma.ouvrier.count({ where: { statut: true } }),
      prisma.user.findMany({
        where:  { actif: true, role: { in: ['super_admin', 'admin_campus'] } },
        select: { id: true, prenom: true, email: true },
      }),
    ]);

    const stats = {
      nouveaux_contacts: nouveaux,
      total_integres:    totalIntegres,
      messages_envoyes:  messagesCount,
      ouvriers_actifs:   ouvriersActifs,
    };

    const results = await Promise.allSettled(
      admins.map(admin => sendRapportHebdomadaire(admin.email, admin.prenom, stats))
    );
    const sent = results.filter(r => r.status === 'fulfilled').length;
    console.log(`[Cron] Rapport hebdomadaire envoyé à ${sent}/${admins.length} admin(s)`);
  });

  // ── Tâche 9 : Détection contacts à risque (tous les jours à 08h30) ───────────
  // Contacts sans référent depuis >2j et contacts 'nouveau' depuis >7j.
  // Notifie les admins globalement + chaque référent pour ses propres contacts.
  cron.schedule('30 8 * * *', async () => {
    const il_y_a_7_jours = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000);
    const il_y_a_2_jours = new Date(Date.now() -  2 * 24 * 60 * 60 * 1000);

    const [sansReferent, nouveauxEnRetard] = await Promise.all([
      prisma.contact.findMany({
        where: {
          referent_integration_id: null,
          statut: { not: 'inactif' },
          date_inscription: { lt: il_y_a_2_jours },
        },
        select: { id: true, prenom: true, nom: true, campus: true },
      }),
      prisma.contact.findMany({
        where: {
          statut: 'nouveau',
          date_inscription: { lt: il_y_a_7_jours },
          intention: { notIn: ['visite_occasionnelle', 'ne_souhaite_pas_integrer', 'transfere'] as any },
        },
        select: { id: true, prenom: true, nom: true, campus: true, referent_integration_id: true },
      }),
    ]);

    const admins = await prisma.user.findMany({
      where: { role: { in: ['super_admin', 'admin_campus'] }, actif: true },
    });

    for (const admin of admins) {
      if (sansReferent.length > 0) {
        await prisma.notification.create({
          data: {
            user_id: admin.id,
            type:    'alerte_risque',
            titre:   `${sansReferent.length} contact(s) sans référent`,
            message: `${sansReferent.length} contact(s) n'ont pas de référent depuis plus de 2 jours`,
            lien:    '/contacts?sans_referent=true',
          },
        });
      }
      if (nouveauxEnRetard.length > 0) {
        await prisma.notification.create({
          data: {
            user_id: admin.id,
            type:    'alerte_risque',
            titre:   `${nouveauxEnRetard.length} nouveau(x) contact(s) en retard`,
            message: `${nouveauxEnRetard.length} contact(s) ont le statut Nouveau depuis plus de 7 jours`,
            lien:    '/contacts?statut=nouveau',
          },
        });
      }
    }

    const referents = await prisma.user.findMany({
      where: { role: 'referent_integration', actif: true },
    });

    for (const referent of referents) {
      const mesContactsEnRetard = nouveauxEnRetard.filter(
        c => c.referent_integration_id === referent.id
      );
      if (mesContactsEnRetard.length > 0) {
        await prisma.notification.create({
          data: {
            user_id: referent.id,
            type:    'alerte_risque',
            titre:   'Contacts nécessitant votre attention',
            message: `${mesContactsEnRetard.length} de vos contacts n'ont pas évolué depuis plus de 7 jours`,
            lien:    '/mon-tableau-de-bord',
          },
        });
      }
    }

    console.log(`[CRON][RISQUE] ${sansReferent.length} sans référent, ${nouveauxEnRetard.length} en retard`);
  });

  // ── Tâche 10 : Message Nouvel An (1er janvier à 09h00) ────────────────────
  cron.schedule('0 9 1 1 *', async () => {
    console.log('[CRON][NOUVEL_AN] Envoi messages Nouvel An...');

    const [contacts, ouvriers] = await Promise.all([
      prisma.contact.findMany({
        where:  {},
        select: { prenom: true, telephone: true, campus: true },
      }),
      prisma.ouvrier.findMany({
        where:  {},
        select: { prenom: true, telephone: true, campus: true },
      }),
    ]);

    const seen = new Set<string>();
    const destinataires = [
      ...contacts.map(c => ({ prenom: c.prenom, telephone: c.telephone, campus: c.campus })),
      ...ouvriers.map(o => ({ prenom: o.prenom, telephone: o.telephone, campus: o.campus })),
    ].filter(d => {
      if (seen.has(d.telephone)) return false;
      seen.add(d.telephone);
      return true;
    });

    const settingsByCampus = await getCampusSettingsForMany(
      destinataires.map(d => d.campus),
      ['template_nouvel_an', 'adresse_eglise']
    );

    for (const dest of destinataires) {
      const s       = settingsByCampus.get(dest.campus)!;
      const message = s.template_nouvel_an
        .replace(/\[Prenom\]/g,  dest.prenom)
        .replace(/\[Adresse\]/g, s.adresse_eglise);
      const { error } = await sendWhatsApp(dest.telephone, message);
      if (error) {
        console.error(`[NOUVEL_AN] Erreur pour ${dest.telephone}:`, error);
      }
    }

    console.log(`[CRON][NOUVEL_AN] ${destinataires.length} messages envoyés`);
  });

  // ── Tâche 11 : Liens feedback satisfaction J+14 (tous les jours à 10h00) ───
  cron.schedule('0 10 * * *', async () => {
    const il_y_a_14_jours = new Date();
    il_y_a_14_jours.setDate(il_y_a_14_jours.getDate() - 14);

    const debut = new Date(il_y_a_14_jours);
    debut.setHours(0, 0, 0, 0);
    const fin = new Date(il_y_a_14_jours);
    fin.setHours(23, 59, 59, 999);

    const contacts = await prisma.contact.findMany({
      where: {
        date_inscription: { gte: debut, lte: fin },
        statut: { not: 'inactif' },
      },
      select: { id: true, prenom: true, telephone: true },
    });

    for (const contact of contacts) {
      const token     = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await prisma.feedbackToken.create({
        data: { contact_id: contact.id, token, expires_at: expiresAt },
      });

      const lien    = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/form/feedback/${token}`;
      const message = `Bonjour ${contact.prenom}, nous espérons que vous vous sentez bien chez nous à Phila ! Votre avis nous est précieux. Prenez 3 minutes pour répondre à notre questionnaire de satisfaction : ${lien}`;

      const { error } = await sendWhatsApp(contact.telephone, message);
      if (error) {
        console.error('[FEEDBACK] Erreur envoi:', error);
      }
    }

    console.log(`[CRON][FEEDBACK] ${contacts.length} lien(s) envoyé(s)`);
  });

  console.log('[Cron] Tâches planifiées démarrées');
}
