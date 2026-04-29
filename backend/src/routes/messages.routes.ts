// src/routes/messages.routes.ts
// Envoi et historique des messages WhatsApp + webhook Twilio.

import { Router } from 'express';
import {
  listMessages,
  getMessagesByContact,
  sendBienvenue,
  twilioWebhook,
} from '../controllers/messages.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole, requireRole } from '../middlewares/roles.middleware';

const router = Router();

// Webhook Twilio — pas de JWT (Twilio ne peut pas en envoyer)
router.post('/webhook/twilio', twilioWebhook);

router.use(authenticate);

router.get('/', requireMinRole('admin_campus'), listMessages);
router.get('/contact/:contactId', requireMinRole('referent_integration'), getMessagesByContact);

// Envoi manuel du message de bienvenue (si le cron ne l'a pas encore déclenché)
router.post('/bienvenue/:contactId', requireRole('super_admin', 'admin_campus'), sendBienvenue);

export default router;
