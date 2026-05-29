// src/controllers/twilio.controller.ts
// Webhook Twilio — traitement des messages WhatsApp entrants.
//
// Flux :
//   Twilio  →  POST /webhooks/twilio/incoming
//           →  lookup Contact par telephone (From field)
//           →  lookup référent intégration assigné
//           →  notifie le référent par WhatsApp (si telephone) ET email (si email)
//           →  répond 200 + TwiML vide (évite les retries Twilio)
//
// Sécurité : la route est publique (pas de JWT — Twilio ne peut pas en fournir).
// Pour une sécurité renforcée en production, activer la validation de signature
// Twilio via twilio.validateRequest() + la variable TWILIO_WEBHOOK_URL.

import { Request, Response } from 'express';
import twilio from 'twilio';
import prisma from '../lib/prisma';
import { sendWhatsApp } from '../lib/twilio';
import { sendReplyNotificationEmail } from '../lib/email';

const TWIML_EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

export async function handleIncomingWhatsApp(req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', 'text/xml');

  // Vérification de la signature Twilio en production.
  // Empêche n'importe qui d'appeler ce webhook et d'injecter de faux messages.
  if (process.env.NODE_ENV === 'production') {
    const twilioSignature = req.headers['x-twilio-signature'] as string ?? '';
    const webhookUrl      = `${process.env.BACKEND_URL}/webhooks/twilio/incoming`;
    const isValid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN ?? '',
      twilioSignature,
      webhookUrl,
      req.body as Record<string, string>,
    );
    if (!isValid) {
      console.warn('[TWILIO_WEBHOOK] Signature invalide — requête rejetée');
      res.status(403).send('Forbidden');
      return;
    }
  }

  try {
    const from: string  = req.body?.From  ?? '';
    const body: string  = req.body?.Body  ?? '';

    if (!from) {
      console.warn('[TWILIO][INCOMING] Payload sans champ From — ignoré');
      res.status(200).send(TWIML_EMPTY);
      return;
    }

    // Twilio préfixe le numéro avec "whatsapp:" → on le retire pour la recherche en base
    const telephone = from.replace(/^whatsapp:/i, '');

    const contact = await prisma.contact.findUnique({
      where:   { telephone },
      select: {
        id:       true,
        prenom:   true,
        nom:      true,
        telephone: true,
        referent_integration: {
          select: { prenom: true, nom: true, telephone: true, email: true },
        },
      },
    });

    if (!contact) {
      console.log(`[TWILIO][INCOMING] Aucun contact trouvé pour ${telephone} — ignoré`);
      res.status(200).send(TWIML_EMPTY);
      return;
    }

    const referent = contact.referent_integration;

    if (!referent) {
      console.log(`[TWILIO][INCOMING] Contact ${contact.prenom} ${contact.nom} sans référent intégration — ignoré`);
      res.status(200).send(TWIML_EMPTY);
      return;
    }

    const messageReferent =
      `Nouveau message WhatsApp de votre contact ${contact.prenom} ${contact.nom} (${contact.telephone}) :\n\n"${body}"\n\nVous pouvez le rappeler directement sur ce numéro.`;

    const taches: Promise<unknown>[] = [];

    if (referent.telephone) {
      taches.push(
        sendWhatsApp(referent.telephone, messageReferent).catch(err => {
          console.error('[TWILIO][INCOMING] Erreur envoi WhatsApp référent :', err);
        }),
      );
    }

    if (referent.email) {
      taches.push(
        sendReplyNotificationEmail(
          referent.email,
          referent.prenom,
          contact.prenom,
          contact.nom,
          contact.telephone,
          body,
        ).catch(err => {
          console.error('[TWILIO][INCOMING] Erreur envoi email référent :', err);
        }),
      );
    }

    if (taches.length === 0) {
      console.log(`[TWILIO][INCOMING] Référent ${referent.prenom} ${referent.nom} sans téléphone ni email — notification impossible`);
    }

    await Promise.all(taches);

    console.log(`[TWILIO][INCOMING] Contact ${contact.prenom} ${contact.nom} → référent ${referent.prenom} ${referent.nom} notifié (whatsapp:${referent.telephone ? 'oui' : 'non'}, email:${referent.email ? 'oui' : 'non'})`);
  } catch (err) {
    // Ne jamais répondre autre chose que 200 à Twilio — les erreurs 5xx déclenchent des retries
    console.error('[TWILIO][INCOMING] Erreur inattendue :', err);
  }

  res.status(200).send(TWIML_EMPTY);
}
