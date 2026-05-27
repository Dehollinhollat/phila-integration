// src/routes/contacts.routes.ts
// CRUD contacts + commentaires + historique de statut.

import { Router } from 'express';
import {
  listContacts,
  getContact,
  createContact,
  updateContact,
  updateContactFull,
  deleteContact,
  updateStatut,
  listCommentaires,
  createCommentaire,
  getHistorique,
  getDashboardAlerts,
  exportContacts,
  patchChecklist,
  initChecklist,
  patchReferents,
  checkPhone,
  countContacts,
  getAuditLog,
  getMesContacts,
  suggererReferent,
  telechargerCertificat,
} from '../controllers/contacts.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole, requireRole } from '../middlewares/roles.middleware';
import { formRateLimit } from '../middlewares/rateLimit.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createContactSchema } from '../schemas/contacts.schema';

const router = Router();

// Routes publiques — avant authenticate (formulaire QR code)
router.get('/check-phone', checkPhone);
// validate(createContactSchema) vérifie les champs requis + format téléphone E.164
// formRateLimit protège contre les soumissions automatisées
router.post('/', formRateLimit, validate(createContactSchema), createContact);

router.use(authenticate);

// Contacts
router.get('/', requireMinRole('lecteur'), listContacts);
router.get('/alerts', requireMinRole('admin_campus'), getDashboardAlerts);
router.get('/export', requireMinRole('lecteur'), exportContacts);
// /count et /mes-contacts AVANT /:id — sinon Express matche ces segments comme un id param
router.get('/count',        requireMinRole('admin_campus'),         countContacts);
router.get('/mes-contacts', requireMinRole('referent_integration'), getMesContacts);
router.get('/:id', requireMinRole('lecteur'), getContact);
// POST '/' est déjà géré en route publique ci-dessus
router.patch('/:id', requireMinRole('referent_integration'), updateContact);
router.put('/:id', requireRole('super_admin', 'admin_campus'), updateContactFull);
router.delete('/:id', requireRole('super_admin', 'admin_campus'), deleteContact);

// Checklist
router.patch('/:id/checklist', requireMinRole('referent_integration'), patchChecklist);
router.post('/:id/checklist/init', requireMinRole('referent_integration'), initChecklist);

// Référents
router.patch('/:id/referents', requireMinRole('admin_campus'), patchReferents);

// Statut
router.patch('/:id/statut', requireMinRole('referent_integration'), updateStatut);

// Commentaires
router.get('/:id/commentaires', requireMinRole('referent_integration'), listCommentaires);
router.post('/:id/commentaires', requireMinRole('referent_integration'), createCommentaire);

// Historique
router.get('/:id/historique',         requireMinRole('referent_integration'), getHistorique);

// Suggestion de référent (charge la plus faible sur le même campus)
router.get('/:id/suggerer-referent',  requireMinRole('admin_campus'),         suggererReferent);

// Audit log
router.get('/:id/audit', requireMinRole('referent_integration'), getAuditLog);

// Certificat d'intégration PDF
router.get('/:id/certificat', requireMinRole('referent_integration'), telechargerCertificat);

export default router;
