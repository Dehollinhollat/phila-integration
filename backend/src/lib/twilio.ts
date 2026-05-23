// src/lib/twilio.ts
// Wrapper Twilio pour l'envoi de messages WhatsApp.
// Toutes les variables d'environnement nécessaires sont lues depuis .env.
//
// Variables requises dans .env :
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_WHATSAPP_FROM   (ex: whatsapp:+14155238886)

import twilio from 'twilio';

let client: ReturnType<typeof twilio> | null = null;

function getClient(): ReturnType<typeof twilio> {
  if (!client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) throw new Error('TWILIO_ACCOUNT_SID ou TWILIO_AUTH_TOKEN manquant dans .env');
    client = twilio(sid, token);
  }
  return client;
}

export interface SendResult {
  sid?: string;
  error?: string;
}

/**
 * Envoie un message WhatsApp à un numéro E.164.
 * Retourne le SID Twilio en cas de succès, ou un message d'erreur.
 */
export async function sendWhatsApp(to: string, body: string): Promise<SendResult> {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) throw new Error('TWILIO_WHATSAPP_FROM manquant dans .env');

  // Normalise le corps : convertit \n et \r littéraux, supprime les espaces en tête/queue
  const bodyFormate = body
    .replace(/\\n/g, '\n')   // séquence littérale \n → vrai saut de ligne
    .replace(/\\r/g, '')     // supprime \r si présent
    .trim();

  if (process.env.NODE_ENV === 'development') {
    console.log('[TWILIO] Message à envoyer :');
    console.log(JSON.stringify(bodyFormate));
  }

  try {
    const msg = await getClient().messages.create({
      from,
      to: `whatsapp:${to}`,
      body: bodyFormate,
    });
    return { sid: msg.sid };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Twilio]', message);
    return { error: message };
  }
}

/**
 * Envoie un message en masse vers une liste de numéros.
 * Retourne les résultats individuels pour chaque destinataire.
 */
export async function sendWhatsAppBulk(
  recipients: Array<{ id: string; telephone: string; prenom: string }>,
  template: string
): Promise<Array<{ id: string; sid?: string; error?: string }>> {
  const results = await Promise.allSettled(
    recipients.map(async (r) => {
      const body = template
        .replace(/\[Prénom\]/g, r.prenom)
        .replace(/\[prenom\]/gi, r.prenom);
      const result = await sendWhatsApp(r.telephone, body);
      return { id: r.id, ...result };
    })
  );

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return { id: recipients[i].id, error: r.reason?.message ?? 'Erreur inconnue' };
  });
}
