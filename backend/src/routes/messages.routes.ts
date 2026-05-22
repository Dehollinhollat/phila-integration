// src/routes/messages.routes.ts
// Envoi et historique des messages WhatsApp + webhook Twilio + événements groupés.

import { Router } from 'express';
import {
  listMessages,
  getMessagesByContact,
  getMessage,
  sendBienvenue,
  createEvenement,
  twilioWebhook,
} from '../controllers/messages.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole, requireRole } from '../middlewares/roles.middleware';

const router = Router();

// Webhook Twilio — pas de JWT (Twilio ne peut pas en envoyer)
router.post('/webhook/twilio', twilioWebhook);

router.use(authenticate);

// Lecture : référents + admins peuvent consulter l'historique
router.get('/',                              requireMinRole('referent_integration'), listMessages);
router.get('/contact/:contactId',            requireMinRole('referent_integration'), getMessagesByContact);

// POST /evenement AVANT /:id pour éviter qu'Express matche "evenement" comme un id param
router.post('/evenement',                    requireMinRole('admin_campus'),        createEvenement);

// Envoi manuel du message de bienvenue (si le cron ne l'a pas encore déclenché)
router.post('/bienvenue/:contactId',         requireRole('super_admin', 'admin_campus'), sendBienvenue);

router.get('/:id',                           requireMinRole('referent_integration'), getMessage);

export default router;
