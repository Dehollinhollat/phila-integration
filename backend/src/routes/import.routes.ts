// src/routes/import.routes.ts
// Import Excel de contacts — réservé à admin_campus et super_admin.
// Utilise multer (memoryStorage) pour lire le fichier en RAM sans écriture disque.

import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/roles.middleware';
import { importContacts } from '../controllers/import.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 Mo max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel',                                          // .xls
      'text/csv',                                                           // .csv
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté — fichier .xlsx, .xls ou .csv attendu'));
    }
  },
});

// POST /api/import/contacts
router.post(
  '/contacts',
  authenticate,
  requireRole('super_admin', 'admin_campus'),
  upload.single('file'),
  importContacts,
);

export default router;
