// setup.ts — configuration globale Jest chargée avant chaque test suite.
// Responsabilités :
//   1. Variables d'environnement de test (JWT_SECRET, NODE_ENV, …)
//   2. Mock de Prisma (évite toute connexion DB réelle)
//   3. Mock de Twilio (évite tout envoi SMS/WhatsApp réel)
//   4. Helper genererTokenTest pour les tests d'intégration des routes protégées

import jwt from 'jsonwebtoken';

// ─── 1. Variables d'environnement ────────────────────────────────────────────
process.env.NODE_ENV    = 'test';
process.env.JWT_SECRET  = 'test-secret-phila-integration-jest';
process.env.PORT        = '4001';   // port isolé pour éviter les conflits
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_phila';
process.env.TWILIO_ACCOUNT_SID   = 'ACtest000000000000000000000000000000';
process.env.TWILIO_AUTH_TOKEN    = 'test-auth-token';
process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886';
process.env.FRONTEND_URL         = 'http://localhost:5173';

// ─── 2. Mock Prisma ───────────────────────────────────────────────────────────
// jest.mock intercepte tous les imports de '../lib/prisma' dans les fichiers testés.
// moduleNameMapper dans jest.config.ts redirige vers __mocks__/prisma.ts.
jest.mock('../lib/prisma');

// ─── 3. Mock Twilio ───────────────────────────────────────────────────────────
// sendWhatsApp est wrappé dans lib/twilio.ts — on mock le module entier.
jest.mock('../lib/twilio', () => ({
  sendWhatsApp: jest.fn().mockResolvedValue({ sid: 'SM_test_sid', error: null }),
  sendWhatsAppBulk: jest.fn().mockResolvedValue([]),
}));

// ─── 4. Mock Turnstile ───────────────────────────────────────────────────────
// Le middleware Turnstile fait une requête réseau vers Cloudflare — on le court-circuite
// en tests pour que POST /api/contacts passe sans token anti-bot.
jest.mock('../middlewares/turnstile.middleware', () => ({
  verifyTurnstile: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// ─── 5. Mock node-cron ────────────────────────────────────────────────────────
// Empêche les cron jobs de tourner pendant les tests
jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

// ─── 5. Helper : génération de token de test ─────────────────────────────────
/**
 * Génère un JWT signé avec JWT_SECRET de test pour simuler un utilisateur connecté.
 * Utilisé dans les tests d'intégration pour les routes protégées.
 */
export function genererTokenTest(
  role: string = 'super_admin',
  userId: string = 'user-test-id',
  campus: string[] = ['paris'],
): string {
  return jwt.sign(
    { userId, role, campus },
    process.env.JWT_SECRET!,
    { expiresIn: '8h', algorithm: 'HS256' },
  );
}

// Expose en global pour les tests sans import explicite
(global as Record<string, unknown>).genererTokenTest = genererTokenTest;
