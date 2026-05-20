// src/routes/notifications.routes.ts
// Notifications in-app — chaque utilisateur connecté gère ses propres notifications.

import { Router } from 'express';
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notifications.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', listNotifications);
router.patch('/lues', markAllAsRead);
router.patch('/:id/lue', markAsRead);
router.delete('/:id', deleteNotification);

export default router;
