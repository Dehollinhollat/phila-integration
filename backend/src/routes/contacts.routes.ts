// src/routes/contacts.routes.ts
// CRUD contacts + commentaires + historique de statut.

import { Router } from 'express';
import {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  updateStatut,
  listCommentaires,
  createCommentaire,
  getHistorique,
  getDashboardAlerts,
} from '../controllers/contacts.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole, requireRole } from '../middlewares/roles.middleware';

const router = Router();

router.use(authenticate);

// Contacts
router.get('/', requireMinRole('lecteur'), listContacts);
router.get('/alerts', requireMinRole('admin_campus'), getDashboardAlerts);
router.get('/:id', requireMinRole('lecteur'), getContact);
router.post('/', requireMinRole('referent_integration'), createContact);
router.patch('/:id', requireMinRole('referent_integration'), updateContact);
router.delete('/:id', requireRole('super_admin', 'admin_campus'), deleteContact);

// Statut
router.patch('/:id/statut', requireMinRole('referent_integration'), updateStatut);

// Commentaires
router.get('/:id/commentaires', requireMinRole('referent_integration'), listCommentaires);
router.post('/:id/commentaires', requireMinRole('referent_integration'), createCommentaire);

// Historique
router.get('/:id/historique', requireMinRole('referent_integration'), getHistorique);

export default router;
