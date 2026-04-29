// src/server.ts
// Point d'entrée Express — monte tous les routeurs et démarre le serveur.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { startCronJobs } from './lib/cron';

import authRoutes from './routes/auth.routes';
import contactsRoutes from './routes/contacts.routes';
import referentsRoutes from './routes/referents.routes';
import messagesRoutes from './routes/messages.routes';
import ouvriersRoutes from './routes/ouvriers.routes';
import evenementsRoutes from './routes/evenements.routes';
import planningRoutes from './routes/planning.routes';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());

// Routes publiques
app.use('/api/auth', authRoutes);

// Routes protégées
app.use('/api/contacts', contactsRoutes);
app.use('/api/referents', referentsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/ouvriers', ouvriersRoutes);
app.use('/api/evenements', evenementsRoutes);
app.use('/api/planning', planningRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// Gestionnaire d'erreurs global
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ message: 'Erreur interne du serveur' });
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
  startCronJobs();
});

export default app;
