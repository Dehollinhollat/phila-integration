// src/routes/ouvriers.routes.ts
// Routes pour la gestion des ouvriers (équipes de service).
//
// Routes publiques (avant authenticate) :
//   POST /candidature   → formulaire public de candidature ouvrier
//   GET  /check-phone   → vérification doublon téléphone
//
// Routes protégées :
//   Lecture : tous les rôles (filtrés par campus côté contrôleur selon le rôle)
//   Écriture : admin_campus et super_admin uniquement

import { Router } from 'express';
import {
  listOuvriers,
  countOuvriers,
  getOuvrier,
  createOuvrier,
  updateOuvrier,
  toggleStatut,
  deactivateOuvrier,
  candidatureOuvrier,
  checkOuvrierPhone,
} from '../controllers/ouvriers.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole, requireRole } from '../middlewares/roles.middleware';
import { formRateLimit } from '../middlewares/rateLimit.middleware';

const router = Router();

// ── Routes publiques (sans auth) ─────────────────────────────────────────────
// Déclarées AVANT router.use(authenticate) pour bypasser l'authentification.
// /candidature et /check-phone doivent aussi précéder /:id pour éviter qu'Express
// interprète "candidature" comme un paramètre d'id.

// formRateLimit protège contre les soumissions automatisées
router.post('/candidature', formRateLimit, candidatureOuvrier);
router.get('/check-phone',  checkOuvrierPhone);

// ── Middleware d'auth — s'applique à toutes les routes déclarées après ────────
router.use(authenticate);

router.get('/',       requireMinRole('lecteur'),                  listOuvriers);
router.get('/count',  requireMinRole('lecteur'),                  countOuvriers);
router.post('/',      requireRole('super_admin', 'admin_campus'), createOuvrier);

// PATCH /:id/statut AVANT /:id pour éviter qu'Express matche 'statut' comme un id
router.patch('/:id/statut', requireRole('super_admin', 'admin_campus'), toggleStatut);

router.get('/:id',    requireMinRole('lecteur'),               getOuvrier);
router.put('/:id',    requireRole('super_admin', 'admin_campus'), updateOuvrier);
router.delete('/:id', requireRole('super_admin', 'admin_campus'), deactivateOuvrier);

export default router;
