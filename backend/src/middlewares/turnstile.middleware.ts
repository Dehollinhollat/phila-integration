// src/middlewares/turnstile.middleware.ts
// Vérifie le token Cloudflare Turnstile inclus dans le body de la requête.
// À appliquer sur toutes les routes publiques de soumission de formulaire.
//
// Flux :
//   1. Extrait `turnstile_token` du body
//   2. Appelle l'API de vérification Cloudflare avec la SECRET_KEY
//   3. Si la vérification échoue → 403 ; sinon → next()
//
// Clés de test (dev) :
//   TURNSTILE_SECRET_KEY = 1x0000000000000000000000000000000AA
//   (accepte toujours sans interaction réelle avec Cloudflare)

import { Request, Response, NextFunction } from 'express';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v1/siteverify';

export async function verifyTurnstile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.body?.turnstile_token as string | undefined;

  if (!token) {
    res.status(403).json({ error: 'Token anti-bot manquant' });
    return;
  }

  try {
    const secretKey = process.env.TURNSTILE_SECRET_KEY ?? '1x0000000000000000000000000000000AA';
    const response = await fetch(VERIFY_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        secret:   secretKey,
        response: token,
      }),
    });

    const data = await response.json() as { success: boolean };

    if (!data.success) {
      res.status(403).json({ error: 'Vérification anti-bot échouée' });
      return;
    }

    next();
  } catch {
    // En cas d'erreur réseau vers Cloudflare, on laisse passer pour ne pas
    // bloquer les utilisateurs légitimes en cas de panne temporaire.
    next();
  }
}
