// src/server.ts
// Point d'entrée Express — monte tous les routeurs et démarre le serveur.
// Sécurité : helmet (headers HTTP), CORS whitelist stricte, XSS sanitizer, morgan (logs).

import 'dotenv/config';
import './lib/env'; // validation des variables d'environnement — arrête le serveur si manquantes

import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import xss from 'xss';
import { startCronJobs } from './lib/cron';
import { globalRateLimit } from './middlewares/rateLimit.middleware';

import authRoutes from './routes/auth.routes';
import contactsRoutes from './routes/contacts.routes';
import referentsRoutes from './routes/referents.routes';
import messagesRoutes from './routes/messages.routes';
import ouvriersRoutes from './routes/ouvriers.routes';
import evenementsRoutes from './routes/evenements.routes';
import planningRoutes from './routes/planning.routes';
import checklistRoutes from './routes/checklist.routes';
import notificationsRoutes from './routes/notifications.routes';
import affectationsRoutes from './routes/affectations.routes';
import usersRoutes from './routes/users.routes';
import settingsRoutes from './routes/settings.routes';
import statsRoutes from './routes/stats.routes';

const app = express();
const PORT = process.env.PORT ?? 4000;

// Derrière le reverse-proxy Railway (et tout load-balancer), Express doit lire
// l'IP réelle depuis X-Forwarded-For plutôt que l'IP du proxy.
// Requis pour que express-rate-limit comptabilise correctement par client.
app.set('trust proxy', 1);

// ─── 0. Compression gzip/brotli ───────────────────────────────────────────────
// Compresse toutes les réponses JSON > 1 Ko — réduit la bande passante de ~70%.
// Placé avant tous les autres middlewares pour s'appliquer à chaque réponse.
app.use(compression());

// ─── 1. Logs HTTP (morgan) ────────────────────────────────────────────────────
// Format 'combined' : IP, méthode, URL, statut, taille, user-agent
app.use(morgan('combined'));

// ─── 2. Headers de sécurité (helmet) ─────────────────────────────────────────
// Ajoute automatiquement X-Content-Type-Options, X-Frame-Options, HSTS,
// Referrer-Policy, Permissions-Policy, etc.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", 'https://challenges.cloudflare.com'],
      frameSrc:    ['https://challenges.cloudflare.com'],
      imgSrc:      ["'self'", 'data:', 'https:'],
      connectSrc:  [
        "'self'",
        'http://localhost:4000',
        ...(process.env.BACKEND_URL ? [process.env.BACKEND_URL] : []),
      ],
    },
  },
  crossOriginEmbedderPolicy: false, // requis pour Cloudflare Turnstile
}));

// ─── 3. CORS — whitelist stricte ─────────────────────────────────────────────
// Seules les origines explicitement listées peuvent appeler l'API.
// Ajouter FRONTEND_URL dans .env pour autoriser le domaine de production.
const allowedOrigins = [
  'http://localhost:5173',
  'http://192.168.1.14:5173', // IP réseau local pour tests mobile
  process.env.FRONTEND_URL,
].filter((o): o is string => Boolean(o));

app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Autorise les requêtes sans Origin header (Postman, cURL, apps mobiles natives)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── 4. Parsing JSON (taille limitée) ────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ─── 5. Sanitisation XSS des corps de requête ────────────────────────────────
// Encode les balises HTML/script dans tous les champs texte du body.
// Les booleans, nombres et null passent sans modification.
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') return xss(value);
  if (Array.isArray(value))     return value.map(sanitizeValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeValue(v)])
    );
  }
  return value;
}

app.use((req, _res, next) => {
  if (req.body) req.body = sanitizeValue(req.body);
  next();
});

// ─── 6. Rate limiting global ──────────────────────────────────────────────────
app.use(globalRateLimit);

// ─── Routes ───────────────────────────────────────────────────────────────────

// Routes publiques
app.use('/api/auth',     authRoutes);

// Routes protégées (authenticate appliqué dans chaque routeur)
app.use('/api/contacts',      contactsRoutes);
app.use('/api/referents',     referentsRoutes);
app.use('/api/messages',      messagesRoutes);
app.use('/api/ouvriers',      ouvriersRoutes);
app.use('/api/evenements',    evenementsRoutes);
app.use('/api/planning',      planningRoutes);
app.use('/api/checklist',     checklistRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/affectations',  affectationsRoutes);
app.use('/api/users',         usersRoutes);
app.use('/api/settings',      settingsRoutes);
app.use('/api/stats',         statsRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// ─── Gestionnaire d'erreurs global ────────────────────────────────────────────
// En production : stack trace logguée côté serveur seulement, jamais exposée au client.
// En développement : stack trace incluse dans la réponse pour faciliter le debug.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message, err.stack);
  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({
    message: 'Erreur interne du serveur',
    ...(isDev && { detail: err.message, stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`[SERVER] Démarré sur le port ${PORT} — env: ${process.env.NODE_ENV ?? 'development'}`);
  startCronJobs();
});

export default app;
