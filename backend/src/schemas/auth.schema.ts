// src/schemas/auth.schema.ts
// Schémas Zod pour les routes d'authentification.

import { z } from 'zod';

export const loginSchema = z.object({
  email:    z.string().email('Email invalide').max(255, 'Email trop long'),
  password: z.string().min(1, 'Mot de passe requis').max(128, 'Mot de passe trop long'),
});

const VALID_ROLES = ['super_admin', 'admin_campus', 'referent_eglise', 'referent_integration', 'lecteur'] as const;
const VALID_CAMPUS = ['paris', 'paris_nord'] as const;

// Le mot de passe n'est plus fourni par le frontend — il est généré côté serveur.
export const createUserSchema = z.object({
  prenom: z.string().min(1, 'Prénom requis').max(100),
  nom:    z.string().min(1, 'Nom requis').max(100),
  email:  z.string().email('Email invalide').max(255),
  role:   z.enum(VALID_ROLES),
  campus: z.array(z.enum(VALID_CAMPUS)).optional(),
});

export type LoginInput      = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
