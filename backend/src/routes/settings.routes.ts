// src/routes/settings.routes.ts
// Paramètres système.
// - /global          : seuils d'alerte — super_admin uniquement.
// - /campus/:campus  : templates messages + infos église — super_admin (tous campus)
//   ou admin_campus (uniquement les campus de son user.campus[]).
//
// requireCampusAccess seul ne vérifie QUE l'appartenance au campus, pas le rôle
// (un lecteur/referent_integration scopé sur ce campus passerait aussi) — d'où le
// requireMinRole('admin_campus') systématiquement chaîné avant lui sur ces 2 routes.

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole, requireMinRole, requireCampusAccess } from '../middlewares/roles.middleware';
import {
  getGlobalSettings, updateGlobalSettings,
  getCampusSettingsHandler, updateCampusSettingsHandler,
} from '../controllers/settings.controller';

const router = Router();

router.use(authenticate);

router.get('/global', requireRole('super_admin'), getGlobalSettings);
router.put('/global', requireRole('super_admin'), updateGlobalSettings);

router.get('/campus/:campus', requireMinRole('admin_campus'), requireCampusAccess, getCampusSettingsHandler);
router.put('/campus/:campus', requireMinRole('admin_campus'), requireCampusAccess, updateCampusSettingsHandler);

export default router;
