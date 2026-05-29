// src/lib/env.ts
// Validation des variables d'environnement au démarrage du serveur.
// Ce fichier doit être importé en PREMIER dans server.ts, après dotenv/config.
// Le serveur s'arrête immédiatement si une variable requise est absente.

const REQUIRED_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_WHATSAPP_FROM',
  'RESEND_API_KEY',
  'BACKEND_URL',
] as const;

const missing = REQUIRED_VARS.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('[ENV] Variables d\'environnement manquantes au démarrage :', missing.join(', '));
  console.error('[ENV] Vérifiez votre fichier .env et relancez le serveur.');
  process.exit(1);
}

// Avertissement si JWT_SECRET trop court (minimum recommandé : 64 caractères / 512 bits)
const jwtSecret = process.env.JWT_SECRET!;
if (jwtSecret.length < 32) {
  console.error('[ENV] JWT_SECRET trop court (minimum 32 caractères). Arrêt du serveur.');
  process.exit(1);
}
if (jwtSecret.length < 64) {
  console.warn('[ENV] ⚠️  JWT_SECRET inférieur à 64 caractères. Recommandation : utilisez au moins 64 caractères pour HS256.');
}

console.log('[ENV] Toutes les variables d\'environnement requises sont présentes.');
