// src/routes/twilio.routes.ts
// Route publique — appelée directement par Twilio (pas de JWT).
// Registrée dans server.ts sous /webhooks/twilio.

import { Router } from 'express';
import { handleIncomingWhatsApp } from '../controllers/twilio.controller';

const router = Router();

// POST /webhooks/twilio/incoming
// Corps : application/x-www-form-urlencoded (format Twilio natif)
// Répond toujours 200 + TwiML vide pour éviter les retries Twilio.
router.post('/incoming', handleIncomingWhatsApp);

export default router;
